import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildRoom, facingOf, footprint, THEME_STYLES, WALL_HEIGHT_CM, type RoomItem } from "@/shared/lib/room3d";
import { inDoorSwing, blocksWindow, overlaps } from "@/shared/lib/constraintEngine";
import { generateCandidates } from "@/shared/lib/layoutEngine";
import { CATALOG, THEMES } from "@/shared/lib/catalog";
import { defaultFootprint } from "@/shared/lib/furniture";
import { roomDimensionsCm } from "@/shared/lib/units";
import type { FurnitureItem, FurnitureType, Opening, Placement, RoomDimensions } from "@/shared/types";

const DEMO: RoomDimensions = { length: 12, width: 10, unit: "ft" };
const [L, W] = roomDimensionsCm(DEMO);
const DOOR: Opening = { id: "door", kind: "door", wall: "south", offset_cm: 60, width_cm: 90, hinge: "start", swing: "inward" };
const WINDOW: Opening = { id: "window", kind: "window", wall: "east", offset_cm: 80, width_cm: 120 };

const at = (x: number, y: number, w: number, d: number, rotation_deg: Placement["rotation_deg"] = 0): Placement => ({
  item_id: "i", label: "Bed", x_cm: x, y_cm: y, width_cm: w, depth_cm: d, rotation_deg,
});

describe("facingOf", () => {
  it("turns an item's back to the wall it stands against", () => {
    expect(facingOf(at(100, 10, 150, 200), L, W)).toBe("south");
    expect(facingOf(at(100, W - 210, 150, 200), L, W)).toBe("north");
    expect(facingOf(at(10, 50, 150, 200, 90), L, W)).toBe("east");
    expect(facingOf(at(L - 210, 50, 150, 200, 270), L, W)).toBe("west");
  });

  it("uses rotation for an item standing in the open", () => {
    expect(facingOf(at(150, 100, 60, 60, 180), L, W)).toBe("north");
    expect(facingOf(at(150, 100, 60, 60, 90), L, W)).toBe("east");
  });
});

describe("buildRoom", () => {
  function furniture(...types: FurnitureType[]): FurnitureItem[] {
    return types.map((type) => {
      const [width_cm, depth_cm] = defaultFootprint(type);
      return { type, label: type[0].toUpperCase() + type.slice(1), width_cm, depth_cm, is_fixed: false, source: "manual" };
    });
  }

  const ITEMS = furniture("bed", "wardrobe", "desk", "chair", "shelf", "sofa", "table");

  /** Every candidate layout, furnished with the theme's own products (real heights, e.g. canopy beds). */
  function themedRooms(theme: string) {
    return generateCandidates(ITEMS, DEMO, "r", [DOOR, WINDOW]).map(({ layout }) => {
      const items: RoomItem[] = layout.placements.map((p) => {
        const category = ITEMS.find((i) => i.label === p.label)!.type as RoomItem["category"];
        const product = CATALOG.find((c) => c.category === category && c.theme === theme.toLowerCase());
        return { placement: p, category, product };
      });
      return { layout, built: buildRoom(L, W, [DOOR, WINDOW], items, theme) };
    });
  }

  it.each(THEMES)("keeps every %s model inside the footprint the constraint engine checked", (theme) => {
    for (const { layout, built } of themedRooms(theme)) {
      built.group.updateMatrixWorld(true);
      for (const [i, model] of built.furniture.entries()) {
        const p = layout.placements[i];
        const [w, d] = footprint(p);
        const b = new THREE.Box3().setFromObject(model);
        const tol = 0.03; // handles and trim may stand proud by a couple of cm
        expect(b.min.x, p.label).toBeGreaterThanOrEqual(p.x_cm / 100 - tol);
        expect(b.max.x, p.label).toBeLessThanOrEqual((p.x_cm + w) / 100 + tol);
        expect(b.min.z, p.label).toBeGreaterThanOrEqual(p.y_cm / 100 - tol);
        expect(b.max.z, p.label).toBeLessThanOrEqual((p.y_cm + d) / 100 + tol);
        expect(b.min.y).toBeGreaterThanOrEqual(-0.001);
      }
      built.dispose();
    }
  });

  it.each(THEMES)("dresses a %s room without touching the layout's rules", (theme) => {
    for (const { layout, built } of themedRooms(theme)) {
      const asPlacement = ([x, y, w, d]: number[]) =>
        ({ item_id: "d", label: "d", x_cm: x, y_cm: y, width_cm: w, depth_cm: d, rotation_deg: 0 }) as Placement;
      // Decor: never inside furniture, a door swing, or in front of a window.
      for (const { kind, rect } of built.decor) {
        const p = asPlacement(rect);
        expect(layout.placements.some((f) => overlaps(p, f)), kind).toBe(false);
        expect(inDoorSwing(p, DOOR, L, W), kind).toBe(false);
        expect(blocksWindow(p, WINDOW, L, W), kind).toBe(false);
        expect(rect[0] >= 0 && rect[1] >= 0 && rect[0] + rect[2] <= L && rect[1] + rect[3] <= W, kind).toBe(true);
      }
      // The rug may go under furniture, but never into the door's swing.
      if (built.rug) expect(inDoorSwing(asPlacement(built.rug), DOOR, L, W)).toBe(false);
      // Wall art never covers a door or window.
      for (const a of built.art) {
        for (const o of [DOOR, WINDOW].filter((o) => o.wall === a.wall)) {
          expect(a.u1 <= o.offset_cm || a.u0 >= o.offset_cm + o.width_cm, `${a.wall} art`).toBe(true);
        }
        expect(a.y1).toBeLessThanOrEqual(WALL_HEIGHT_CM);
      }
      built.dispose();
    }
  });

  it("gives each theme its own decor", () => {
    const kinds = THEMES.map((t) => buildRoom(L, W, [DOOR, WINDOW], [], t).decor.map((d) => d.kind).join());
    expect(new Set(kinds).size).toBe(THEMES.length);
  });

  it("uses each product's real height", () => {
    const wardrobe = CATALOG.find((p) => p.image_url === "wardrobe-modern")!;
    const built = buildRoom(L, W, [], [{ placement: at(10, 10, 120, 60), category: "wardrobe", product: wardrobe }], "modern");
    const b = new THREE.Box3().setFromObject(built.furniture[0]);
    expect(b.max.y).toBeCloseTo(wardrobe.height_cm! / 100, 2);
  });

  it("leaves a real gap in the wall for the door and window", () => {
    const built = buildRoom(L, W, [DOOR, WINDOW], [], "modern");
    built.group.updateMatrixWorld(true);
    const [north, south, east] = built.walls.map((w) => w.group);
    const solidHits = (wall: THREE.Group, from: [number, number, number], dir: [number, number, number]) =>
      new THREE.Raycaster(new THREE.Vector3(...from), new THREE.Vector3(...dir))
        .intersectObject(wall, true)
        .filter((h) => !((h.object as THREE.Mesh).material as THREE.Material).transparent);

    // Walking out through the doorway (x = 1.05 m, 1 m up) hits nothing solid:
    // the leaf stands open on its hinge at x = 0.6 m.
    expect(solidHits(south, [1.05, 1, W / 100 - 0.5], [0, 0, 1])).toHaveLength(0);
    // Looking out of the window (1.2 m along the east wall, beside the centre mullion, 1.5 m up) hits only glass.
    expect(solidHits(east, [L / 100 - 0.5, 1.5, 1.2], [1, 0, 0])).toHaveLength(0);
    // Below the window sill, and on a wall with no openings, the wall is solid.
    expect(solidHits(east, [L / 100 - 0.5, 0.5, 1.4], [1, 0, 0]).length).toBeGreaterThan(0);
    expect(solidHits(north, [L / 200, 1, 0.5], [0, 0, -1]).length).toBeGreaterThan(0);
    expect(new THREE.Box3().setFromObject(north).max.y).toBeCloseTo(WALL_HEIGHT_CM / 100, 3);
    built.dispose();
  });

  it("has a complete style for every theme offered", () => {
    for (const t of THEMES) {
      const style = THEME_STYLES[t.toLowerCase()];
      expect(style, t).toBeDefined();
      expect(style.colours.length, t).toBeGreaterThanOrEqual(3);
      expect(style.decor.length, t).toBeGreaterThan(0);
    }
  });
});
