/**
 * Shared geometry helpers for the 3D room.
 *
 * Coordinates follow docs/room-model.md: plan x (east) → world x, plan y
 * (south) → world z, height → world y. One world unit is one metre; every
 * helper here takes centimetres.
 */
import * as THREE from "three";
import type { Placement, WallSide } from "@/shared/types";

export const WALL_HEIGHT_CM = 260;
export const WALL_THICKNESS_CM = 10;
export const DOOR_HEIGHT_CM = 210;
export const WINDOW_SILL_CM = 90;
export const WINDOW_TOP_CM = 210;
/** An item this close to a wall has its back against it. */
export const AGAINST_WALL_CM = 40;

export const M = (cm: number) => cm / 100;

function shadowed<T extends THREE.Mesh>(mesh: T): T {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A box of size w×h×d (cm) whose bottom-centre sits at (x, y, z) cm. */
export function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(M(w), M(h), M(d)), mat);
  mesh.position.set(M(x), M(y + h / 2), M(z));
  return shadowed(mesh);
}

/** A vertical cylinder (or cone) whose bottom-centre sits at (x, y, z) cm. */
export function cylinder(
  rTop: number, rBottom: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, segments = 16
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(M(rTop), M(rBottom), M(h), segments), mat);
  mesh.position.set(M(x), M(y + h / 2), M(z));
  return shadowed(mesh);
}

/** A sphere centred at (x, y, z) cm, optionally squashed per axis. */
export function sphere(r: number, mat: THREE.Material, x = 0, y = 0, z = 0, scale: [number, number, number] = [1, 1, 1]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(M(r), 16, 12), mat);
  mesh.position.set(M(x), M(y), M(z));
  mesh.scale.set(...scale);
  return shadowed(mesh);
}

/** A turned (lathe) shape from [radius, height] cm points, standing at (x, y, z). */
export function lathe(points: [number, number][], mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(M(r), M(h))), 14),
    mat
  );
  mesh.position.set(M(x), M(y), M(z));
  return shadowed(mesh);
}

// --- which way an item faces -------------------------------------------------

export type Facing = "north" | "south" | "east" | "west";

/** Plan-space footprint after rotation: [extent along x, extent along y]. */
export function footprint(p: Placement): [number, number] {
  return p.rotation_deg === 90 || p.rotation_deg === 270 ? [p.depth_cm, p.width_cm] : [p.width_cm, p.depth_cm];
}

/**
 * The direction an item's front faces. Against a wall, its back is to the
 * nearest wall; in the open, rotation decides (0° faces south, as an item
 * against the north wall does).
 */
export function facingOf(p: Placement, lengthCm: number, widthCm: number): Facing {
  const [w, d] = footprint(p);
  const gaps: [Facing, number][] = [
    ["south", p.y_cm], // back to the north wall → faces south
    ["north", widthCm - (p.y_cm + d)],
    ["east", p.x_cm],
    ["west", lengthCm - (p.x_cm + w)],
  ];
  const [nearest, gap] = gaps.reduce((a, b) => (b[1] < a[1] ? b : a));
  if (gap <= AGAINST_WALL_CM) return nearest;
  return ({ 0: "south", 90: "east", 180: "north", 270: "west" } as const)[p.rotation_deg];
}

/** Rotation about world y that turns a model's front (+z) to `facing`. */
export function yawFor(facing: Facing): number {
  return { south: 0, north: Math.PI, east: Math.PI / 2, west: -Math.PI / 2 }[facing];
}

// --- walls ---------------------------------------------------------------------

export interface WallFrame {
  span: number;
  /** Plan point `u` cm along the wall. */
  at: (u: number) => [number, number];
  along: [number, number];
  inward: [number, number];
}

export function wallFrame(wall: WallSide, L: number, W: number): WallFrame {
  switch (wall) {
    case "north":
      return { span: L, at: (u) => [u, 0], along: [1, 0], inward: [0, 1] };
    case "south":
      return { span: L, at: (u) => [u, W], along: [1, 0], inward: [0, -1] };
    case "west":
      return { span: W, at: (u) => [0, u], along: [0, 1], inward: [1, 0] };
    case "east":
      return { span: W, at: (u) => [L, u], along: [0, 1], inward: [-1, 0] };
  }
}

/**
 * A wall-aligned box from u0 to u1 along the wall, y0 to y1 high, `depth`
 * thick, with its centre `offset` cm outward from the room-side wall face
 * (negative: inside the room).
 */
export function wallPiece(
  f: WallFrame, u0: number, u1: number, y0: number, y1: number, depth: number, offset: number, mat: THREE.Material
) {
  const [px, pz] = f.at((u0 + u1) / 2);
  const mesh = box(u1 - u0, y1 - y0, depth, mat);
  mesh.position.set(M(px - f.inward[0] * offset), M(y0 + (y1 - y0) / 2), M(pz - f.inward[1] * offset));
  if (f.along[1] !== 0) mesh.rotation.y = Math.PI / 2;
  return mesh;
}

/** Plan rectangle [x, y, w, d] in cm. */
export type Rect = [number, number, number, number];

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return a[0] < b[0] + b[2] + gap && b[0] < a[0] + a[2] + gap && a[1] < b[1] + b[3] + gap && b[1] < a[1] + a[3] + gap;
}

/** A plan rectangle as a Placement, so constraint-engine checks can run on it. */
export function rectPlacement([x, y, w, d]: Rect, label = "decor"): Placement {
  return { item_id: label, label, x_cm: x, y_cm: y, width_cm: w, depth_cm: d, rotation_deg: 0 };
}
