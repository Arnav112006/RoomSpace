/**
 * Builds a three.js model of a room in a theme: floor, walls with real door
 * and window openings, themed furniture at the layout's exact positions and
 * sizes, and theme dressing (finishes, lighting, art, rug, decor).
 */
import * as THREE from "three";
import type { Opening, Placement, Product, ProductCategory, StyleOverrides, WallSide } from "@/shared/types";
import {
  DOOR_HEIGHT_CM, M, WALL_HEIGHT_CM, WALL_THICKNESS_CM, WINDOW_SILL_CM, WINDOW_TOP_CM,
  box, facingOf, footprint, wallFrame, wallPiece, yawFor, type WallFrame,
} from "./common";
import { dressRoom, type ArtInfo } from "./dressing";
import { DEFAULT_HEIGHT_CM, buildModel } from "./furniture";
import { buildMaterials, recolour, type Mats } from "./materials";
import { styleFor, type DecorKind, type ThemeLight, type ThemeStyle } from "./styles";

export { facingOf, footprint, WALL_HEIGHT_CM, type Facing, type Rect } from "./common";
export { THEME_STYLES, paletteFor, styleFor, type ThemePalette, type ThemeStyle } from "./styles";

// --- walls and openings -----------------------------------------------------

function buildWall(wall: WallSide, openings: Opening[], L: number, W: number, m: Mats): THREE.Group {
  const g = new THREE.Group();
  const f = wallFrame(wall, L, W);
  const t = WALL_THICKNESS_CM;
  const H = WALL_HEIGHT_CM;
  const piece = (u0: number, u1: number, y0: number, y1: number) =>
    g.add(wallPiece(f, u0, u1, y0, y1, t, t / 2, m.wall(u1 - u0, y1 - y0)));
  const mine = openings.filter((o) => o.wall === wall).sort((a, b) => a.offset_cm - b.offset_cm);
  let u = -t; // overlap the corners so they close
  const end = f.span + t;
  for (const o of mine) {
    const s0 = Math.max(o.offset_cm, u);
    const s1 = Math.min(o.offset_cm + o.width_cm, f.span);
    if (s1 <= s0) continue;
    if (s0 > u) piece(u, s0, 0, H);
    const bottom = o.kind === "door" ? 0 : WINDOW_SILL_CM;
    const top = o.kind === "door" ? DOOR_HEIGHT_CM : WINDOW_TOP_CM;
    piece(s0, s1, top, H);
    if (bottom > 0) piece(s0, s1, 0, bottom);
    // Frame around the opening.
    for (const s of [s0, s1 - 4]) g.add(wallPiece(f, s, s + 4, bottom, top, t + 2, t / 2, m.trim));
    g.add(wallPiece(f, s0, s1, top - 4, top, t + 2, t / 2, m.trim));
    if (o.kind === "window") {
      g.add(wallPiece(f, s0, s1, bottom, bottom + 4, t + 8, t / 2 - 2, m.trim)); // sill
      g.add(wallPiece(f, s0 + 4, s1 - 4, bottom + 4, top - 4, 1, t / 2, m.glass));
      g.add(wallPiece(f, (s0 + s1) / 2 - 1.5, (s0 + s1) / 2 + 1.5, bottom + 4, top - 4, 2, t / 2, m.trim)); // mullion
    } else {
      g.add(doorLeaf(o, f, m));
    }
    u = s1;
  }
  if (u < end) piece(u, end, 0, H);
  return g;
}

/** The door leaf, standing open at 70° on its hinge, plus its swing arc. */
function doorLeaf(o: Opening, f: WallFrame, m: Mats): THREE.Group {
  const g = new THREE.Group();
  const hingeU = o.hinge === "end" ? o.offset_cm + o.width_cm : o.offset_cm;
  const towardOther = o.hinge === "end" ? -1 : 1;
  const side = o.swing === "outward" ? -1 : 1;
  const a = (70 * Math.PI) / 180;
  const [hx, hz] = f.at(hingeU);
  const dx = Math.cos(a) * towardOther * f.along[0] + Math.sin(a) * side * f.inward[0];
  const dz = Math.cos(a) * towardOther * f.along[1] + Math.sin(a) * side * f.inward[1];
  const w = o.width_cm - 4;
  const leaf = box(w, DOOR_HEIGHT_CM - 4, 4, m.body);
  leaf.position.set(M(hx + (dx * w) / 2), M((DOOR_HEIGHT_CM - 4) / 2), M(hz + (dz * w) / 2));
  leaf.rotation.y = Math.atan2(-dz, dx);
  g.add(leaf);

  if (side === 1) {
    // Swing area on the floor: the zone the constraint engine keeps clear.
    const start = Math.atan2(towardOther * f.along[1], towardOther * f.along[0]);
    const stop = Math.atan2(f.inward[1], f.inward[0]);
    let sweep = stop - start;
    if (sweep > Math.PI) sweep -= 2 * Math.PI;
    if (sweep < -Math.PI) sweep += 2 * Math.PI;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.absarc(0, 0, M(o.width_cm), start, start + sweep, sweep < 0);
    shape.lineTo(0, 0);
    const arc = new THREE.Mesh(
      new THREE.ShapeGeometry(shape, 24),
      new THREE.MeshBasicMaterial({ color: "#c8a45d", transparent: true, opacity: 0.18, side: THREE.DoubleSide })
    );
    // Shape is drawn in the x/y plane with y as plan z; lay it on the floor.
    arc.rotation.x = Math.PI / 2;
    arc.position.set(M(hx), 0.012, M(hz));
    g.add(arc);
  }
  return g;
}

// --- the whole room ------------------------------------------------------------

/**
 * The theme with the user's colour choices on top. Painting the walls of an
 * industrial room paints over the brick; a new floor finish replaces the
 * theme's floor.
 */
export function applyOverrides(style: ThemeStyle, o?: StyleOverrides): ThemeStyle {
  if (!o || (!o.wall && !o.floor && !o.floorKind)) return style;
  return {
    ...style,
    palette: { ...style.palette, ...(o.wall ? { wall: o.wall } : {}), ...(o.floor ? { floor: o.floor } : {}) },
    wall: o.wall && style.wall === "brick" ? "paint" : style.wall,
    floor: o.floorKind ?? style.floor,
  };
}

/** Pieces whose upholstery is their main surface; everything else is recoloured in its wood/carcass. */
const UPHOLSTERED: ProductCategory[] = ["sofa", "bed", "chair"];

export interface RoomItem {
  placement: Placement;
  category: ProductCategory;
  product?: Product;
}

export interface BuiltRoom {
  group: THREE.Group;
  /** Wall groups with their outward normal, for hiding the walls nearest the camera. */
  walls: { group: THREE.Group; outward: THREE.Vector3 }[];
  /** Furniture groups, tagged with userData.itemId for picking. */
  furniture: THREE.Group[];
  /** Theme dressing, for tests and the UI. */
  art: ArtInfo[];
  rug: [number, number, number, number] | null;
  decor: { kind: DecorKind; rect: [number, number, number, number] }[];
  light: ThemeLight;
  /** Spun a little every frame (ceiling-fan blades). */
  spinners: THREE.Object3D[];
  /** Ceiling lights, for tests. */
  lamps: THREE.PointLight[];
  dispose: () => void;
}

export function buildRoom(
  L: number, W: number, openings: Opening[], items: RoomItem[], theme: string, overrides?: StyleOverrides
): BuiltRoom {
  const style = applyOverrides(styleFor(theme), overrides);
  const m = buildMaterials(style);
  const group = new THREE.Group();

  const floor = box(L, 2, W, m.floor(L, W), L / 2, -2, W / 2);
  floor.castShadow = false;
  group.add(floor);

  const walls = (["north", "south", "east", "west"] as WallSide[]).map((side) => {
    const g = buildWall(side, openings, L, W, m);
    group.add(g);
    const f = wallFrame(side, L, W);
    return { side, group: g, outward: new THREE.Vector3(-f.inward[0], 0, -f.inward[1]) };
  });

  const pieces: { rect: [number, number, number, number]; heightCm: number }[] = [];
  const furniture = items.map(({ placement: p, category, product }) => {
    const [ew, ed] = footprint(p);
    const facing = facingOf(p, L, W);
    const sideways = facing === "east" || facing === "west";
    const [w, d] = sideways ? [ed, ew] : [ew, ed];
    const h = product?.height_cm ?? DEFAULT_HEIGHT_CM[category] ?? 60;
    const custom = overrides?.items[p.item_id];
    const model = buildModel(category, w, d, h, style, custom ? recolour(m, style, custom, UPHOLSTERED.includes(category)) : m);
    model.position.set(M(p.x_cm + ew / 2), 0, M(p.y_cm + ed / 2));
    model.rotation.y = yawFor(facing);
    model.userData.itemId = p.item_id;
    group.add(model);
    pieces.push({ rect: [p.x_cm, p.y_cm, ew, ed], heightCm: h });
    return model;
  });

  const dressing = dressRoom(L, W, openings, pieces, style, m, overrides?.fixtures);
  group.add(dressing.group);
  for (const w of walls) w.group.add(dressing.onWall[w.side]);

  return {
    group,
    walls: walls.map(({ group: g, outward }) => ({ group: g, outward })),
    furniture,
    art: dressing.art,
    rug: dressing.rug,
    decor: dressing.decor,
    light: style.light,
    spinners: dressing.spinners,
    lamps: dressing.lamps,
    dispose: () => {
      // Materials are shared between meshes; dispose() is safe to repeat.
      // Cached base textures are kept; per-room tiled copies are freed.
      group.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((mat: THREE.Material) => {
            const map = (mat as THREE.MeshStandardMaterial).map;
            if (map?.userData.owned) map.dispose();
            mat.dispose();
          });
        }
      });
    },
  };
}
