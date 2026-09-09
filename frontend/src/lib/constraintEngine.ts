import type { Placement, RoomDimensions } from "../types";
import { roomDimensionsCm } from "./units";

// Mirrors backend/app/services/constraint_engine.py exactly, so a
// layout that passes here will also pass server-side validation.
// The server call in validateLayoutRemote remains the source of truth
// for stages 5/10 — this lets stage 4 discard obviously-bad candidates
// without a round trip per candidate.

export const DEFAULT_MIN_CLEARANCE_CM = 75;

function effectiveFootprint(p: Placement): [number, number] {
  if (p.rotation_deg === 90 || p.rotation_deg === 270) return [p.depth_cm, p.width_cm];
  return [p.width_cm, p.depth_cm];
}

function bbox(p: Placement): [number, number, number, number] {
  const [w, d] = effectiveFootprint(p);
  return [p.x_cm, p.y_cm, p.x_cm + w, p.y_cm + d];
}

export function withinBounds(p: Placement, lengthCm: number, widthCm: number): boolean {
  const [x1, y1, x2, y2] = bbox(p);
  return x1 >= 0 && y1 >= 0 && x2 <= lengthCm && y2 <= widthCm;
}

export function overlaps(a: Placement, b: Placement): boolean {
  const [ax1, ay1, ax2, ay2] = bbox(a);
  const [bx1, by1, bx2, by2] = bbox(b);
  return !(ax2 <= bx1 || bx2 <= ax1 || ay2 <= by1 || by2 <= ay1);
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

export function validateLayoutLocal(
  dimensions: RoomDimensions,
  placements: Placement[],
  minClearanceCm = DEFAULT_MIN_CLEARANCE_CM
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
        if (gap < minClearanceCm) {
          violations.push(
            `Only ${Math.round(gap)}cm between ${a.label} and ${b.label} (minimum ${minClearanceCm.toFixed(0)}cm)`
          );
        }
      }
    }
  }

  return { feasible: violations.length === 0, violations };
}
