/**
 * Theme dressing for the 3D room: skirting and mouldings, a pendant light,
 * wall art, a rug and floor decor. Purely visual — none of it is part of the
 * layout or the constraint checks.
 *
 * Decor may sit in walkways (by design) but never inside furniture, in a
 * door's swing, or in front of a window.
 */
import * as THREE from "three";
import type { Opening, StyleOverrides, WallSide } from "@/shared/types";
import { blocksWindow, doorSwingSquare, gapToWall, inDoorSwing, windowCoverage } from "@/shared/lib/constraintEngine";
import { M, WALL_HEIGHT_CM, box, cylinder, rectPlacement, rectsOverlap, sphere, wallFrame, wallPiece, type Rect } from "./common";
import type { Mats } from "./materials";
import type { DecorKind, PendantKind, ThemeStyle } from "./styles";
import { artTexture, rugTexture } from "./textures";

const WALLS: WallSide[] = ["north", "south", "east", "west"];

/** A placed piece of furniture, as the dressing sees it. */
export interface Piece {
  rect: Rect;
  heightCm: number;
}

export interface ArtInfo {
  wall: WallSide;
  u0: number;
  u1: number;
  y0: number;
  y1: number;
}

export interface Dressing {
  /** Floor-level dressing: rug, decor, pendant. */
  group: THREE.Group;
  /** Wall-mounted dressing, to add to each wall's group so it hides with it. */
  onWall: Record<WallSide, THREE.Group>;
  art: ArtInfo[];
  rug: Rect | null;
  decor: { kind: DecorKind; rect: Rect }[];
  lamps: THREE.PointLight[];
  /** Objects to spin each frame (ceiling-fan blades). */
  spinners: THREE.Object3D[];
}

type Fixtures = NonNullable<StyleOverrides["fixtures"]>;

const PLANT_KINDS: DecorKind[] = ["plant", "tallPlant", "sculpturalPlant", "palm"];
const LAMP_KINDS: DecorKind[] = ["floorLamp", "cageLamp"];

/** The theme's decor list with the user's fixture choices applied. */
function decorFor(style: ThemeStyle, f: Fixtures): DecorKind[] {
  let kinds = [...style.decor];
  if (f.plants === false) kinds = kinds.filter((k) => !PLANT_KINDS.includes(k));
  if (f.plants === true && !kinds.some((k) => PLANT_KINDS.includes(k))) kinds.push("plant");
  if (f.floorLamp === false) kinds = kinds.filter((k) => !LAMP_KINDS.includes(k));
  if (f.floorLamp === true && !kinds.some((k) => LAMP_KINDS.includes(k))) kinds.push("floorLamp");
  return kinds;
}

/** A ceiling fan in the middle of the room, with a light kit; blades spin. */
function ceilingFan(L: number, W: number, m: Mats, group: THREE.Group): THREE.Object3D {
  const [x, z] = [L / 2, W / 2];
  group.add(cylinder(1.2, 1.2, 28, m.metal, x, WALL_HEIGHT_CM - 28, z)); // downrod
  group.add(cylinder(4, 9, 6, m.metal, x, WALL_HEIGHT_CM - 6, z)); // canopy
  group.add(cylinder(11, 11, 11, m.metal, x, WALL_HEIGHT_CM - 40, z)); // motor
  group.add(sphere(7, m.bulb, x, WALL_HEIGHT_CM - 44, z, [1, 0.6, 1])); // light kit
  const rotor = new THREE.Group();
  rotor.position.set(M(x), M(WALL_HEIGHT_CM - 36), M(z));
  const span = Math.min(66, Math.min(L, W) / 2 - 30);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i * Math.PI) / 2;
    const blade = box(span - 10, 1.2, 13, m.body, 10 + (span - 10) / 2, 0, 0);
    blade.rotation.x = 0.12; // a slight pitch, like real blades
    arm.add(blade);
    rotor.add(arm);
  }
  group.add(rotor);
  return rotor;
}

// --- helpers -------------------------------------------------------------------------

/** [start, end] spans along `wall` that are free of the given intervals. */
function freeSpans(from: number, to: number, blocked: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let u = from;
  for (const [a, b] of [...blocked].sort((p, q) => p[0] - q[0])) {
    if (a > u) out.push([u, Math.min(a, to)]);
    u = Math.max(u, b);
    if (u >= to) break;
  }
  if (u < to) out.push([u, to]);
  return out.filter(([a, b]) => b > a);
}

/** Pieces whose back is against `wall`, as [start, end] along it with height. */
function againstWall(wall: WallSide, pieces: Piece[], L: number, W: number): [number, number, number][] {
  return pieces
    .filter(({ rect: [x, y, w, d] }) =>
      wall === "north" ? y <= 40 : wall === "south" ? W - (y + d) <= 40 : wall === "west" ? x <= 40 : L - (x + w) <= 40
    )
    .map(({ rect: [x, y, w, d], heightCm }) =>
      wall === "north" || wall === "south" ? [x, x + w, heightCm] : [y, y + d, heightCm]
    );
}

function edgeDistance(a: Rect, b: Rect): number {
  const dx = Math.max(b[0] - (a[0] + a[2]), a[0] - (b[0] + b[2]), 0);
  const dy = Math.max(b[1] - (a[1] + a[3]), a[1] - (b[1] + b[3]), 0);
  return Math.hypot(dx, dy);
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const d = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  return w > 0 && d > 0 ? w * d : 0;
}

/** True if a floor rect would sit in a door's swing/approach or in front of a window. */
function hitsOpening(rect: Rect, openings: Opening[], L: number, W: number): boolean {
  const p = rectPlacement(rect);
  return openings.some((o) => {
    if (o.kind === "door") {
      const [x1, y1, x2, y2] = doorSwingSquare(o, L, W);
      return inDoorSwing(p, o, L, W) || rectsOverlap(rect, [x1, y1, x2 - x1, y2 - y1]);
    }
    return blocksWindow(p, o, L, W) || (gapToWall(p, o.wall, L, W) <= 30 && windowCoverage(p, o) > 0);
  });
}

// --- wall finishes ------------------------------------------------------------------

function finishWalls(L: number, W: number, openings: Opening[], style: ThemeStyle, m: Mats, onWall: Record<WallSide, THREE.Group>) {
  for (const wall of WALLS) {
    const f = wallFrame(wall, L, W);
    const g = onWall[wall];
    const mine = openings.filter((o) => o.wall === wall);
    const doors = mine.filter((o) => o.kind === "door").map((o): [number, number] => [o.offset_cm, o.offset_cm + o.width_cm]);
    const all = mine.map((o): [number, number] => [o.offset_cm, o.offset_cm + o.width_cm]);
    for (const [a, b] of freeSpans(0, f.span, doors)) g.add(wallPiece(f, a, b, 0, 10, 1.5, -0.75, m.trim)); // skirting

    if (style.wall === "wainscot") {
      g.add(wallPiece(f, 0, f.span, WALL_HEIGHT_CM - 8, WALL_HEIGHT_CM, 5, -2.5, m.trim)); // crown moulding
      for (const [a, b] of freeSpans(0, f.span, all)) {
        g.add(wallPiece(f, a, b, 10, 90, 0.4, -0.2, m.trim)); // panelled lower wall
        g.add(wallPiece(f, a, b, 88, 93, 2.5, -1.25, m.trim)); // chair rail
        const n = Math.max(1, Math.round((b - a) / 65));
        const pw = (b - a) / n;
        for (let i = 0; i < n; i++) {
          const u0 = a + i * pw + 7;
          const u1 = a + (i + 1) * pw - 7;
          if (u1 - u0 < 15) continue;
          for (const y of [20, 76]) g.add(wallPiece(f, u0, u1, y, y + 2, 1.2, -1, m.trim));
          for (const u of [u0, u1 - 2]) g.add(wallPiece(f, u, u + 2, 20, 78, 1.2, -1, m.trim));
        }
      }
    }
  }
}

// --- pendant lighting ----------------------------------------------------------------

function pendants(L: number, W: number, style: ThemeStyle, kind: PendantKind, fan: boolean, m: Mats, group: THREE.Group): THREE.PointLight[] {
  const lamps: THREE.PointLight[] = [];
  // Lights hang along the room's long axis: one in the middle, or a row of
  // three cages. With a ceiling fan in the middle they move clear of its blades.
  const long = L >= W;
  const at = (offset: number): [number, number] => (long ? [L / 2 + offset, W / 2] : [L / 2, W / 2 + offset]);
  const clear = Math.min(100, Math.max(L, W) / 4);
  const gap = Math.min(70, Math.max(L, W) / 5);
  const offsets = fan
    ? kind === "cage" ? [-clear, clear] : [clear]
    : kind === "cage" ? [-gap, 0, gap] : [0];
  const spots = offsets.map(at);
  const wire = new THREE.LineBasicMaterial({ color: "#1c1c1e" });
  for (const [x, z] of spots) {
    const bulbY = kind === "disc" ? 224 : kind === "chandelier" ? 195 : 205;
    group.add(cylinder(0.4, 0.4, WALL_HEIGHT_CM - bulbY, m.dark, x, bulbY, z));
    switch (kind) {
      case "cone":
        group.add(cylinder(2, 19, 22, m.metal, x, bulbY - 10, z));
        group.add(sphere(4, m.bulb, x, bulbY - 8, z));
        break;
      case "disc":
        group.add(cylinder(26, 26, 2, m.trim, x, bulbY, z));
        group.add(cylinder(24, 24, 0.5, m.bulb, x, bulbY - 0.4, z));
        break;
      case "globe":
        group.add(sphere(18, m.bulb, x, bulbY - 14, z));
        break;
      case "cage": {
        group.add(sphere(5, m.bulb, x, bulbY - 10, z, [0.8, 1.1, 0.8]));
        const cage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(M(9), M(9), M(22), 6, 2)), wire);
        cage.position.set(M(x), M(bulbY - 10), M(z));
        group.add(cage);
        break;
      }
      case "chandelier": {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(M(30), M(1.2), 8, 32), m.metal);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(M(x), M(bulbY), M(z));
        group.add(ring);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const cx = x + Math.cos(a) * 30;
          const cz = z + Math.sin(a) * 30;
          group.add(cylinder(1.4, 1.4, 9, m.trim, cx, bulbY, cz));
          group.add(sphere(2.6, m.bulb, cx, bulbY + 12, cz, [1, 1.4, 1]));
        }
        group.add(sphere(5, m.metal, x, bulbY - 6, z));
        break;
      }
      case "woven":
        group.add(sphere(26, m.wicker, x, bulbY - 6, z, [1, 0.75, 1]));
        break;
    }
    const lamp = new THREE.PointLight(style.light.lamp, style.light.lampIntensity * 6 / spots.length, 9, 2);
    lamp.position.set(M(x), M(bulbY - 20), M(z));
    group.add(lamp);
    lamps.push(lamp);
  }
  return lamps;
}

// --- wall art --------------------------------------------------------------------------

function wallArt(L: number, W: number, openings: Opening[], pieces: Piece[], style: ThemeStyle, m: Mats, onWall: Record<WallSide, THREE.Group>): ArtInfo[] {
  const out: ArtInfo[] = [];
  const frameMat = style.legs === "metal" || style.legs === "steel" ? m.metal : style.legs === "plinth" ? m.trim : m.body;
  WALLS.forEach((wall, wi) => {
    const f = wallFrame(wall, L, W);
    const along = againstWall(wall, pieces, L, W);
    const blocked: [number, number][] = [
      ...openings.filter((o) => o.wall === wall).map((o): [number, number] => [o.offset_cm - 15, o.offset_cm + o.width_cm + 15]),
      ...along.filter(([, , h]) => h > 130).map(([a, b]): [number, number] => [a - 10, b + 10]),
    ];
    const spans = freeSpans(20, f.span - 20, blocked).filter(([a, b]) => b - a >= 70);
    if (spans.length === 0) return;
    const [a, b] = spans.reduce((p, q) => (q[1] - q[0] > p[1] - p[0] ? q : p));
    const aw = Math.min(b - a - 20, 120, f.span * 0.35);
    if (aw < 50) return;
    // Centre over a bed or sofa on this wall if there is one, else mid-span.
    const low = along.filter(([s0, s1, h]) => h <= 130 && s1 > a && s0 < b);
    const anchor = low.length ? (low[0][0] + low[0][1]) / 2 : (a + b) / 2;
    const centre = Math.min(Math.max(anchor, a + aw / 2), b - aw / 2);
    const y0 = Math.max(130, ...low.map(([, , h]) => h + 25));
    const ah = Math.min(aw > 90 ? aw * 0.62 : aw * 1.25, 90, 240 - y0);
    if (ah < 35) return;
    const [u0, u1] = [centre - aw / 2, centre + aw / 2];
    const g = onWall[wall];
    g.add(wallPiece(f, u0, u1, y0, y0 + ah, 3, -1.5, frameMat));
    // Vary the print by theme and wall, so rooms don't all share one picture.
    const themeSeed = [...style.wood].reduce((s, c) => s + c.charCodeAt(0), 0);
    const print = artTexture(style.colours, themeSeed + wi);
    const canvasMat = new THREE.MeshStandardMaterial({ color: print ? "#ffffff" : style.colours[0], map: print, roughness: 0.9 });
    g.add(wallPiece(f, u0 + 4, u1 - 4, y0 + 4, y0 + ah - 4, 0.5, -3.1, canvasMat));
    out.push({ wall, u0, u1, y0, y1: y0 + ah });
  });
  return out;
}

// --- rug -------------------------------------------------------------------------------

function placeRug(L: number, W: number, openings: Opening[], pieces: Piece[], style: ThemeStyle, show: boolean | undefined, group: THREE.Group): Rect | null {
  if (show === false || (!style.rug && show !== true)) return null;
  const rugKind = style.rug ?? "wool";
  const long = L >= W;
  for (const scale of [1, 0.8, 0.65]) {
    const rw = Math.min(Math.max((long ? L * 0.5 : W * 0.42) * scale, 110), 300);
    const rd = Math.min(Math.max((long ? W * 0.42 : L * 0.5) * scale, 80), 220);
    const [w, d] = long ? [rw, rd] : [rd, rw];
    let best: { rect: Rect; score: number } | null = null;
    for (let x = 30; x + w <= L - 30; x += 10) {
      for (let y = 30; y + d <= W - 30; y += 10) {
        const rect: Rect = [x, y, w, d];
        if (openings.some((o) => o.kind === "door" && inDoorSwing(rectPlacement(rect), o, L, W))) continue;
        // Rugs belong under beds and sofas, not under wardrobes and shelves.
        const score =
          pieces.reduce((s, p) => s + overlapArea(rect, p.rect) * (p.heightCm > 120 ? 5 : 0.3), 0) +
          Math.hypot(x + w / 2 - L / 2, y + d / 2 - W / 2) * 20;
        if (!best || score < best.score) best = { rect, score };
      }
    }
    if (best) {
      const [x, y] = best.rect;
      const tex = rugTexture(rugKind, style.colours);
      const mat = new THREE.MeshStandardMaterial({ color: tex ? "#ffffff" : style.colours[0], map: tex, roughness: 1 });
      const rug = box(w, 0.8, d, mat, x + w / 2, 0, y + d / 2);
      rug.castShadow = false;
      group.add(rug);
      return best.rect;
    }
  }
  return null;
}

// --- floor decor -----------------------------------------------------------------------

const DECOR_SIZE: Record<DecorKind, [number, number, number, "corner" | "beside" | "open"]> = {
  plant: [40, 40, 105, "corner"],
  tallPlant: [50, 50, 170, "corner"],
  sculpturalPlant: [45, 45, 140, "corner"],
  palm: [55, 55, 165, "corner"],
  pouf: [48, 48, 40, "open"],
  floorCushion: [60, 60, 14, "open"],
  floorLamp: [38, 38, 175, "beside"],
  cageLamp: [36, 36, 160, "beside"],
  crate: [45, 38, 45, "beside"],
  sideTable: [45, 45, 62, "beside"],
  sheepskin: [90, 60, 2, "open"],
};

function decorModel(kind: DecorKind, w: number, d: number, h: number, m: Mats): THREE.Group {
  const g = new THREE.Group();
  const r = Math.min(w, d) / 2;
  switch (kind) {
    case "plant":
    case "tallPlant":
    case "palm": {
      const potH = h * (kind === "plant" ? 0.32 : 0.22);
      g.add(cylinder(r * 0.6, r * 0.45, potH, m.pot));
      if (kind !== "plant") g.add(cylinder(1.5, 2, h * 0.55, m.body, 0, potH));
      const crown = kind === "plant" ? potH + (h - potH) / 2 : h * 0.72;
      const leaves = kind === "palm" ? 7 : 5;
      for (let i = 0; i < leaves; i++) {
        const a = (i / leaves) * Math.PI * 2;
        const sr = kind === "palm" ? r * 0.38 : r * 0.42;
        const off = r - sr - 1;
        const y = crown + (kind === "palm" ? (i % 3) * 8 : Math.sin(i * 2.3) * (h - potH) * 0.18);
        const scale: [number, number, number] = kind === "palm" ? [1, 0.25, 1] : [1, 0.85, 1];
        g.add(sphere(sr, i % 2 ? m.leaf : m.leafDark, Math.cos(a) * off, y, Math.sin(a) * off, scale));
      }
      g.add(sphere(r * 0.45, m.leaf, 0, kind === "plant" ? crown + 10 : h - r * 0.45, 0, [1, 0.9, 1]));
      break;
    }
    case "sculpturalPlant": {
      g.add(cylinder(r * 0.6, r * 0.55, 45, m.pot));
      for (let i = 0; i < 6; i++) {
        const leaf = box(5, h - 45 - (i % 3) * 18, 1.2, i % 2 ? m.leaf : m.leafDark, Math.cos(i) * r * 0.3, 45, Math.sin(i) * r * 0.3);
        leaf.rotation.y = i * 0.9;
        g.add(leaf);
      }
      break;
    }
    case "pouf":
      g.add(cylinder(r - 1, r - 1, h - 6, m.cushions[0]));
      g.add(sphere(r - 1, m.cushions[0], 0, h - 6, 0, [1, 0.25, 1]));
      break;
    case "floorCushion":
      g.add(box(w - 4, h, d - 4, m.cushions[2 % m.cushions.length]));
      g.add(sphere(2, m.dark, 0, h, 0, [1, 0.5, 1]));
      break;
    case "sheepskin":
      g.add(sphere(d / 2, m.sheet, 0, 0.6, 0, [w / d, 0.04, 1]));
      break;
    case "floorLamp":
      g.add(cylinder(r - 4, r - 4, 2, m.metal));
      g.add(cylinder(1, 1, h - 26, m.metal, 0, 2));
      g.add(cylinder(r - 6, r - 1, 26, m.trim, 0, h - 26));
      break;
    case "cageLamp": {
      g.add(cylinder(r - 4, r - 2, 3, m.metal));
      g.add(cylinder(1.2, 1.2, h - 24, m.metal, 0, 3));
      g.add(sphere(5, m.bulb, 0, h - 12, 0, [0.8, 1.1, 0.8]));
      const cage = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.CylinderGeometry(M(9), M(9), M(22), 6, 2)),
        new THREE.LineBasicMaterial({ color: "#1c1c1e" })
      );
      cage.position.y = M(h - 12);
      g.add(cage);
      break;
    }
    case "crate":
      g.add(box(w, h, d, m.body));
      for (const y of [12, 26, 40]) g.add(box(w + 0.2, 1.5, d + 0.2, m.dark, 0, y));
      break;
    case "sideTable":
      g.add(cylinder(r - 1, r - 1, 3, m.body, 0, h - 3));
      g.add(cylinder(2.5, 3, h - 3, m.body));
      g.add(cylinder(r * 0.6, r * 0.6, 2, m.body));
      g.add(cylinder(4, 5, 22, m.metal, 0, h)); // lamp base
      g.add(cylinder(10, 14, 16, m.accent, 0, h + 22)); // shade
      break;
  }
  return g;
}

function placeDecor(L: number, W: number, openings: Opening[], pieces: Piece[], kinds: DecorKind[], m: Mats, group: THREE.Group) {
  const placed: { kind: DecorKind; rect: Rect }[] = [];
  for (const kind of kinds) {
    const [w, d, h, pref] = DECOR_SIZE[kind];
    let best: { rect: Rect; score: number } | null = null;
    for (let x = 4; x + w <= L - 4; x += 10) {
      for (let y = 4; y + d <= W - 4; y += 10) {
        const rect: Rect = [x, y, w, d];
        if (pieces.some((p) => rectsOverlap(rect, p.rect, 4))) continue;
        if (placed.some((p) => rectsOverlap(rect, p.rect, 10))) continue;
        if (hitsOpening(rect, openings, L, W)) continue;
        const gaps = [x, y, L - x - w, W - y - d].sort((a, b) => a - b);
        const near = pieces.length ? Math.min(...pieces.map((p) => edgeDistance(rect, p.rect))) : 200;
        let score =
          pref === "corner" ? gaps[0] + gaps[1]
          : pref === "beside" ? near * 2 + gaps[0]
          : Math.abs(near - 20) + Math.hypot(x + w / 2 - L / 2, y + d / 2 - W / 2) * 0.2;
        for (const p of placed) {
          const dist = Math.hypot(p.rect[0] + p.rect[2] / 2 - (x + w / 2), p.rect[1] + p.rect[3] / 2 - (y + d / 2));
          score += Math.max(0, 160 - dist);
        }
        if (!best || score < best.score) best = { rect, score };
      }
    }
    if (!best) continue;
    const model = decorModel(kind, w, d, h, m);
    model.position.set(M(best.rect[0] + w / 2), 0, M(best.rect[1] + d / 2));
    group.add(model);
    placed.push({ kind, rect: best.rect });
  }
  return placed;
}

// --- everything --------------------------------------------------------------------------

export function dressRoom(
  L: number, W: number, openings: Opening[], pieces: Piece[], style: ThemeStyle, m: Mats, fixtures: Fixtures = {}
): Dressing {
  const group = new THREE.Group();
  const onWall = Object.fromEntries(WALLS.map((w) => [w, new THREE.Group()])) as Record<WallSide, THREE.Group>;
  finishWalls(L, W, openings, style, m, onWall);
  const art = wallArt(L, W, openings, pieces, style, m, onWall);
  const rug = placeRug(L, W, openings, pieces, style, fixtures.rug, group);
  const decor = placeDecor(L, W, openings, pieces, decorFor(style, fixtures), m, group);
  const spinners = fixtures.fan ? [ceilingFan(L, W, m, group)] : [];
  const pendant = fixtures.pendant ?? style.pendant;
  const lamps = pendant === "none" ? [] : pendants(L, W, style, pendant, !!fixtures.fan, m, group);
  if (fixtures.fan && pendant === "none") {
    // The fan's light kit still lights the room.
    const kit = new THREE.PointLight(style.light.lamp, style.light.lampIntensity * 4, 9, 2);
    kit.position.set(M(L / 2), M(WALL_HEIGHT_CM - 50), M(W / 2));
    group.add(kit);
    lamps.push(kit);
  }
  return { group, onWall, art, rug, decor, lamps, spinners };
}
