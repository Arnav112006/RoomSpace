/** Materials for one theme, textured where a canvas is available. */
import * as THREE from "three";
import type { ThemeStyle } from "./styles";
import {
  brickTexture, concreteTexture, fabricTexture, herringboneTexture, planksTexture, rattanTexture,
  terracottaTexture, tiled, tilesTexture, woodTexture,
} from "./textures";

export interface Mats {
  body: THREE.Material; // wood / carcass
  fabric: THREE.Material; // upholstery
  sheet: THREE.Material; // bedding
  metal: THREE.Material;
  accent: THREE.Material; // velvet / painted details
  wicker: THREE.Material;
  trim: THREE.Material;
  glass: THREE.Material;
  dark: THREE.Material;
  pot: THREE.Material;
  leaf: THREE.Material;
  leafDark: THREE.Material;
  bulb: THREE.Material;
  cushions: THREE.Material[];
  /** Floor for an L×W cm room (textures tile to real-world size). */
  floor: (L: number, W: number) => THREE.Material;
  /** Wall surface for a piece len×h cm (brick tiles to real brick size). */
  wall: (len: number, h: number) => THREE.Material;
}

const WOOD_DARK: Record<string, string> = {
  walnut: "#2e1d12", oak: "#9c7b52", darkWood: "#251a12", mahogany: "#2b100a", rattan: "#8a6538",
};

/** Floor texture and how many cm of floor one copy of it covers. */
function floorTexture(style: ThemeStyle): [THREE.Texture | null, number] {
  const c = style.palette.floor;
  switch (style.floor) {
    case "greyTiles":
      return [tilesTexture(c, "#9a958d", 4), 240];
    case "paleTiles":
      return [tilesTexture(c, "#d3cbbd", 2), 120];
    case "oakPlanks":
      return [planksTexture(c, "#a88a5f"), 110];
    case "concrete":
      return [concreteTexture(c), 300];
    case "herringbone":
      return [herringboneTexture(c, "#3d2414"), 100];
    case "terracotta":
      return [terracottaTexture(c), 120];
  }
}

/**
 * Materials for one piece the user recoloured ("make the sofa navy"):
 * upholstered pieces change their fabric (and a bed its duvet), the rest
 * their wood/carcass.
 */
export function recolour(m: Mats, style: ThemeStyle, colour: string, upholstered: boolean): Mats {
  if (upholstered) {
    const fabric = new THREE.MeshStandardMaterial({
      color: "#ffffff", map: fabricTexture(colour, style.fabric), roughness: style.fabric === "leather" ? 0.55 : 0.95,
    });
    if (!fabric.map) fabric.color.set(colour);
    const cushions = [...m.cushions];
    cushions[1 % cushions.length] = fabric;
    return { ...m, fabric, cushions };
  }
  const map = style.wood === "painted" ? null : woodTexture(colour, "#2a1a10");
  const body = new THREE.MeshStandardMaterial({ color: map ? "#ffffff" : colour, map, roughness: 0.6 });
  // Painted pieces (the bohemian armoire) take their colour from cushions[1].
  const painted = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.7 });
  const cushions = [...m.cushions];
  cushions[1 % cushions.length] = painted;
  return { ...m, body, cushions };
}

export function buildMaterials(style: ThemeStyle): Mats {
  const p = style.palette;
  const std = (color: string, map: THREE.Texture | null = null, roughness = 0.75, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color: map ? "#ffffff" : color, map, roughness, metalness });

  const woodMap = style.wood === "painted" ? null : woodTexture(p.body, WOOD_DARK[style.wood] ?? "#2e1d12");
  const fabricMap = fabricTexture(p.fabric, style.fabric);
  const wickerMap = rattanTexture("#d9b47a", "#5c4024");
  const [floorBase, floorCm] = floorTexture(style);
  const brick = style.wall === "brick" ? brickTexture(p.wall, "#cdbfae") : null;
  const plainWall = std(p.wall, null, 0.95);

  return {
    body: std(p.body, woodMap, style.wood === "painted" ? 0.5 : 0.62),
    fabric: std(p.fabric, fabricMap, style.fabric === "leather" ? 0.55 : 0.95),
    sheet: std("#f7f5f0", fabricTexture("#f7f5f0", "linen"), 0.95),
    metal: std(p.metal, null, 0.35, 0.6),
    accent: std(p.accent, style.fabric === "velvet" ? fabricTexture(p.accent, "velvet") : null, 0.85),
    wicker: std("#d9b47a", wickerMap, 0.85),
    trim: std(p.trim, null, 0.55),
    glass: new THREE.MeshStandardMaterial({ color: "#9cc7e6", roughness: 0.05, transparent: true, opacity: 0.35 }),
    dark: std("#2a2a2a", null, 0.7),
    pot: std(p.pot, null, 0.8),
    leaf: std("#5f8f4e", null, 0.8),
    leafDark: std("#3f6b3a", null, 0.8),
    bulb: new THREE.MeshStandardMaterial({ color: "#fff6e0", emissive: style.light.lamp, emissiveIntensity: 1.6 }),
    cushions: style.colours.map((c) => std(c, fabricTexture(c, style.fabric === "leather" ? "linen" : style.fabric), 0.9)),
    floor: (L, W) => std(p.floor, tiled(floorBase, L / floorCm, W / floorCm), 0.8),
    wall: (len, h) => (brick ? std(p.wall, tiled(brick, len / 92, h / 60), 0.95) : plainWall),
  };
}
