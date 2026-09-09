import type { RoomDimensions } from "../types";

const UNIT_TO_CM: Record<string, number> = { cm: 1, m: 100, ft: 30.48 };

/** Mirrors backend/app/services/units.py::room_dimensions_cm */
export function roomDimensionsCm(dimensions: RoomDimensions): [number, number] {
  const factor = UNIT_TO_CM[dimensions.unit] ?? 1;
  return [dimensions.length * factor, dimensions.width * factor];
}

export function cmToUnit(cm: number, unit: string): number {
  const factor = UNIT_TO_CM[unit] ?? 1;
  return cm / factor;
}

export function formatCm(cm: number): string {
  return `${Math.round(cm)} cm`;
}
