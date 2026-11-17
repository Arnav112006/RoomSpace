import type { Opening, Placement, RoomDimensions, WallSide } from "@/shared/types";
import { roomDimensionsCm } from "./units";

// Mirrors backend/app/services/constraint_engine.py exactly, so a
// layout that passes here will also pass server-side validation.
// The server call in validateLayoutRemote remains the source of truth
// for stages 5/10 — this lets stage 4 discard obviously-bad candidates
// without a round trip per candidate.

// docs/room-model.md §7
export const MIN_CLEARANCE_CM = 75;
export const WINDOW_BACK_GAP_CM = 30;
export const WINDOW_BLOCK_RATIO = 0.8;
export const EPSILON_CM = 1e-6;

type Rect = [number, number, number, number]; // x1, y1, x2, y2

function effectiveFootprint(p: Placement): [number, number] {
  if (p.rotation_deg === 90 || p.rotation_deg === 270) return [p.depth_cm, p.width_cm];
  return [p.width_cm, p.depth_cm];
}

function bbox(p: Placement): Rect {
  const [w, d] = effectiveFootprint(p);
  return [p.x_cm, p.y_cm, p.x_cm + w, p.y_cm + d];
}

// --- furniture vs room / furniture ------------------------------------

export function withinBounds(p: Placement, lengthCm: number, widthCm: number): boolean {
  const [x1, y1, x2, y2] = bbox(p);
  return x1 >= -EPSILON_CM && y1 >= -EPSILON_CM && x2 <= lengthCm + EPSILON_CM && y2 <= widthCm + EPSILON_CM;
}

export function overlaps(a: Placement, b: Placement): boolean {
  const [ax1, ay1, ax2, ay2] = bbox(a);
  const [bx1, by1, bx2, by2] = bbox(b);
  return !(
    ax2 <= bx1 + EPSILON_CM ||
    bx2 <= ax1 + EPSILON_CM ||
    ay2 <= by1 + EPSILON_CM ||
    by2 <= ay1 + EPSILON_CM
  );
}

export function clearanceBetween(a: Placement, b: Placement): number {
  const [ax1, ay1, ax2, ay2] = bbox(a);
  const [bx1, by1, bx2, by2] = bbox(b);
  const xGap = Math.max(bx1 - ax2, ax1 - bx2);
  const yGap = Math.max(by1 - ay2, ay1 - by2);
  if (xGap < 0 && yGap < 0) return Math.max(xGap, yGap);
  if (xGap < 0) return yGap;
  if (yGap < 0) return xGap;
  return Math.sqrt(xGap ** 2 + yGap ** 2);
}

// --- openings (docs/room-model.md §4–6) --------------------------------

export function wallLength(wall: WallSide, lengthCm: number, widthCm: number): number {
  return wall === "north" || wall === "south" ? lengthCm : widthCm;
}

export function openingSpan(o: Opening): [number, number] {
  return [o.offset_cm, o.offset_cm + o.width_cm];
}

/** Problems with the openings themselves; empty means they're usable. */
export function openingFitErrors(openings: Opening[], lengthCm: number, widthCm: number): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const o of openings) {
    if (seen.has(o.id)) errors.push(`Duplicate opening id '${o.id}'`);
    seen.add(o.id);
    const [, end] = openingSpan(o);
    const length = wallLength(o.wall, lengthCm, widthCm);
    if (end > length + EPSILON_CM) {
      errors.push(
        `The ${o.kind} on the ${o.wall} wall runs past the end of the wall (ends at ${end.toFixed(0)}cm, wall is ${length.toFixed(0)}cm)`
      );
    }
  }
  for (let i = 0; i < openings.length; i++) {
    for (let j = i + 1; j < openings.length; j++) {
      const a = openings[i];
      const b = openings[j];
      if (a.wall !== b.wall) continue;
      const [a0, a1] = openingSpan(a);
      const [b0, b1] = openingSpan(b);
      if (a0 < b1 - EPSILON_CM && b0 < a1 - EPSILON_CM) {
        errors.push(`The ${a.kind} and the ${b.kind} on the ${a.wall} wall overlap`);
      }
    }
  }
  return errors;
}

export function doorSwingSquare(door: Opening, lengthCm: number, widthCm: number): Rect {
  const [s0, s1] = openingSpan(door);
  const w = door.width_cm;
  switch (door.wall) {
    case "north":
      return [s0, 0, s1, w];
    case "south":
      return [s0, widthCm - w, s1, widthCm];
    case "west":
      return [0, s0, w, s1];
    default:
      return [lengthCm - w, s0, lengthCm, s1];
  }
}

export function wallPoint(wall: WallSide, along: number, lengthCm: number, widthCm: number): [number, number] {
  switch (wall) {
    case "north":
      return [along, 0];
    case "south":
      return [along, widthCm];
    case "west":
      return [0, along];
    default:
      return [lengthCm, along];
  }
}

export function doorHingePoint(door: Opening, lengthCm: number, widthCm: number): [number, number] {
  const [s0, s1] = openingSpan(door);
  return wallPoint(door.wall, door.hinge === "end" ? s1 : s0, lengthCm, widthCm);
}

/** Inward doors only: does the item reach into the quarter-disc swing? */
export function inDoorSwing(p: Placement, door: Opening, lengthCm: number, widthCm: number): boolean {
  if (door.kind !== "door" || door.swing === "outward") return false;
  const [sx1, sy1, sx2, sy2] = doorSwingSquare(door, lengthCm, widthCm);
  const [px1, py1, px2, py2] = bbox(p);
  const cx1 = Math.max(sx1, px1);
  const cy1 = Math.max(sy1, py1);
  const cx2 = Math.min(sx2, px2);
  const cy2 = Math.min(sy2, py2);
  if (cx2 - cx1 <= EPSILON_CM || cy2 - cy1 <= EPSILON_CM) return false;
  const [hx, hy] = doorHingePoint(door, lengthCm, widthCm);
  const nx = Math.min(Math.max(hx, cx1), cx2);
  const ny = Math.min(Math.max(hy, cy1), cy2);
  return Math.hypot(nx - hx, ny - hy) < door.width_cm - EPSILON_CM;
}

export function windowCoverage(p: Placement, window: Opening): number {
  const [x1, y1, x2, y2] = bbox(p);
  const [lo, hi] = window.wall === "north" || window.wall === "south" ? [x1, x2] : [y1, y2];
  const [s0, s1] = openingSpan(window);
  return Math.max(0, Math.min(hi, s1) - Math.max(lo, s0)) / window.width_cm;
}

export function gapToWall(p: Placement, wall: WallSide, lengthCm: number, widthCm: number): number {
  const [x1, y1, x2, y2] = bbox(p);
  switch (wall) {
    case "north":
      return y1;
    case "south":
      return widthCm - y2;
    case "west":
      return x1;
    default:
      return lengthCm - x2;
  }
}

export function blocksWindow(p: Placement, window: Opening, lengthCm: number, widthCm: number): boolean {
  if (window.kind !== "window") return false;
  const nearWall = gapToWall(p, window.wall, lengthCm, widthCm) <= WINDOW_BACK_GAP_CM + EPSILON_CM;
  return nearWall && windowCoverage(p, window) >= WINDOW_BLOCK_RATIO - EPSILON_CM;
}

/** The opening an item conflicts with (door swing or blocked window), if any. */
export function conflictingOpening(
  p: Placement,
  openings: Opening[],
  lengthCm: number,
  widthCm: number
): Opening | null {
  return (
    openings.find((o) => inDoorSwing(p, o, lengthCm, widthCm) || blocksWindow(p, o, lengthCm, widthCm)) ?? null
  );
}

// --- the whole layout --------------------------------------------------

export function validateLayoutLocal(
  dimensions: RoomDimensions,
  placements: Placement[],
  minClearanceCm = MIN_CLEARANCE_CM,
  openings: Opening[] = []
): { feasible: boolean; violations: string[] } {
  const violations: string[] = [];
  const [lengthCm, widthCm] = roomDimensionsCm(dimensions);

  for (const p of placements) {
    if (!withinBounds(p, lengthCm, widthCm)) {
      violations.push(`${p.label} extends outside the room boundary`);
    }
  }

  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i];
      const b = placements[j];
      if (overlaps(a, b)) {
        violations.push(`${a.label} overlaps with ${b.label}`);
      } else {
        const gap = clearanceBetween(a, b);
        if (gap < minClearanceCm - EPSILON_CM) {
          violations.push(
            `Only ${Math.round(gap)}cm between ${a.label} and ${b.label} (minimum ${minClearanceCm.toFixed(0)}cm)`
          );
        }
      }
    }
  }

  for (const p of placements) {
    for (const o of openings) {
      if (inDoorSwing(p, o, lengthCm, widthCm)) {
        violations.push(`${p.label} blocks the door on the ${o.wall} wall`);
      } else if (blocksWindow(p, o, lengthCm, widthCm)) {
        violations.push(`${p.label} blocks the window on the ${o.wall} wall`);
      }
    }
  }

  return { feasible: violations.length === 0, violations };
}
