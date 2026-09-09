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
  | "window"
  | "door"
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
}

export interface RoomResponse extends RoomCreate {
  id: string;
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

export type ParsedCommandAction =
  | { kind: "move"; label: string; target: MoveTarget }
  | { kind: "remove"; label: string }
  | { kind: "add"; itemType: FurnitureType; near?: "window" | "door" | "center" }
  | { kind: "rotate"; label: string }
  | { kind: "unknown"; raw: string };

export type WorkflowStage =
  | "input"
  | "analysis"
  | "model"
  | "studio"
  | "recommendations";

export const STAGE_META: { id: number; key: WorkflowStage | "loop"; title: string }[] = [
  { id: 1, key: "input", title: "Room Input" },
  { id: 2, key: "analysis", title: "Room Analysis & Verification" },
  { id: 3, key: "model", title: "Room Model Creation" },
  { id: 4, key: "loop", title: "Candidate Layout Generation" },
  { id: 5, key: "loop", title: "Hard Constraint Validation" },
  { id: 6, key: "loop", title: "Aesthetic & Preference Scoring" },
  { id: 7, key: "loop", title: "Layout Ranking" },
  { id: 8, key: "loop", title: "Interactive 2D Visualization" },
  { id: 9, key: "loop", title: "User Refinement / Commands" },
  { id: 10, key: "loop", title: "Re-validation & Regeneration" },
  { id: 11, key: "loop", title: "Layout Versioning" },
  { id: 12, key: "recommendations", title: "Product Recommendation" },
];
