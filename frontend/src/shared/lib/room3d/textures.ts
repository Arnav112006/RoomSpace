/**
 * Procedural textures, drawn on a <canvas> at runtime: wood grain, planks,
 * parquet, concrete, tiles, brick, rattan, fabrics, rugs and wall art.
 * No image files are downloaded, and seeded randomness keeps every texture
 * the same on every load.
 *
 * Without a DOM (Vitest runs in node) every function returns null and the
 * caller falls back to a flat colour.
 */
import * as THREE from "three";

type Draw = (ctx: CanvasRenderingContext2D, size: number, rnd: () => number) => void;

const cache = new Map<string, THREE.Texture | null>();

/** Deterministic PRNG (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Cached texture for `key`, drawn once by `draw`. */
function texture(key: string, draw: Draw, size = 512, repeat = true): THREE.Texture | null {
  if (cache.has(key)) return cache.get(key)!;
  let tex: THREE.CanvasTexture | null = null;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      draw(ctx, size, seeded(hashKey(key)));
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    }
  }
  cache.set(key, tex);
  return tex;
}

/**
 * A copy of a cached texture with its own repeat, for surfaces that tile by
 * size (floors, brick walls). Marked as owned so the room disposes it.
 */
export function tiled(base: THREE.Texture | null, repeatX: number, repeatY: number): THREE.Texture | null {
  if (!base) return null;
  const t = base.clone();
  t.repeat.set(repeatX, repeatY);
  t.userData.owned = true;
  t.needsUpdate = true;
  return t;
}

// --- colour helpers ---------------------------------------------------------------

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amount * 255)));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function noise(ctx: CanvasRenderingContext2D, size: number, rnd: () => number, count: number, alpha: number) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${alpha * rnd()})` : `rgba(255,255,255,${alpha * rnd()})`;
    ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

/** Wavy grain lines running along x inside a band. */
function grain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dark: string, rnd: () => number, lines = 14) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let i = 0; i < lines; i++) {
    const gy = y + rnd() * h;
    const amp = 1 + rnd() * 4;
    const freq = 0.01 + rnd() * 0.03;
    const phase = rnd() * 10;
    ctx.strokeStyle = withAlpha(dark, 0.08 + rnd() * 0.2);
    ctx.lineWidth = 0.6 + rnd() * 1.8;
    ctx.beginPath();
    for (let gx = x; gx <= x + w; gx += 6) {
      const yy = gy + Math.sin(gx * freq + phase) * amp;
      if (gx === x) ctx.moveTo(gx, yy);
      else ctx.lineTo(gx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// --- surfaces ---------------------------------------------------------------------

export function woodTexture(base: string, dark: string): THREE.Texture | null {
  return texture(`wood:${base}:${dark}`, (ctx, s, rnd) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    grain(ctx, 0, 0, s, s, dark, rnd, 70);
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = withAlpha(dark, 0.25);
      ctx.beginPath();
      ctx.ellipse(rnd() * s, rnd() * s, 10 + rnd() * 10, 3 + rnd() * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

export function planksTexture(base: string, dark: string): THREE.Texture | null {
  return texture(`planks:${base}`, (ctx, s, rnd) => {
    const rows = 6;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * s * 0.6;
      while (x < s) {
        const len = s * (0.45 + rnd() * 0.5);
        ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.1);
        ctx.fillRect(x, r * rh, len, rh);
        grain(ctx, x, r * rh, len, rh, dark, rnd, 8);
        ctx.fillStyle = withAlpha(dark, 0.45);
        ctx.fillRect(x, r * rh, 2, rh);
        x += len;
      }
      ctx.fillStyle = withAlpha(dark, 0.5);
      ctx.fillRect(0, r * rh, s, 2);
    }
  });
}

/** Chevron parquet: alternating columns of slanted blocks. */
export function herringboneTexture(base: string, dark: string): THREE.Texture | null {
  return texture(`herringbone:${base}`, (ctx, s, rnd) => {
    const cw = 64;
    const t = 32;
    for (let c = 0; c < s / cw; c++) {
      const x0 = c * cw;
      const dir = c % 2 === 0 ? -1 : 1;
      for (let k = -4; k < s / t + 4; k++) {
        const y = k * t;
        ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.14);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + cw, y + dir * cw);
        ctx.lineTo(x0 + cw, y + dir * cw + t);
        ctx.lineTo(x0, y + t);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = withAlpha(dark, 0.55);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    noise(ctx, s, rnd, 4000, 0.08);
  });
}

export function tilesTexture(base: string, grout: string, n: number): THREE.Texture | null {
  return texture(`tiles:${base}:${n}`, (ctx, s, rnd) => {
    const ts = s / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.06);
        ctx.fillRect(i * ts, j * ts, ts, ts);
      }
    }
    noise(ctx, s, rnd, 3000, 0.05);
    ctx.fillStyle = grout;
    for (let i = 0; i <= n; i++) {
      ctx.fillRect(i * ts - 1.5, 0, 3, s);
      ctx.fillRect(0, i * ts - 1.5, s, 3);
    }
  });
}

export function terracottaTexture(base: string): THREE.Texture | null {
  return texture(`terracotta:${base}`, (ctx, s, rnd) => {
    const n = 4;
    const ts = s / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const g = ctx.createRadialGradient(i * ts + ts / 2, j * ts + ts / 2, 4, i * ts + ts / 2, j * ts + ts / 2, ts * 0.8);
        g.addColorStop(0, shade(base, 0.06 + (rnd() - 0.5) * 0.1));
        g.addColorStop(1, shade(base, -0.06 + (rnd() - 0.5) * 0.08));
        ctx.fillStyle = g;
        ctx.fillRect(i * ts, j * ts, ts, ts);
      }
    }
    noise(ctx, s, rnd, 5000, 0.1);
    ctx.fillStyle = "#e8dcc6";
    for (let i = 0; i <= n; i++) {
      ctx.fillRect(i * ts - 2, 0, 4, s);
      ctx.fillRect(0, i * ts - 2, s, 4);
    }
  });
}

export function concreteTexture(base: string): THREE.Texture | null {
  return texture(`concrete:${base}`, (ctx, s, rnd) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = 20 + rnd() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rnd() < 0.5 ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    noise(ctx, s, rnd, 9000, 0.12);
    ctx.fillStyle = "rgba(0,0,0,0.12)"; // expansion joints
    ctx.fillRect(0, 0, s, 2);
    ctx.fillRect(0, 0, 2, s);
  });
}

export function brickTexture(base: string, mortar: string): THREE.Texture | null {
  return texture(`brick:${base}`, (ctx, s, rnd) => {
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, s, s);
    const bh = s / 8;
    const bw = s / 4;
    for (let r = 0; r < 8; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let c = -1; c < 5; c++) {
        ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.18);
        ctx.fillRect(c * bw + off + 3, r * bh + 3, bw - 6, bh - 6);
      }
    }
    noise(ctx, s, rnd, 9000, 0.14);
  });
}

export function rattanTexture(base: string, dark: string): THREE.Texture | null {
  return texture(`rattan:${base}`, (ctx, s) => {
    ctx.fillStyle = shade(dark, -0.1);
    ctx.fillRect(0, 0, s, s);
    const step = 16;
    ctx.lineCap = "round";
    for (const dir of [1, -1]) {
      for (let i = -s; i < 2 * s; i += step) {
        ctx.strokeStyle = base;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + dir * s, s);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(i - 1, 0);
        ctx.lineTo(i - 1 + dir * s, s);
        ctx.stroke();
      }
    }
  }, 256);
}

/** Upholstery: woven linen, nubby bouclé, cotton, velvet sheen or leather. */
export function fabricTexture(base: string, kind: string): THREE.Texture | null {
  return texture(`fabric:${kind}:${base}`, (ctx, s, rnd) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    if (kind === "leather") {
      for (let i = 0; i < 60; i++) {
        const x = rnd() * s;
        const y = rnd() * s;
        const r = 30 + rnd() * 80;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rnd() < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      noise(ctx, s, rnd, 6000, 0.1);
    } else if (kind === "boucle") {
      for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
        ctx.beginPath();
        ctx.arc(rnd() * s, rnd() * s, 1 + rnd() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === "velvet") {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, "rgba(255,255,255,0.1)");
      g.addColorStop(0.5, "rgba(0,0,0,0.1)");
      g.addColorStop(1, "rgba(255,255,255,0.08)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      noise(ctx, s, rnd, 3000, 0.05);
    } else {
      for (let i = 0; i < s; i += 3) {
        ctx.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.05})`;
        ctx.fillRect(0, i, s, 1);
        ctx.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.05})`;
        ctx.fillRect(i, 0, 1, s);
      }
    }
  }, 256);
}

// --- rugs and art (drawn once, not tiled) -------------------------------------------

export function rugTexture(kind: string, colours: string[]): THREE.Texture | null {
  const [a, b, c, d = a] = colours;
  return texture(`rug:${kind}:${colours.join()}`, (ctx, s, rnd) => {
    const border = (w: number, col: string) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.strokeRect(w / 2, w / 2, s - w, s - w);
    };
    switch (kind) {
      case "geometric": {
        ctx.fillStyle = "#2b2f36";
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = a;
        ctx.lineWidth = 3;
        for (let i = -s; i < 2 * s; i += 64) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + s / 2, s);
          ctx.moveTo(i + s / 2, 0);
          ctx.lineTo(i, s);
          ctx.stroke();
        }
        border(18, "#1c1f24");
        break;
      }
      case "wool": {
        ctx.fillStyle = "#efe9de";
        ctx.fillRect(0, 0, s, s);
        noise(ctx, s, rnd, 12000, 0.08);
        ctx.fillStyle = withAlpha(d, 0.85);
        for (const y of [s * 0.12, s * 0.16, s * 0.84, s * 0.88]) ctx.fillRect(0, y, s, 6);
        break;
      }
      case "faded": {
        ctx.fillStyle = "#6f7f86";
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = "rgba(220,200,170,0.5)";
        ctx.lineWidth = 6;
        ctx.strokeRect(40, 40, s - 80, s - 80);
        ctx.beginPath();
        ctx.ellipse(s / 2, s / 2, s * 0.22, s * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 160; i++) {
          ctx.fillStyle = `rgba(230,220,200,${rnd() * 0.18})`;
          ctx.fillRect(rnd() * s, rnd() * s, 10 + rnd() * 50, 2 + rnd() * 6);
        }
        noise(ctx, s, rnd, 9000, 0.15);
        break;
      }
      case "medallion": {
        ctx.fillStyle = a;
        ctx.fillRect(0, 0, s, s);
        border(40, "#1f2a44");
        border(14, b);
        ctx.fillStyle = "#1f2a44";
        ctx.beginPath();
        ctx.moveTo(s / 2, s * 0.22);
        ctx.lineTo(s * 0.72, s / 2);
        ctx.lineTo(s / 2, s * 0.78);
        ctx.lineTo(s * 0.28, s / 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = b;
        ctx.beginPath();
        ctx.ellipse(s / 2, s / 2, s * 0.09, s * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        for (const [x, y] of [[0.18, 0.18], [0.82, 0.18], [0.18, 0.82], [0.82, 0.82]]) {
          ctx.beginPath();
          ctx.arc(x * s, y * s, s * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
        noise(ctx, s, rnd, 5000, 0.08);
        break;
      }
      default: {
        // kilim: bands of stepped diamonds
        ctx.fillStyle = "#efe0c4";
        ctx.fillRect(0, 0, s, s);
        const bands = 5;
        const bh = s / bands;
        for (let r = 0; r < bands; r++) {
          const col = [a, b, c, d][r % 4];
          ctx.fillStyle = col;
          ctx.fillRect(0, r * bh + bh * 0.08, s, bh * 0.08);
          ctx.fillRect(0, r * bh + bh * 0.84, s, bh * 0.08);
          for (let x = 0; x < s; x += bh * 0.7) {
            ctx.fillStyle = [b, c, a][(r + Math.round(x / bh)) % 3];
            ctx.beginPath();
            ctx.moveTo(x + bh * 0.35, r * bh + bh * 0.2);
            ctx.lineTo(x + bh * 0.62, r * bh + bh * 0.5);
            ctx.lineTo(x + bh * 0.35, r * bh + bh * 0.8);
            ctx.lineTo(x + bh * 0.08, r * bh + bh * 0.5);
            ctx.closePath();
            ctx.fill();
          }
        }
        noise(ctx, s, rnd, 8000, 0.1);
      }
    }
  }, 512, false);
}

/** An abstract print in the theme's colours. */
export function artTexture(colours: string[], seed: number): THREE.Texture | null {
  return texture(`art:${seed}:${colours.join()}`, (ctx, s, rnd) => {
    ctx.fillStyle = "#f6f2ea";
    ctx.fillRect(0, 0, s, s);
    const style = seed % 3;
    if (style === 0) {
      // Arches and a sun
      ctx.fillStyle = colours[0];
      ctx.beginPath();
      ctx.arc(s * 0.38, s * 0.85, s * 0.3, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = colours[1 % colours.length];
      ctx.beginPath();
      ctx.arc(s * 0.68, s * 0.85, s * 0.2, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = colours[2 % colours.length];
      ctx.beginPath();
      ctx.arc(s * 0.7, s * 0.3, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === 1) {
      // Colour-field blocks
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = colours[i % colours.length];
        ctx.fillRect(s * 0.12 + rnd() * s * 0.3, s * (0.1 + i * 0.2), s * (0.35 + rnd() * 0.3), s * 0.14);
      }
    } else {
      // Brush-stroke waves
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = colours[i % colours.length];
        ctx.lineWidth = 10 + rnd() * 18;
        ctx.lineCap = "round";
        ctx.beginPath();
        const y = s * (0.2 + i * 0.12);
        ctx.moveTo(s * 0.12, y);
        ctx.bezierCurveTo(s * 0.4, y - 40 * rnd(), s * 0.6, y + 40 * rnd(), s * 0.88, y);
        ctx.stroke();
      }
    }
    noise(ctx, s, rnd, 2500, 0.05);
  }, 256, false);
}
