/**
 * Furniture models in each theme's construction style.
 *
 * Every model is built at the origin: width along x, depth along z, back at
 * -z, front at +z, standing on y = 0, all in cm. Every part stays inside the
 * w×d footprint (tests check this for every theme), so the 3D view never
 * shows furniture larger than the layout the constraint engine checked.
 */
import * as THREE from "three";
import type { ProductCategory } from "@/shared/types";
import { M, box, cylinder, lathe, sphere } from "./common";
import type { Mats } from "./materials";
import type { LegStyle, ThemeStyle } from "./styles";

export const DEFAULT_HEIGHT_CM: Partial<Record<ProductCategory, number>> = {
  bed: 100, wardrobe: 200, table: 75, chair: 85, desk: 75, sofa: 82, shelf: 180, lamp: 150, decor: 40,
};

/** Profile of a turned (lathe) leg h cm tall; widest radius 3 cm. */
function turnedProfile(h: number): [number, number][] {
  return [
    [0, 0], [2.2, 0], [2.6, h * 0.05], [1.7, h * 0.14], [2.8, h * 0.3], [1.5, h * 0.5],
    [2.2, h * 0.68], [1.6, h * 0.82], [3, h * 0.9], [3, h], [0, h],
  ];
}

/** Four legs h cm tall in the theme's style, inset from the footprint corners. */
function legs(g: THREE.Group, w: number, d: number, h: number, style: LegStyle, m: Mats, inset = 4, y = 0) {
  const r = style === "turned" ? 3 : style === "tapered" ? 2.6 : style === "steel" ? 2 : 1.25;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - inset - r);
      const z = sz * (d / 2 - inset - r);
      if (style === "turned") g.add(lathe(turnedProfile(h), m.body, x, y, z));
      else if (style === "tapered") g.add(cylinder(2.6, 1.5, h, m.body, x, y, z));
      else if (style === "steel") g.add(box(4, h, 4, m.metal, x, y, z));
      else g.add(box(2.5, h, 2.5, m.metal, x, y, z));
    }
  }
  if (style === "steel") {
    // Welded stretchers between the legs.
    for (const sz of [-1, 1]) g.add(box(w - 2 * inset, 3, 3, m.metal, 0, y + 8, sz * (d / 2 - inset - 2)));
  }
}

/** A horizontal cylinder (bolster, rolled arm) running along z. */
function roll(r: number, len: number, mat: THREE.Material, x: number, y: number, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(M(r), M(r), M(len), 18), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(M(x), M(y), M(z));
  mesh.castShadow = true;
  return mesh;
}

/** Small round buttons on a vertical face (tufting, knobs). */
function buttons(g: THREE.Group, mat: THREE.Material, xs: number[], ys: number[], z: number, r = 1.2) {
  for (const x of xs) for (const y of ys) g.add(sphere(r, mat, x, y, z, [1, 1, 0.5]));
}

function spread(from: number, to: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => from + ((to - from) * (i + 0.5)) / n);
}

// --- beds -------------------------------------------------------------------------

function bed(g: THREE.Group, w: number, d: number, h: number, s: ThemeStyle, m: Mats) {
  const L = s.legs;
  const legH = { metal: 12, plinth: 9, tapered: 14, steel: 14, turned: 16, low: 0 }[L];
  const frameH = L === "low" ? 22 : 16;
  const back = -d / 2;
  if (L === "plinth") g.add(box(w - 12, legH, d - 12, m.dark));
  else if (L !== "low") legs(g, w, d, legH, L, m, 5);
  g.add(box(w, frameH, d, m.body, 0, legH));
  const top = legH + frameH;
  g.add(box(w - 6, 20, d - 14, m.sheet, 0, top, 5)); // mattress
  g.add(box(w - 4, 6, d * 0.58, m.cushions[1 % m.cushions.length], 0, top + 17, d / 2 - (d * 0.58) / 2 - 3)); // duvet
  for (const sx of [-1, 1]) g.add(box(w / 2 - 14, 12, 30, m.sheet, (sx * w) / 4, top + 20, back + 30));
  const extra = L === "low" ? 3 : L === "turned" || L === "metal" ? 2 : 0;
  for (let i = 0; i < extra; i++) {
    const x = (i - (extra - 1) / 2) * (w / (extra + 1));
    g.add(box(34, 30, 12, m.cushions[(i + 2) % m.cushions.length], x, top + 20, back + 48));
  }

  // Headboard: the clearest theme signal on a bed.
  switch (L) {
    case "metal": // upholstered, button-tufted panel
      g.add(box(w, 62, 9, m.fabric, 0, top - 6, back + 4.5));
      buttons(g, m.dark, spread(-w / 2, w / 2, Math.round(w / 22)), [top + 18, top + 38], back + 9);
      break;
    case "plinth":
      g.add(box(w, 32, 6, m.body, 0, top - 6, back + 3));
      break;
    case "tapered": // slatted oak
      for (const sx of [-1, 1]) g.add(box(5, top + 70, 5, m.body, sx * (w / 2 - 2.5), 0, back + 2.5));
      g.add(box(w, 6, 5, m.body, 0, top + 64, back + 2.5));
      for (const x of spread(-w / 2 + 5, w / 2 - 5, Math.round(w / 15))) g.add(box(6, 60, 2.5, m.body, x, top + 4, back + 2.5));
      break;
    case "steel": // pipe frame
      for (const sx of [-1, 1]) g.add(cylinder(2, 2, top + 82, m.metal, sx * (w / 2 - 2), 0, back + 2));
      for (const y of [top + 40, top + 78]) g.add(box(w - 4, 3, 3, m.metal, 0, y, back + 2));
      for (const x of spread(-w / 2 + 4, w / 2 - 4, Math.round(w / 22))) g.add(cylinder(1, 1, 38, m.metal, x, top + 41, back + 2));
      break;
    case "turned": { // carved panel between turned posts, with a footboard
      for (const sx of [-1, 1]) {
        g.add(lathe(turnedProfile(top + 100), m.body, sx * (w / 2 - 3), 0, back + 3));
        g.add(sphere(3, m.body, sx * (w / 2 - 3), top + 102, back + 3));
        g.add(lathe(turnedProfile(top + 22), m.body, sx * (w / 2 - 3), 0, d / 2 - 3));
      }
      g.add(box(w - 12, 84, 5, m.body, 0, top - 6, back + 3));
      g.add(box(w - 34, 52, 1.5, m.body, 0, top + 10, back + 6.2));
      g.add(box(w * 0.45, 12, 5, m.body, 0, top + 78, back + 3));
      g.add(box(w - 12, 22, 4, m.body, 0, top - 4, d / 2 - 2));
      break;
    }
    case "low": // woven cane
      g.add(box(w, 78, 6, m.wicker, 0, top - 10, back + 3));
      g.add(box(w, 5, 7, m.body, 0, top + 66, back + 3.5));
      break;
  }

  // Four-posters (canopy beds) get posts, rails and, in soft themes, drapes.
  if (h > 150) {
    const post = L === "steel" || L === "metal" ? m.metal : m.body;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) g.add(box(6, h, 6, post, sx * (w / 2 - 3), 0, sz * (d / 2 - 3)));
      g.add(box(6, 6, d, post, sx * (w / 2 - 3), h - 6, 0));
    }
    for (const sz of [-1, 1]) g.add(box(w, 6, 6, post, 0, h - 6, sz * (d / 2 - 3)));
    if (L === "low" || L === "tapered" || L === "turned") {
      const drape = new THREE.MeshStandardMaterial({ color: "#fbf7ef", transparent: true, opacity: 0.5, side: THREE.DoubleSide, roughness: 1 });
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const panel = new THREE.Mesh(new THREE.PlaneGeometry(M(30), M(h - 20)), drape);
          panel.rotation.y = Math.PI / 2;
          panel.position.set(M(sx * (w / 2 - 4)), M(h / 2 + 4), M(sz * (d / 2 - 20)));
          g.add(panel);
        }
      }
    }
  }
}

// --- sofas ------------------------------------------------------------------------

function sofa(g: THREE.Group, w: number, d: number, hIn: number, s: ThemeStyle, m: Mats) {
  const L = s.legs;
  const h = L === "low" ? Math.min(hIn, 72) : hIn;
  const legH = { metal: 12, plinth: 4, tapered: 14, steel: 10, turned: 8, low: 0 }[L];
  const seatH = L === "low" ? 34 : 44;
  const arm = { metal: 10, plinth: 18, tapered: 14, steel: 18, turned: 16, low: 0 }[L];
  const baseH = seatH - 14 - legH;
  if (L === "plinth") g.add(box(w - 8, legH, d - 8, m.dark));
  else if (L === "turned") {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(sphere(5, m.body, sx * (w / 2 - 7), 4, sz * (d / 2 - 7), [1, 0.8, 1]));
  } else if (L !== "low") legs(g, w, d, legH, L, m, 6);
  g.add(box(w, baseH, d, L === "low" ? m.body : m.fabric, 0, legH));

  // Seat cushions between the arms.
  const n = w - 2 * arm > 150 ? 3 : 2;
  const cw = (w - 2 * arm) / n;
  for (let i = 0; i < n; i++) g.add(box(cw - 1, 14, d - 22, m.fabric, -w / 2 + arm + cw * (i + 0.5), legH + baseH, 10));
  // Back.
  g.add(box(w, h - legH - baseH, 18, m.fabric, 0, legH + baseH, -d / 2 + 9));
  if (L === "steel") {
    // Chesterfield-style tufting across the back.
    buttons(g, m.dark, spread(-w / 2 + arm, w / 2 - arm, Math.round((w - 2 * arm) / 16)), [seatH + 14, seatH + 28], -d / 2 + 18);
  } else if (L !== "plinth") {
    for (let i = 0; i < n; i++) g.add(box(cw - 3, h - seatH - 6, 11, m.fabric, -w / 2 + arm + cw * (i + 0.5), seatH, -d / 2 + 23.5));
  }
  // Arms.
  if (arm > 0) {
    const armTop = L === "steel" ? h : L === "plinth" ? seatH + 16 : seatH + 20;
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - arm / 2);
      g.add(box(arm, armTop - legH, d, m.fabric, x, legH));
      if (L === "turned") g.add(roll(arm / 2 + 1, d - 2, m.fabric, sx * (w / 2 - arm / 2 - 1), armTop));
      if (L === "tapered") g.add(roll(arm / 2, d, m.fabric, x, armTop));
    }
  }
  // Scatter cushions; bohemian gets a heap of them.
  const pillows = L === "low" ? 4 : 2;
  const step = (w - 2 * arm - 40) / (pillows - 1);
  for (let i = 0; i < pillows; i++) {
    const x = (i - (pillows - 1) / 2) * step;
    g.add(box(36, 34, 12, m.cushions[(i * 2) % m.cushions.length], x, seatH + 10, -d / 2 + 32));
  }
  if (L === "low" || L === "tapered") {
    // A throw over one arm/end.
    g.add(box(40, 3, d - 6, m.cushions[1 % m.cushions.length], w / 2 - arm - 24, seatH + 0.5, 2));
  }
}

// --- storage -----------------------------------------------------------------------

function wardrobe(g: THREE.Group, w: number, d: number, h: number, s: ThemeStyle, m: Mats) {
  const L = s.legs;
  const front = d / 2;
  let y0 = 0;
  let body = m.body;
  let bodyW = w;
  let bodyD = d;
  if (L === "turned") {
    g.add(box(w, 10, d, m.body)); // base
    g.add(box(w, 6, d, m.body, 0, h - 12)); // crown
    g.add(box(w - 3, 6, d - 2, m.body, 0, h - 6, -1));
    y0 = 10;
    bodyW = w - 4;
    bodyD = d - 3;
    g.add(box(bodyW, h - 22, bodyD, m.body, 0, y0, -1.5));
  } else if (L === "metal") {
    g.add(box(w - 8, 6, d - 8, m.dark));
    y0 = 6;
    g.add(box(w, h - y0, d, m.body, 0, y0));
  } else if (L === "tapered") {
    legs(g, w, d, 14, L, m, 3);
    y0 = 14;
    g.add(box(w, h - y0, d, m.body, 0, y0));
  } else if (L === "low") {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(8, 8, 8, m.body, sx * (w / 2 - 4), 0, sz * (d / 2 - 4)));
    y0 = 8;
    body = m.cushions[1 % m.cushions.length]; // painted carcass
    g.add(box(w, h - y0, d, body, 0, y0));
  } else {
    if (L === "steel") body = m.metal;
    g.add(box(w, h, d, body));
  }
  const bodyH = (L === "turned" ? h - 12 : h) - y0;
  const faceZ = L === "turned" ? -1.5 + bodyD / 2 : front;
  const doors = L === "steel" ? Math.max(2, Math.round(w / 30)) : w > 110 ? 3 : 2;
  const dw = bodyW / doors;
  const gapMat = L === "plinth" ? m.metal : m.dark;

  for (let i = 0; i < doors; i++) {
    const cx = -bodyW / 2 + dw * (i + 0.5);
    if (i > 0) g.add(box(0.8, bodyH - 6, 1, gapMat, -bodyW / 2 + dw * i, y0 + 3, faceZ - 0.4));
    switch (L) {
      case "turned": // raised panels and brass knobs
        for (const py of [y0 + 10, y0 + bodyH / 2 + 4]) g.add(box(dw - 14, bodyH / 2 - 18, 2, m.body, cx, py, faceZ + 0.6));
        g.add(sphere(1.6, m.metal, cx + (i % 2 ? -1 : 1) * (dw / 2 - 6), y0 + bodyH / 2, faceZ + 0.4));
        break;
      case "steel": // locker: vents, handle, label
        for (const vy of [y0 + bodyH - 22, y0 + 12]) {
          for (let k = 0; k < 3; k++) g.add(box(dw * 0.5, 1.2, 0.8, m.dark, cx, vy + k * 3, front - 0.3));
        }
        g.add(box(2, 12, 1.5, m.dark, cx + dw / 2 - 6, y0 + bodyH / 2, front - 0.6));
        g.add(box(8, 3, 0.6, m.trim, cx, y0 + bodyH - 34, front - 0.2));
        break;
      case "low": // woven cane door panels
        g.add(box(dw - 12, bodyH - 30, 1.5, m.wicker, cx, y0 + 15, front - 0.4));
        break;
      case "tapered":
        g.add(sphere(1.8, m.body, cx + (i % 2 ? -1 : 1) * (dw / 2 - 6), y0 + bodyH / 2, front - 0.2));
        break;
      case "metal": // handle-less: a finger groove along the top
        break;
      default: // minimalist: push-to-open, nothing on the front
        break;
    }
  }
  if (L === "metal") g.add(box(w, 2, 1, m.dark, 0, h - 14, front - 0.4));
}

function shelf(g: THREE.Group, w: number, d: number, h: number, s: ThemeStyle, m: Mats) {
  const L = s.legs;
  const n = Math.max(3, Math.round(h / 40));
  const levels = Array.from({ length: n + 1 }, (_, i) => 6 + (i * (h - 12)) / n);
  const shelfMat = L === "low" ? m.wicker : m.body;
  switch (L) {
    case "metal":
    case "steel":
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(L === "steel" ? 3 : 2.5, h, L === "steel" ? 3 : 2.5, m.metal, sx * (w / 2 - 1.5), 0, sz * (d / 2 - 1.5)));
      if (L === "steel") {
        // X-brace on the back.
        const diag = Math.hypot(w - 6, h * 0.5);
        for (const sgn of [-1, 1]) {
          const brace = box(diag * 0.95, 1.5, 1, m.metal, 0, 0, -d / 2 + 1);
          brace.position.y = M(h * 0.5);
          brace.rotation.z = sgn * Math.atan2(h * 0.5, w - 6);
          g.add(brace);
        }
      }
      break;
    case "tapered": // ladder-like wall rails
      for (const sx of [-1, 1]) g.add(box(2, h, d, m.metal, sx * (w / 2 - 1)));
      break;
    case "turned": // glass-fronted cabinet
      g.add(box(w, 10, d, m.body));
      g.add(box(w, 6, d, m.body, 0, h - 6));
      for (const sx of [-1, 1]) g.add(box(3, h - 16, d - 2, m.body, sx * (w / 2 - 2), 10, -1));
      g.add(box(w - 4, h - 16, 1.5, m.body, 0, 10, -d / 2 + 0.75));
      g.add(box(w - 8, h - 22, 0.8, m.glass, 0, 13, d / 2 - 1.2));
      g.add(box(1.5, h - 22, 1.2, m.body, 0, 13, d / 2 - 1.2));
      break;
    case "low": // rattan étagère
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cylinder(1.8, 1.8, h, m.wicker, sx * (w / 2 - 2), 0, sz * (d / 2 - 2)));
      break;
    default: // minimalist box bookcase
      for (const sx of [-1, 1]) g.add(box(3, h, d, m.body, sx * (w / 2 - 1.5)));
      g.add(box(w, h, 1.5, m.body, 0, 0, -d / 2 + 0.75));
  }
  const inner = L === "turned" ? w - 8 : w - 6;
  for (const [i, y] of levels.entries()) {
    if (L === "turned" && (i === 0 || i === levels.length - 1)) continue;
    g.add(box(inner, L === "steel" ? 3.5 : 2.5, d - (L === "turned" ? 4 : 0), shelfMat, 0, y - 1, L === "turned" ? -1 : 0));
  }
  // Books, baskets and the odd plant so shelves look used.
  for (let i = 0; i < n; i++) {
    const y = levels[i] + 2;
    const space = levels[i + 1] - levels[i] - 6;
    if (L === "low" && i % 2 === 1) {
      g.add(cylinder(7, 6, 10, m.pot, -w / 6, y, 0));
      g.add(sphere(9, m.leaf, -w / 6, y + 16, 0, [1, 0.8, 1]));
      continue;
    }
    const books = Math.max(3, Math.round(inner / 9));
    for (let k = 0; k < books * 0.55; k++) {
      const bh = Math.min(space, 18 + ((k * 7) % 8));
      g.add(box(4.5, bh, d * 0.65, m.cushions[(i + k) % m.cushions.length], -inner / 2 + 4 + k * 5, y, d * 0.1));
    }
  }
}

// --- tables, desks, chairs ---------------------------------------------------------

function tableOrDesk(g: THREE.Group, desk: boolean, w: number, d: number, h: number, s: ThemeStyle, m: Mats) {
  const L = s.legs;
  const topT = { metal: 3, plinth: 5, tapered: 3.5, steel: 5, turned: 4, low: 4 }[L];
  const under = h - topT;
  g.add(box(w, topT, d, m.body, 0, under));
  if (desk && L === "turned") {
    // Pedestal desk with drawers either side.
    for (const sx of [-1, 1]) {
      const pw = Math.min(40, w * 0.3);
      const x = sx * (w / 2 - pw / 2 - 1);
      g.add(box(pw, under, d - 6, m.body, x, 0, -1));
      for (const y of spread(4, under - 4, 3)) g.add(sphere(1.4, m.metal, x, y, d / 2 - 3.6));
    }
    return;
  }
  switch (L) {
    case "plinth": // waterfall slabs
      for (const sx of [-1, 1]) g.add(box(topT, under, d, m.body, sx * (w / 2 - topT / 2)));
      break;
    case "low":
      if (!desk) {
        const r = Math.min(w, d) / 2 - 8;
        g.add(cylinder(r, r * 0.75, under, m.wicker));
      } else {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cylinder(2.2, 2.2, under, m.wicker, sx * (w / 2 - 6), 0, sz * (d / 2 - 6)));
      }
      break;
    default:
      legs(g, w, d, under, L, m, L === "metal" ? 6 : 4);
      if (L === "turned" || L === "tapered") g.add(box(w - 14, 8, d - 14, m.body, 0, under - 8));
  }
  if (desk) {
    const dw = Math.min(42, w / 3);
    g.add(box(dw, 16, d - 10, m.body, w / 2 - dw / 2 - 5, under - 16));
    g.add(box(32, 1.5, 22, m.dark, -w / 6, h, -2)); // laptop
  } else {
    const r = Math.min(12, Math.min(w, d) / 5);
    g.add(cylinder(r, r * 0.6, 7, m.accent, 0, h)); // bowl
  }
}

function chair(g: THREE.Group, w: number, d: number, h: number, s: ThemeStyle, m: Mats) {
  const L = s.legs;
  const seat = 45;
  const back = -d / 2;
  if (L === "low") {
    // Peacock chair: woven drum seat and a fan back.
    const r = Math.min(w, d) / 2 - 2;
    g.add(cylinder(r, r * 0.6, seat, m.wicker, 0, 0, 2));
    g.add(cylinder(r - 3, r - 3, 6, m.cushions[0], 0, seat, 2));
    const R = Math.max(10, Math.min(w / 2 - 1, h - seat));
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(M(R), M(R), M(2), 32, 1, false, Math.PI / 2, Math.PI), m.wicker);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(0, M(seat), M(back + 2));
    fan.castShadow = true;
    g.add(fan);
    return;
  }
  legs(g, w, d, seat, L === "plinth" ? "metal" : L, m, 2);
  const seatMat = L === "turned" ? m.accent : L === "steel" ? m.metal : L === "tapered" ? m.wicker : L === "plinth" ? m.body : m.fabric;
  g.add(box(w, L === "turned" ? 9 : 5, d, seatMat, 0, seat));
  const top = h - seat - 5;
  switch (L) {
    case "tapered": // wishbone-like: two posts and a bent top rail
      for (const sx of [-1, 1]) g.add(cylinder(1.6, 1.6, top, m.body, sx * (w / 2 - 4), seat + 5, back + 3));
      g.add(box(w, 6, 4, m.body, 0, h - 6, back + 2));
      break;
    case "turned": // upholstered back in a carved frame
      for (const sx of [-1, 1]) g.add(lathe(turnedProfile(h - seat), m.body, sx * (w / 2 - 3), seat, back + 3));
      g.add(box(w - 10, top - 10, 4, m.accent, 0, seat + 10, back + 3));
      g.add(box(w - 6, 6, 4, m.body, 0, h - 6, back + 2));
      break;
    default: // shell / steel / plain back
      g.add(box(w, top, 4, L === "steel" ? m.metal : seatMat, 0, seat + 5, back + 2));
  }
}

export function buildModel(category: ProductCategory, w: number, d: number, h: number, s: ThemeStyle, m: Mats): THREE.Group {
  const g = new THREE.Group();
  switch (category) {
    case "bed":
      bed(g, w, d, h, s, m);
      break;
    case "sofa":
      sofa(g, w, d, h, s, m);
      break;
    case "wardrobe":
      wardrobe(g, w, d, h, s, m);
      break;
    case "shelf":
      shelf(g, w, d, h, s, m);
      break;
    case "table":
    case "desk":
      tableOrDesk(g, category === "desk", w, d, h, s, m);
      break;
    case "chair":
      chair(g, w, d, h, s, m);
      break;
    case "lamp":
      g.add(box(w * 0.6, 3, d * 0.6, m.metal));
      g.add(box(2.5, h - 30, 2.5, m.metal, 0, 3));
      g.add(cylinder(w / 2 - 1, w / 2 - 6, 28, m.fabric, 0, h - 30));
      break;
    default:
      g.add(box(w, h, d, m.body));
  }
  return g;
}
