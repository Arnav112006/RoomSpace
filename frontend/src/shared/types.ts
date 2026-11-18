// Mirrors backend/app/schemas/*.py so the frontend and API never disagree
// on shape. Keep in sync by hand until the backend ships an OpenAPI client.

export type FurnitureType =
  | "bed"
  | "wardrobe"
  | "table"
  | "chair"
  | "desk"
  | "sofa"
  | "shelf"
  | "other";

export interface FurnitureItem {
  type: FurnitureType;
  label: string;
  width_cm: number;
  depth_cm: number;
  approximate_zone?: string | null;
  is_fixed: boolean;
  source: "vision" | "manual";
}

export type LengthUnit = "cm" | "m" | "ft";

// Doors and windows — docs/room-model.md §4. Not furniture: never moved,
// scored or recommended. Stored as wall + offset + width.
export type WallSide = "north" | "south" | "east" | "west";
export type OpeningKind = "door" | "window";

export interface Opening {
  id: string;
  kind: OpeningKind;
  wall: WallSide;
  /** From the west end (north/south walls) or north end (east/west walls). */
  offset_cm: number;
  width_cm: number;
  hinge?: "start" | "end" | null; // doors only
  swing?: "inward" | "outward" | null; // doors only
}

export interface RoomDimensions {
  length: number;
  width: number;
  unit: LengthUnit;
}

export interface RoomCreate {
  dimensions: RoomDimensions;
  room_type: string;
  theme: string;
  occasion?: string | null;
  budget?: number | null;
  openings?: Opening[];
}

export interface RoomResponse extends RoomCreate {
  id: string;
  openings: Opening[];
  furniture: FurnitureItem[];
}

export interface Placement {
  item_id: string;
  label: string;
  x_cm: number;
  y_cm: number;
  width_cm: number;
  depth_cm: number;
  rotation_deg: 0 | 90 | 180 | 270;
}

export interface Layout {
  id: string;
  room_id: string;
  placements: Placement[];
  feasible: boolean;
  violations: string[];
}

export type ProductCategory =
  | "bed"
  | "wardrobe"
  | "table"
  | "chair"
  | "desk"
  | "sofa"
  | "shelf"
  | "lamp"
  | "decor"
  | "other";

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  image_url: string;
  product_url: string;
  price: number;
  width_cm: number;
  depth_cm: number;
  height_cm?: number | null;
  theme?: string | null;
}

// ---------------------------------------------------------------------
// Frontend-only workflow types (stages the current backend doesn't yet
// expose an endpoint for: 4/6/7 candidate generation+scoring+ranking,
// 9 command parsing, 11 versioning, 12 recommendation). These run
// client-side today and are written so a matching backend route can
// swap in later without touching the UI.
// ---------------------------------------------------------------------

export interface ScoredLayout {
  layout: Layout;
  scores: {
    aesthetic: number;
    themeAlignment: number;
    spaceUtilization: number;
    accessibility: number;
    budgetCompatibility: number;
    total: number;
  };
}

export interface LayoutVersion {
  id: string;
  label: string;
  createdAt: number;
  placements: Placement[];
  feasible: boolean;
  violations: string[];
  note: string;
}

export type MoveTarget = "left-wall" | "right-wall" | "back-wall" | "front-wall" | "window" | "center";

/** Ceiling-light styles the 3D view can draw. */
export type PendantStyle = "cone" | "disc" | "globe" | "cage" | "chandelier" | "woven";
/** Room fixtures and dressing the user can add or remove by command. */
export type FixtureKind = "pendant" | "fan" | "rug" | "plants" | "floorLamp";

/** Floor finishes the 3D view can draw. */
export type FloorFinish = "greyTiles" | "paleTiles" | "oakPlanks" | "concrete" | "herringbone" | "terracotta";

export type ParsedCommandAction =
  | { kind: "move"; label: string; target: MoveTarget }
  | { kind: "remove"; label: string }
  | { kind: "add"; itemType: FurnitureType; near?: "window" | "door" | "center" }
  | { kind: "rotate"; label: string }
  // Appearance only — these never change the layout or its feasibility.
  | { kind: "colour"; target: "walls" | "floor" | "item"; label?: string; colour: string; name: string }
  | { kind: "floor"; floor: FloorFinish; colour: string; name: string }
  | { kind: "fixture"; fixture: FixtureKind; on: boolean; variant?: PendantStyle }
  | { kind: "theme"; theme: string }
  | { kind: "reset-style" }
  | { kind: "unknown"; raw: string; hint?: string };

/** Colours the user set by command or took from their photos; visual only. */
export interface StyleOverrides {
  wall?: string;
  floor?: string;
  floorKind?: FloorFinish;
  /** placement item_id -> colour of that piece's main material. */
  items: Record<string, string>;
  /** Fixtures switched on/off by command; unset means the theme's default. */
  fixtures?: {
    pendant?: PendantStyle | "none";
    fan?: boolean;
    rug?: boolean;
    plants?: boolean;
    floorLamp?: boolean;
  };
}

/** Mirrors backend/app/schemas/style.py. */
export interface StyleSuggestion {
  themes: { theme: string; score: number }[];
  palette: string[];
  wall: string;
  floor: string;
}
