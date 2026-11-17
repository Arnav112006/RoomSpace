import type { FurnitureType } from "@/shared/types";

/**
 * Typical footprint (width × depth, cm) for each furniture type. Used
 * wherever the app has to invent a size: requested furniture with no
 * photo, "add a chair" commands, and the Stage 1 preview. Mirrors
 * _DEFAULT_DIMENSIONS_CM in backend/app/services/room_analysis.py.
 */
export const DEFAULT_FOOTPRINT_CM: Record<FurnitureType, [number, number]> = {
  bed: [150, 200],
  wardrobe: [120, 60],
  table: [140, 80],
  chair: [45, 45],
  desk: [120, 60],
  sofa: [180, 90],
  shelf: [90, 30],
  other: [60, 60],
};

export function defaultFootprint(type: string): [number, number] {
  return DEFAULT_FOOTPRINT_CM[type as FurnitureType] ?? DEFAULT_FOOTPRINT_CM.other;
}

/** Words that refer to each furniture type, checked in this order. */
export const FURNITURE_SYNONYMS: [FurnitureType, string[]][] = [
  ["bed", ["bed"]],
  ["wardrobe", ["wardrobe", "closet", "cupboard"]],
  ["table", ["table", "coffee table", "dining table", "side table"]],
  ["chair", ["chair", "armchair", "recliner"]],
  ["desk", ["desk", "workstation"]],
  ["sofa", ["sofa", "couch", "settee"]],
  ["shelf", ["shelf", "bookshelf", "shelving", "bookcase"]],
];

/** The furniture type a piece of text mentions, or null if none. */
export function furnitureTypeIn(text: string): FurnitureType | null {
  const lower = text.toLowerCase();
  for (const [type, words] of FURNITURE_SYNONYMS) {
    if (words.some((w) => lower.includes(w))) return type;
  }
  return null;
}
