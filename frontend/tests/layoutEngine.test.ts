import { describe, expect, it } from "vitest";
import { blocksWindow, inDoorSwing, validateLayoutLocal } from "@/shared/lib/constraintEngine";
import { findFreeSpot, fitProductAt, generateCandidates, placeNear } from "@/shared/lib/layoutEngine";
import { defaultFootprint } from "@/shared/lib/furniture";
import { roomDimensionsCm } from "@/shared/lib/units";
import type { FurnitureItem, FurnitureType, Opening, Placement, RoomDimensions } from "@/shared/types";

// The demo room from docs/room-model.md §8.
const DEMO: RoomDimensions = { length: 12, width: 10, unit: "ft" };
const [L, W] = roomDimensionsCm(DEMO);
const DOOR: Opening = { id: "door", kind: "door", wall: "south", offset_cm: 60, width_cm: 90, hinge: "start", swing: "inward" };
const WINDOW: Opening = { id: "window", kind: "window", wall: "east", offset_cm: 80, width_cm: 120 };
const DEMO_OPENINGS = [DOOR, WINDOW];

function furniture(...types: FurnitureType[]): FurnitureItem[] {
  return types.map((type) => {
    const [width_cm, depth_cm] = defaultFootprint(type);
    return { type, label: type[0].toUpperCase() + type.slice(1), width_cm, depth_cm, is_fixed: false, source: "manual" };
  });
}

function placement(label: string, x: number, y: number, w: number, d: number, rotation: Placement["rotation_deg"] = 0): Placement {
  return { item_id: label.toLowerCase(), label, x_cm: x, y_cm: y, width_cm: w, depth_cm: d, rotation_deg: rotation };
}

// Seeded so the "random" rooms are the same on every run.
function seededRandom(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

describe("generateCandidates", () => {
  const SETS: [string, FurnitureItem[]][] = [
    ["bed + wardrobe", furniture("bed", "wardrobe")],
    ["bed + wardrobe + desk", furniture("bed", "wardrobe", "desk")],
    ["desk + chair + shelf", furniture("desk", "chair", "shelf")],
    ["sofa + table", furniture("sofa", "table")],
  ];

  it.each(SETS)("every style finds a valid layout for %s in the demo room", (_, items) => {
    for (const openings of [[], DEMO_OPENINGS]) {
      for (const { style, layout } of generateCandidates(items, DEMO, "r", openings)) {
        expect(layout.violations, style).toEqual([]);
        expect(layout.feasible).toBe(true);
      }
    }
  });

  it("produces visibly different layouts per style", () => {
    const layouts = generateCandidates(furniture("bed", "wardrobe", "desk"), DEMO, "r", DEMO_OPENINGS);
    const distinct = new Set(layouts.map(({ layout }) => JSON.stringify(layout.placements.map((p) => [p.x_cm, p.y_cm, p.rotation_deg]))));
    expect(distinct.size).toBeGreaterThanOrEqual(3);
  });

  it("marks a layout feasible only when the constraint engine agrees", () => {
    for (const { layout } of generateCandidates(furniture("bed", "sofa", "wardrobe", "desk", "table"), DEMO, "r", DEMO_OPENINGS)) {
      expect(validateLayoutLocal(DEMO, layout.placements, undefined, DEMO_OPENINGS).feasible).toBe(layout.feasible);
    }
  });

  it("flags an over-furnished room instead of hiding items", () => {
    const items = furniture("bed", "bed", "sofa", "sofa", "wardrobe", "table");
    const layouts = generateCandidates(items, DEMO, "r");
    for (const { layout } of layouts) {
      expect(layout.placements).toHaveLength(items.length);
    }
    expect(layouts.some(({ layout }) => !layout.feasible)).toBe(true);
  });

  it("keeps the valid-layout rate above 80% on random rooms (proposal's primary metric)", () => {
    const rnd = seededRandom(11);
    const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
    const types: FurnitureType[] = ["bed", "wardrobe", "table", "chair", "desk", "sofa", "shelf"];
    let feasible = 0;
    let total = 0;
    for (let r = 0; r < 200; r++) {
      const dims: RoomDimensions = { length: pick([10, 12, 14, 16]), width: pick([9, 10, 12, 14]), unit: "ft" };
      const items = furniture(...Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => pick(types)));
      const openings: Opening[] = rnd() < 0.7 ? [{ ...DOOR, wall: pick(["north", "south", "east", "west"]), offset_cm: 20 }] : [];
      for (const { layout } of generateCandidates(items, dims, "r", openings)) {
        total++;
        if (layout.feasible) feasible++;
      }
    }
    expect(feasible / total).toBeGreaterThan(0.8);
  });
});

describe("placeNear", () => {
  const desk = placement("Desk", 20, 20, 120, 60);

  it("puts the item beside the window on the window's wall, without blocking it", () => {
    const spot = placeNear(desk, WINDOW, [], DEMO_OPENINGS, DEMO);
    expect(spot).not.toBeNull();
    // Against the east wall: back edge within the 10 cm wall margin.
    const footprintW = spot!.rotation_deg === 90 || spot!.rotation_deg === 270 ? spot!.depth_cm : spot!.width_cm;
    expect(L - (spot!.x_cm + footprintW)).toBeCloseTo(10);
    expect(blocksWindow(spot!, WINDOW, L, W)).toBe(false);
    expect(validateLayoutLocal(DEMO, [spot!], undefined, DEMO_OPENINGS).feasible).toBe(true);
  });

  it("prefers a spot beside the window over one partly in front of it", () => {
    const spot = placeNear(desk, WINDOW, [], DEMO_OPENINGS, DEMO)!;
    // Along the east wall, the desk's span must not overlap the window's (80–200 cm).
    const along = spot.rotation_deg === 90 || spot.rotation_deg === 270 ? spot.width_cm : spot.depth_cm;
    const [start, end] = [spot.y_cm, spot.y_cm + along];
    expect(end <= 80 || start >= 200).toBe(true);
  });

  it("never lands in a door's swing", () => {
    const chair = placement("Chair", 0, 0, 45, 45);
    const spot = placeNear(chair, DOOR, [], DEMO_OPENINGS, DEMO);
    expect(spot).not.toBeNull();
    expect(inDoorSwing(spot!, DOOR, L, W)).toBe(false);
  });

  it("returns null when nothing near the opening is free", () => {
    const huge = placement("Bed", 0, 0, 300, 280);
    expect(placeNear(huge, WINDOW, [], DEMO_OPENINGS, DEMO)).toBeNull();
  });
});

describe("findFreeSpot", () => {
  it("finds a valid spot alongside existing furniture", () => {
    const bed = placement("Bed", 10, 10, 150, 200);
    const spot = findFreeSpot(placement("Chair", 0, 0, 45, 45), [bed], DEMO_OPENINGS, DEMO);
    expect(spot).not.toBeNull();
    expect(validateLayoutLocal(DEMO, [bed, spot!], undefined, DEMO_OPENINGS).feasible).toBe(true);
  });
});

describe("fitProductAt", () => {
  it("lets a larger product grow away from the wall it's against", () => {
    // 120 cm wardrobe flush against the east wall (rotated: 60 deep along x).
    const wardrobe = placement("Wardrobe", L - 70, 10, 120, 60, 270);
    const spot = fitProductAt(wardrobe, { width_cm: 150, depth_cm: 60 }, [], [], DEMO);
    expect(spot).not.toBeNull();
    expect(spot!.width_cm).toBe(150);
    expect(validateLayoutLocal(DEMO, [spot!]).feasible).toBe(true);
  });

  it("rejects a product that would collide with neighbouring furniture", () => {
    const desk = placement("Desk", 10, 10, 120, 60);
    const shelf = placement("Shelf", 205, 10, 90, 30); // exactly 75 cm away
    expect(fitProductAt(desk, { width_cm: 160, depth_cm: 60 }, [shelf], [], DEMO)).toBeNull();
    expect(fitProductAt(desk, { width_cm: 110, depth_cm: 60 }, [shelf], [], DEMO)).not.toBeNull();
  });

  it("rejects a product that would block a door", () => {
    // Chair in the corner between the west wall and the door (swing x 60–150):
    // growing right enters the swing, growing left goes through the wall.
    const chair = placement("Chair", 10, W - 55, 45, 45);
    expect(fitProductAt(chair, { width_cm: 160, depth_cm: 45 }, [], [DOOR], DEMO)).toBeNull();
    expect(fitProductAt(chair, { width_cm: 40, depth_cm: 45 }, [], [DOOR], DEMO)).not.toBeNull();
  });
});
