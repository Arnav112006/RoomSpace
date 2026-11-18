import type { FurnitureItem, Layout, Opening, Placement, RoomDimensions, ScoredLayout } from "@/shared/types";
import { roomDimensionsCm } from "./units";
import {
  EPSILON_CM,
  MIN_CLEARANCE_CM,
  clearanceBetween,
  conflictingOpening,
  overlaps,
  validateLayoutLocal,
  withinBounds,
} from "./constraintEngine";

// ---------------------------------------------------------------------
// Stage 4 — Candidate Layout Generation
//
// Geometry-and-rules only, deliberately not a generative model: every
// candidate is built by a named placement strategy (a "style") so the
// result is auditable and reproducible, matching the project's design
// goal of controlling exactly what counts as a valid layout.
// ---------------------------------------------------------------------

const WALL_MARGIN_CM = 10;
/** Step used when sliding an item along a wall or across the floor. */
const SEARCH_STEP_CM = 10;

type WallSide = "north" | "south" | "east" | "west";
export type LayoutStyle = "wall-hug" | "zoned" | "symmetric" | "corner-focused";

interface WorkingItem {
  item: FurnitureItem;
  id: string;
}

function zoneToWall(zone?: string | null): WallSide | null {
  if (!zone) return null;
  const z = zone.toLowerCase();
  if (z.includes("north") || z.includes("back") || z.includes("top")) return "north";
  if (z.includes("south") || z.includes("front") || z.includes("bottom")) return "south";
  if (z.includes("east") || z.includes("right")) return "east";
  if (z.includes("west") || z.includes("left")) return "west";
  return null;
}

function footprintFor(item: FurnitureItem, rotated: boolean): [number, number] {
  return rotated ? [item.depth_cm, item.width_cm] : [item.width_cm, item.depth_cm];
}

/**
 * Places one item flush against `wall` (WALL_MARGIN_CM off it), starting
 * `at` cm along the wall. By default its back (depth) faces the wall;
 * `rotate` turns it a quarter so its side faces the wall instead.
 * Returns the placement and how far it extends along the wall.
 */
function placeOnWall(
  wall: WallSide,
  at: number,
  item: FurnitureItem,
  lengthCm: number,
  widthCm: number,
  rotate: boolean
): { placement: Omit<Placement, "item_id" | "label">; alongCm: number } {
  const rotated = wall === "east" || wall === "west" ? !rotate : rotate;
  const [w, d] = footprintFor(item, rotated);

  let x = 0;
  let y = 0;
  let rotation_deg: 0 | 90 | 180 | 270 = 0;

  // rotation_deg has to agree with whether the footprint was swapped,
  // or the constraint engine and renderer see a different shape from the
  // one positioned here (docs/room-model.md §2).
  if (wall === "north") {
    x = at;
    y = WALL_MARGIN_CM;
    rotation_deg = rotated ? 90 : 0;
  } else if (wall === "south") {
    x = at;
    y = widthCm - d - WALL_MARGIN_CM;
    rotation_deg = rotated ? 270 : 180;
  } else if (wall === "west") {
    x = WALL_MARGIN_CM;
    y = at;
    rotation_deg = rotated ? 90 : 0;
  } else {
    x = lengthCm - w - WALL_MARGIN_CM;
    y = at;
    rotation_deg = rotated ? 270 : 180;
  }

  return {
    placement: { x_cm: x, y_cm: y, width_cm: item.width_cm, depth_cm: item.depth_cm, rotation_deg },
    alongCm: wall === "north" || wall === "south" ? w : d,
  };
}

function wallSpan(wall: WallSide, lengthCm: number, widthCm: number): number {
  return wall === "north" || wall === "south" ? lengthCm : widthCm;
}

/**
 * True if `candidate` can join `placed` without breaking any hard rule:
 * inside the room, not overlapping or within MIN_CLEARANCE_CM of another
 * item, and clear of door swings and windows. The same rules the
 * constraint engine applies to the finished layout, checked one item at a
 * time so the generator never builds a layout it already knows is invalid.
 */
export function fitsAmong(
  candidate: Placement,
  placed: Placement[],
  openings: Opening[],
  lengthCm: number,
  widthCm: number
): boolean {
  if (!withinBounds(candidate, lengthCm, widthCm)) return false;
  if (conflictingOpening(candidate, openings, lengthCm, widthCm)) return false;
  return placed.every(
    (other) =>
      other.item_id === candidate.item_id ||
      (!overlaps(candidate, other) && clearanceBetween(candidate, other) >= MIN_CLEARANCE_CM - EPSILON_CM)
  );
}

/** Positions along a wall in the order a style wants to try them. */
function scanOrder(style: LayoutStyle, first: number, last: number): number[] {
  const forward: number[] = [];
  for (let at = first; at <= last + 1e-9; at += SEARCH_STEP_CM) forward.push(at);
  if (forward.length === 0 || forward[forward.length - 1] < last - 1e-9) forward.push(last);
  switch (style) {
    case "zoned":
      // From the far end back toward the start.
      return [...forward].reverse();
    case "symmetric": {
      // Middle of the wall first, then outward.
      const mid = (first + last) / 2;
      return [...forward].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    }
    case "corner-focused": {
      // Alternate between the two corners, working inward.
      const out: number[] = [];
      for (let i = 0, j = forward.length - 1; i <= j; i++, j--) {
        out.push(forward[i]);
        if (j !== i) out.push(forward[j]);
      }
      return out;
    }
    case "wall-hug":
    default:
      return forward;
  }
}

/**
 * First spot on `wall` where the item fits, trying positions in the
 * style's scan order — or, with `nearAlong`, nearest that point first.
 */
function findSpotOnWall(
  wall: WallSide,
  entry: WorkingItem,
  rotate: boolean,
  style: LayoutStyle,
  placed: Placement[],
  openings: Opening[],
  lengthCm: number,
  widthCm: number,
  nearAlong?: number,
  avoidSpan?: [number, number]
): Placement | null {
  const span = wallSpan(wall, lengthCm, widthCm);
  const { alongCm } = placeOnWall(wall, 0, entry.item, lengthCm, widthCm, rotate);
  const last = span - WALL_MARGIN_CM - alongCm;
  if (last < WALL_MARGIN_CM) return null;
  let positions = scanOrder(style, WALL_MARGIN_CM, last);
  if (nearAlong !== undefined) {
    positions = [...positions].sort(
      (a, b) => Math.abs(a + alongCm / 2 - nearAlong) - Math.abs(b + alongCm / 2 - nearAlong)
    );
  }
  for (const at of positions) {
    // Skip spots that overlap `avoidSpan` along the wall (e.g. a window).
    if (avoidSpan && at < avoidSpan[1] && at + alongCm > avoidSpan[0]) continue;
    const { placement } = placeOnWall(wall, at, entry.item, lengthCm, widthCm, rotate);
    const candidate: Placement = { item_id: entry.id, label: entry.item.label, ...placement };
    if (fitsAmong(candidate, placed, openings, lengthCm, widthCm)) return candidate;
  }
  return null;
}

/** Any free spot on the open floor, nearest `near` (default: the room's centre) first. */
function findSpotOnFloor(
  entry: WorkingItem,
  placed: Placement[],
  openings: Opening[],
  lengthCm: number,
  widthCm: number,
  near: [number, number] = [lengthCm / 2, widthCm / 2]
): Placement | null {
  const spots: { candidate: Placement; distance: number }[] = [];
  for (const rotated of [false, true]) {
    const [w, d] = footprintFor(entry.item, rotated);
    for (let x = WALL_MARGIN_CM; x + w <= lengthCm - WALL_MARGIN_CM + 1e-9; x += SEARCH_STEP_CM) {
      for (let y = WALL_MARGIN_CM; y + d <= widthCm - WALL_MARGIN_CM + 1e-9; y += SEARCH_STEP_CM) {
        const candidate: Placement = {
          item_id: entry.id,
          label: entry.item.label,
          x_cm: x,
          y_cm: y,
          width_cm: entry.item.width_cm,
          depth_cm: entry.item.depth_cm,
          rotation_deg: rotated ? 90 : 0,
        };
        const distance = Math.hypot(x + w / 2 - near[0], y + d / 2 - near[1]);
        spots.push({ candidate, distance });
      }
    }
  }
  spots.sort((a, b) => a.distance - b.distance);
  return spots.find(({ candidate }) => fitsAmong(candidate, placed, openings, lengthCm, widthCm))?.candidate ?? null;
}

// ---------------------------------------------------------------------
// Stage 9 helpers — find a valid spot for one item in an existing layout
// ---------------------------------------------------------------------

function asEntry(p: Placement): WorkingItem {
  return {
    id: p.item_id,
    item: {
      type: "other",
      label: p.label,
      width_cm: p.width_cm,
      depth_cm: p.depth_cm,
      is_fixed: false,
      source: "manual",
    },
  };
}

/**
 * A valid spot for `item` next to `opening` (a window or door): along the
 * opening's wall, as close to it as the rules allow, else on the floor
 * nearby. Never inside a door swing or covering a window — the usual
 * constraint rules decide. Null if nowhere near it is free.
 */
export function placeNear(
  item: Placement,
  opening: Opening,
  others: Placement[],
  openings: Opening[],
  dimensions: RoomDimensions
): Placement | null {
  const [lengthCm, widthCm] = roomDimensionsCm(dimensions);
  const entry = asEntry(item);
  const centre = opening.offset_cm + opening.width_cm / 2;
  // Truly beside the opening first; only then partly in front of it
  // (still allowed for windows, as long as it isn't blocked).
  const span: [number, number] = [opening.offset_cm, opening.offset_cm + opening.width_cm];
  for (const avoid of [span, undefined]) {
    for (const rotate of [false, true]) {
      const spot = findSpotOnWall(opening.wall, entry, rotate, "wall-hug", others, openings, lengthCm, widthCm, centre, avoid);
      if (spot) return spot;
    }
  }
  const point: [number, number] =
    opening.wall === "north" ? [centre, 0] :
    opening.wall === "south" ? [centre, widthCm] :
    opening.wall === "west" ? [0, centre] : [lengthCm, centre];
  return findSpotOnFloor(entry, others, openings, lengthCm, widthCm, point);
}

/**
 * Swaps a product's real size into a placement and keeps it valid if it
 * can: the product may grow from any corner of the original spot (so an
 * item against the right wall grows leftward) or stay centred on it.
 * Returns the adjusted placement, or null if the product doesn't fit there.
 */
export function fitProductAt(
  placement: Placement,
  product: { width_cm: number; depth_cm: number },
  others: Placement[],
  openings: Opening[],
  dimensions: RoomDimensions
): Placement | null {
  const [lengthCm, widthCm] = roomDimensionsCm(dimensions);
  const turned = placement.rotation_deg === 90 || placement.rotation_deg === 270;
  const [oldW, oldD] = turned ? [placement.depth_cm, placement.width_cm] : [placement.width_cm, placement.depth_cm];
  const [newW, newD] = turned ? [product.depth_cm, product.width_cm] : [product.width_cm, product.depth_cm];
  const dx = oldW - newW;
  const dy = oldD - newD;
  const anchors: [number, number][] = [
    [0, 0], // top-left corner stays put
    [dx, 0], // top-right
    [0, dy], // bottom-left
    [dx, dy], // bottom-right
    [dx / 2, dy / 2], // centred
  ];
  for (const [ox, oy] of anchors) {
    const candidate: Placement = {
      ...placement,
      x_cm: placement.x_cm + ox,
      y_cm: placement.y_cm + oy,
      width_cm: product.width_cm,
      depth_cm: product.depth_cm,
    };
    if (fitsAmong(candidate, others, openings, lengthCm, widthCm)) return candidate;
  }
  return null;
}

/** The first valid spot anywhere: along a wall, else on the open floor. */
export function findFreeSpot(
  item: Placement,
  others: Placement[],
  openings: Opening[],
  dimensions: RoomDimensions
): Placement | null {
  const [lengthCm, widthCm] = roomDimensionsCm(dimensions);
  const entry = asEntry(item);
  for (const rotate of [false, true]) {
    for (const wall of ["north", "east", "south", "west"] as WallSide[]) {
      const spot = findSpotOnWall(wall, entry, rotate, "wall-hug", others, openings, lengthCm, widthCm);
      if (spot) return spot;
    }
  }
  return findSpotOnFloor(entry, others, openings, lengthCm, widthCm);
}

/**
 * Runs one placement strategy over the furniture list, returning a
 * single candidate's placements. Every item is put in the first spot that
 * keeps the layout valid so far: along a wall (back to the wall, then
 * turned sideways), and only then out on the open floor. Fixed items
 * (existing furniture the user marked immovable) go first, on their own
 * wall. Openings (doors, windows) are not items and are never placed
 * here — see docs/room-model.md.
 */
function buildCandidate(
  items: WorkingItem[],
  dimensions: RoomDimensions,
  style: LayoutStyle,
  openings: Opening[],
  placeFirst: string[] = [],
  scanStyle: LayoutStyle = style
): { placements: Placement[]; unplaced: string[] } {
  const [lengthCm, widthCm] = roomDimensionsCm(dimensions);
  const placements: Placement[] = [];
  const unplaced: string[] = [];

  const fixed = items.filter((w) => w.item.is_fixed);
  const movable = items.filter((w) => !w.item.is_fixed);

  // Fixed items stay on their stated (or inferred) wall. If even that
  // wall has no valid spot, keep them there anyway and let the
  // constraint engine report it — a fixed item can't be moved.
  for (const entry of fixed) {
    const wall = zoneToWall(entry.item.approximate_zone) ?? "north";
    const spot =
      findSpotOnWall(wall, entry, false, "wall-hug", placements, openings, lengthCm, widthCm) ??
      findSpotOnWall(wall, entry, true, "wall-hug", placements, openings, lengthCm, widthCm);
    if (spot) {
      placements.push(spot);
    } else {
      unplaced.push(entry.id);
      const { placement } = placeOnWall(wall, WALL_MARGIN_CM, entry.item, lengthCm, widthCm, false);
      placements.push({ item_id: entry.id, label: entry.item.label, ...placement });
    }
  }

  // Style controls item order, which walls get priority and where along
  // a wall items are tried — what makes each candidate visibly different.
  let order = [...movable].sort((a, b) => b.item.width_cm * b.item.depth_cm - a.item.width_cm * a.item.depth_cm);
  let wallSequence: WallSide[];

  switch (style) {
    case "wall-hug":
      wallSequence = ["north", "east", "south", "west"];
      break;
    case "zoned":
      wallSequence = ["south", "north", "west", "east"];
      order = [...movable].sort((a, b) => a.item.width_cm * a.item.depth_cm - b.item.width_cm * b.item.depth_cm);
      break;
    case "symmetric":
      wallSequence = ["north", "south", "east", "west"];
      break;
    case "corner-focused":
    default:
      wallSequence = ["west", "north", "east", "south"];
      break;
  }
  // Items that failed in an earlier attempt jump the queue (see generateCandidates).
  if (placeFirst.length > 0) {
    const rank = (e: WorkingItem) => (placeFirst.includes(e.id) ? placeFirst.indexOf(e.id) : placeFirst.length);
    order = [...order].sort((a, b) => rank(a) - rank(b));
  }

  let wallIdx = 0;
  for (const entry of order) {
    let spot: Placement | null = null;
    // Back to the wall first, then sideways, on each wall in turn
    // (starting from the wall after the previous item's, to spread out).
    search: for (const rotate of [false, true]) {
      for (let attempt = 0; attempt < wallSequence.length; attempt++) {
        const wall = wallSequence[(wallIdx + attempt) % wallSequence.length];
        spot = findSpotOnWall(wall, entry, rotate, scanStyle, placements, openings, lengthCm, widthCm);
        if (spot) {
          wallIdx = (wallIdx + attempt + 1) % wallSequence.length;
          break search;
        }
      }
    }
    spot ??= findSpotOnFloor(entry, placements, openings, lengthCm, widthCm);

    if (spot) {
      placements.push(spot);
    } else {
      unplaced.push(entry.id);
      // Nowhere valid left: drop it in the middle so the constraint
      // engine flags the room as over-furnished.
      const [w, d] = footprintFor(entry.item, false);
      placements.push({
        item_id: entry.id,
        label: entry.item.label,
        x_cm: Math.max(WALL_MARGIN_CM, (lengthCm - w) / 2),
        y_cm: Math.max(WALL_MARGIN_CM, (widthCm - d) / 2),
        width_cm: entry.item.width_cm,
        depth_cm: entry.item.depth_cm,
        rotation_deg: 0,
      });
    }
  }

  return { placements, unplaced };
}

/**
 * Builds one style's candidate. Placement is greedy, so an early item can
 * take the space a later one needed. When that happens, retry with the
 * item that didn't fit placed first. If that still leaves something out,
 * keep the style's wall and item order but try spots from the corners
 * (symmetric centring wastes space in tight rooms). Keeps the attempt
 * that fits the most furniture.
 */
function bestCandidate(
  items: WorkingItem[],
  dimensions: RoomDimensions,
  style: LayoutStyle,
  openings: Opening[]
): Placement[] {
  let best = buildCandidate(items, dimensions, style, openings);
  const placeFirst: string[] = [];
  for (let retry = 0; retry < items.length && best.unplaced.length > 0; retry++) {
    const next = best.unplaced.find((id) => !placeFirst.includes(id));
    if (!next) break;
    placeFirst.push(next);
    const attempt = buildCandidate(items, dimensions, style, openings, placeFirst);
    if (attempt.unplaced.length < best.unplaced.length) best = attempt;
  }
  if (best.unplaced.length > 0 && style !== "wall-hug") {
    const attempt = buildCandidate(items, dimensions, style, openings, [], "wall-hug");
    if (attempt.unplaced.length < best.unplaced.length) best = attempt;
  }
  return best.placements;
}

export function generateCandidates(
  furniture: FurnitureItem[],
  dimensions: RoomDimensions,
  roomId: string,
  openings: Opening[] = []
): { style: LayoutStyle; layout: Layout }[] {
  const items: WorkingItem[] = furniture.map((item, i) => ({ item, id: `item-${i}-${item.type}` }));
  const styles: LayoutStyle[] = ["wall-hug", "zoned", "symmetric", "corner-focused"];

  return styles.map((style) => {
    const placements = bestCandidate(items, dimensions, style, openings);
    const { feasible, violations } = validateLayoutLocal(dimensions, placements, MIN_CLEARANCE_CM, openings);
    return {
      style,
      layout: { id: `${roomId}-${style}`, room_id: roomId, placements, feasible, violations },
    };
  });
}

// ---------------------------------------------------------------------
// Stage 6 — Aesthetic & Preference Scoring
// Stage 7 — Layout Ranking (sorting by the score this produces)
// ---------------------------------------------------------------------

const STYLE_THEME_AFFINITY: Record<LayoutStyle, Record<string, number>> = {
  "wall-hug": { minimalist: 0.9, scandinavian: 0.85, traditional: 0.75, modern: 0.6, industrial: 0.55, eclectic: 0.4 },
  zoned: { modern: 0.85, bohemian: 0.8, eclectic: 0.75, industrial: 0.6, minimalist: 0.55, traditional: 0.5 },
  symmetric: { traditional: 0.9, classic: 0.9, modern: 0.65, minimalist: 0.6, scandinavian: 0.55, industrial: 0.4 },
  "corner-focused": { bohemian: 0.85, eclectic: 0.85, industrial: 0.75, modern: 0.6, minimalist: 0.45, traditional: 0.4 },
};

function themeAlignmentScore(style: LayoutStyle, theme: string): number {
  const table = STYLE_THEME_AFFINITY[style];
  const key = Object.keys(table).find((k) => theme.toLowerCase().includes(k));
  return key ? table[key] : 0.55;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function scoreLayout(
  layout: Layout,
  style: LayoutStyle,
  dimensions: RoomDimensions,
  theme: string,
  budget: number | null | undefined,
  estimatedCostPerItem = 6500
): ScoredLayout["scores"] {
  const [lengthCm, widthCm] = roomDimensionsCm(dimensions);
  const roomArea = lengthCm * widthCm;
  const furnitureArea = layout.placements.reduce((sum, p) => sum + p.width_cm * p.depth_cm, 0);
  const utilization = furnitureArea / roomArea;

  // Good interior layouts typically use roughly a third to just under
  // half the floor area for furniture footprints; score falls off on
  // either side of that band rather than rewarding "more furniture".
  const idealUtil = 0.4;
  const spaceUtilization = clamp01(1 - Math.abs(utilization - idealUtil) / idealUtil);

  const themeAlignment = themeAlignmentScore(style, theme);

  let clearanceSum = 0;
  let pairs = 0;
  for (let i = 0; i < layout.placements.length; i++) {
    for (let j = i + 1; j < layout.placements.length; j++) {
      pairs++;
      const a = layout.placements[i];
      const b = layout.placements[j];
      const gap = Math.hypot(a.x_cm - b.x_cm, a.y_cm - b.y_cm);
      clearanceSum += gap;
    }
  }
  const avgClearance = pairs ? clearanceSum / pairs : widthCm;
  const accessibility = clamp01(avgClearance / (Math.max(lengthCm, widthCm) * 0.6));

  const estimatedCost = layout.placements.length * estimatedCostPerItem;
  const budgetCompatibility = budget ? clamp01(1 - Math.max(0, estimatedCost - budget) / budget) : 0.85;

  const aesthetic = clamp01(spaceUtilization * 0.45 + themeAlignment * 0.35 + accessibility * 0.2);

  const total = clamp01(
    aesthetic * 0.3 + themeAlignment * 0.2 + spaceUtilization * 0.2 + accessibility * 0.15 + budgetCompatibility * 0.15
  );

  return { aesthetic, themeAlignment, spaceUtilization, accessibility, budgetCompatibility, total };
}

export function rankCandidates(
  candidates: { style: LayoutStyle; layout: Layout }[],
  dimensions: RoomDimensions,
  theme: string,
  budget: number | null | undefined
): ScoredLayout[] {
  return candidates
    .filter((c) => c.layout.feasible)
    .map((c) => ({
      layout: c.layout,
      scores: scoreLayout(c.layout, c.style, dimensions, theme, budget),
    }))
    .sort((a, b) => b.scores.total - a.scores.total);
}

