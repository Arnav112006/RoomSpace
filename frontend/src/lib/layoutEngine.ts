import type { FurnitureItem, Layout, Placement, RoomDimensions, ScoredLayout } from "../types";
import { roomDimensionsCm } from "./units";
import { validateLayoutLocal } from "./constraintEngine";

// ---------------------------------------------------------------------
// Stage 4 — Candidate Layout Generation
//
// Geometry-and-rules only, deliberately not a generative model: every
// candidate is built by a named placement strategy (a "style") so the
// result is auditable and reproducible, matching the project's design
// goal of controlling exactly what counts as a valid layout.
// ---------------------------------------------------------------------

const WALL_MARGIN_CM = 10;
const ITEM_GAP_CM = 12;

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

/** Places one item flush against `wall`, advancing the wall's cursor. */
function placeOnWall(
  wall: WallSide,
  cursor: number,
  item: FurnitureItem,
  lengthCm: number,
  widthCm: number,
  rotate: boolean
): { placement: Omit<Placement, "item_id" | "label">; nextCursor: number } {
  const rotated = wall === "east" || wall === "west" ? !rotate : rotate;
  const [w, d] = footprintFor(item, rotated);

  let x = 0;
  let y = 0;
  let rotation_deg: 0 | 90 | 180 | 270 = 0;

  if (wall === "north") {
    x = cursor;
    y = WALL_MARGIN_CM;
    rotation_deg = 0;
  } else if (wall === "south") {
    x = cursor;
    y = widthCm - d - WALL_MARGIN_CM;
    rotation_deg = 180;
  } else if (wall === "west") {
    x = WALL_MARGIN_CM;
    y = cursor;
    rotation_deg = 90;
  } else {
    x = lengthCm - w - WALL_MARGIN_CM;
    y = cursor;
    rotation_deg = 270;
  }

  return {
    placement: { x_cm: x, y_cm: y, width_cm: item.width_cm, depth_cm: item.depth_cm, rotation_deg },
    nextCursor: cursor + (wall === "north" || wall === "south" ? w : d) + ITEM_GAP_CM,
  };
}

function wallSpan(wall: WallSide, lengthCm: number, widthCm: number): number {
  return wall === "north" || wall === "south" ? lengthCm : widthCm;
}

/**
 * Runs one placement strategy over the furniture list, returning a
 * single candidate's placements. Fixed items (doors, windows, existing
 * furniture the user marked immovable) are anchored to their given
 * zone first; movable items are then distributed around them.
 */
function buildCandidate(
  items: WorkingItem[],
  dimensions: RoomDimensions,
  style: LayoutStyle
): Placement[] {
  const [lengthCm, widthCm] = roomDimensionsCm(dimensions);
  const cursors: Record<WallSide, number> = { north: WALL_MARGIN_CM, south: WALL_MARGIN_CM, east: WALL_MARGIN_CM, west: WALL_MARGIN_CM };
  const placements: Placement[] = [];

  const fixed = items.filter((w) => w.item.is_fixed);
  const movable = items.filter((w) => !w.item.is_fixed);

  // Anchor fixed items to their stated (or inferred) wall first so
  // movable furniture is generated around them, never on top of them.
  for (const { item, id } of fixed) {
    const wall = zoneToWall(item.approximate_zone) ?? "north";
    const { placement, nextCursor } = placeOnWall(wall, cursors[wall], item, lengthCm, widthCm, false);
    cursors[wall] = nextCursor;
    placements.push({ item_id: id, label: item.label, ...placement });
  }

  // Style controls ordering and which walls get priority — this is
  // what makes each candidate visibly different rather than a shuffled
  // duplicate of the others.
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

  let wallIdx = 0;
  for (const { item, id } of order) {
    let placed = false;
    for (let attempt = 0; attempt < wallSequence.length; attempt++) {
      const wall = wallSequence[(wallIdx + attempt) % wallSequence.length];
      const span = wallSpan(wall, lengthCm, widthCm);
      const rotate = style === "symmetric" && attempt % 2 === 1;
      const [w] = footprintFor(item, wall === "east" || wall === "west" ? !rotate : rotate);
      if (cursors[wall] + w + WALL_MARGIN_CM <= span) {
        const { placement, nextCursor } = placeOnWall(wall, cursors[wall], item, lengthCm, widthCm, rotate);
        cursors[wall] = nextCursor;
        placements.push({ item_id: id, label: item.label, ...placement });
        wallIdx = (wallIdx + attempt + 1) % wallSequence.length;
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Perimeter is full — drop it toward the room's free interior.
      // This may be infeasible (flagged by the constraint engine),
      // which is the intended signal that the room is over-furnished.
      const [w, d] = footprintFor(item, false);
      placements.push({
        item_id: id,
        label: item.label,
        x_cm: Math.max(WALL_MARGIN_CM, (lengthCm - w) / 2),
        y_cm: Math.max(WALL_MARGIN_CM, (widthCm - d) / 2),
        width_cm: item.width_cm,
        depth_cm: item.depth_cm,
        rotation_deg: 0,
      });
    }
  }

  return placements;
}

export function generateCandidates(
  furniture: FurnitureItem[],
  dimensions: RoomDimensions,
  roomId: string
): { style: LayoutStyle; layout: Layout }[] {
  const items: WorkingItem[] = furniture.map((item, i) => ({ item, id: `item-${i}-${item.type}` }));
  const styles: LayoutStyle[] = ["wall-hug", "zoned", "symmetric", "corner-focused"];

  return styles.map((style) => {
    const placements = buildCandidate(items, dimensions, style);
    const { feasible, violations } = validateLayoutLocal(dimensions, placements);
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

