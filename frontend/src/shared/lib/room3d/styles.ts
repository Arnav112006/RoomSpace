import type { FloorFinish, PendantStyle } from "@/shared/types";

/**
 * What each theme looks like in 3D: colours, surface finishes, furniture
 * construction, decor and lighting. One record per theme in THEMES
 * (shared/lib/catalog.ts).
 */

export interface ThemePalette {
  body: string; // main wood / carcass
  fabric: string; // upholstery, mattress
  metal: string; // legs, handles, frames
  accent: string; // throws, velvet, painted details
  floor: string;
  wall: string;
  trim: string; // skirting, frames, mouldings
  pot: string; // plant pots
}

/** How legs and bases are built — the strongest style cue on furniture. */
export type LegStyle = "metal" | "plinth" | "tapered" | "steel" | "turned" | "low";
export type WoodKind = "walnut" | "painted" | "oak" | "darkWood" | "mahogany" | "rattan";
export type FabricKind = "linen" | "boucle" | "leather" | "velvet" | "cotton";
export type FloorKind = FloorFinish;
export type WallKind = "paint" | "brick" | "wainscot";
export type RugKind = "geometric" | "wool" | "faded" | "medallion" | "kilim" | null;
export type PendantKind = PendantStyle;
export type DecorKind =
  | "plant" | "tallPlant" | "sculpturalPlant" | "palm" | "pouf" | "floorCushion"
  | "floorLamp" | "cageLamp" | "crate" | "sideTable" | "sheepskin";

export interface ThemeLight {
  sky: string;
  ground: string;
  hemi: number;
  ambient: number;
  sun: number;
  sunColor: string;
  lamp: string; // pendant light colour
  lampIntensity: number;
  exposure: number;
}

export interface ThemeStyle {
  palette: ThemePalette;
  wood: WoodKind;
  fabric: FabricKind;
  floor: FloorKind;
  wall: WallKind;
  rug: RugKind;
  legs: LegStyle;
  pendant: PendantKind;
  decor: DecorKind[];
  /** Colours for cushions, books and wall art. */
  colours: string[];
  light: ThemeLight;
}

export const THEME_STYLES: Record<string, ThemeStyle> = {
  modern: {
    palette: { body: "#6b4a35", fabric: "#5d6670", metal: "#1c1c1e", accent: "#c8a45d", floor: "#b9b5ae", wall: "#e9e7e3", trim: "#f2f1ee", pot: "#2b2b2d" },
    wood: "walnut", fabric: "boucle", floor: "greyTiles", wall: "paint", rug: "geometric", legs: "metal", pendant: "cone",
    decor: ["floorLamp", "plant"],
    colours: ["#c8a45d", "#2f3640", "#d9d4cc", "#8395a7"],
    light: { sky: "#f4f6ff", ground: "#8a8f99", hemi: 1.7, ambient: 0.45, sun: 2.3, sunColor: "#ffffff", lamp: "#fff1dc", lampIntensity: 0.8, exposure: 1 },
  },
  minimalist: {
    palette: { body: "#f2efe9", fabric: "#e3ddd2", metal: "#d6d1c8", accent: "#c9b9a0", floor: "#e6e0d6", wall: "#f7f5f1", trim: "#f7f5f1", pot: "#efece6" },
    wood: "painted", fabric: "linen", floor: "paleTiles", wall: "paint", rug: null, legs: "plinth", pendant: "disc",
    decor: ["sculpturalPlant"],
    colours: ["#d8d2c6", "#b9a58a", "#efece6"],
    light: { sky: "#ffffff", ground: "#d8d4cc", hemi: 2, ambient: 0.6, sun: 2.4, sunColor: "#fffaf2", lamp: "#fff6e8", lampIntensity: 0.6, exposure: 1.05 },
  },
  scandinavian: {
    palette: { body: "#d8bf98", fabric: "#ebe6dc", metal: "#f2f2f0", accent: "#7d9a8c", floor: "#e3cfae", wall: "#f4f1ea", trim: "#fbfaf6", pot: "#f4f1ea" },
    wood: "oak", fabric: "linen", floor: "oakPlanks", wall: "paint", rug: "wool", legs: "tapered", pendant: "globe",
    decor: ["plant", "sheepskin", "tallPlant"],
    colours: ["#7d9a8c", "#d9a38f", "#e9e4da", "#4a5a66"],
    light: { sky: "#fdfaf3", ground: "#cdbb9d", hemi: 1.9, ambient: 0.55, sun: 2.4, sunColor: "#fff4e2", lamp: "#ffe7c4", lampIntensity: 0.9, exposure: 1 },
  },
  industrial: {
    palette: { body: "#5a4636", fabric: "#8a4e30", metal: "#2e3134", accent: "#c47a3a", floor: "#8d8984", wall: "#a9644e", trim: "#2e3134", pot: "#3a3d40" },
    wood: "darkWood", fabric: "leather", floor: "concrete", wall: "brick", rug: "faded", legs: "steel", pendant: "cage",
    decor: ["cageLamp", "crate", "plant"],
    colours: ["#c47a3a", "#3a3d40", "#d8cfc2", "#7b8b8f"],
    light: { sky: "#e8e2da", ground: "#4a3f37", hemi: 1.25, ambient: 0.35, sun: 1.9, sunColor: "#ffd9a8", lamp: "#ffb866", lampIntensity: 1.6, exposure: 0.95 },
  },
  traditional: {
    palette: { body: "#6b2f22", fabric: "#e8dcc2", metal: "#b8964f", accent: "#7a2430", floor: "#8b5a3c", wall: "#e9dcc3", trim: "#f6efe0", pot: "#c8b48a" },
    wood: "mahogany", fabric: "velvet", floor: "herringbone", wall: "wainscot", rug: "medallion", legs: "turned", pendant: "chandelier",
    decor: ["sideTable", "palm"],
    colours: ["#7a2430", "#b8964f", "#2f4a3a", "#e8dcc2"],
    light: { sky: "#fff2dc", ground: "#6b4a32", hemi: 1.45, ambient: 0.4, sun: 2, sunColor: "#ffe2b0", lamp: "#ffd08a", lampIntensity: 1.4, exposure: 0.97 },
  },
  bohemian: {
    palette: { body: "#c8a06a", fabric: "#f0e2c8", metal: "#6b4a2f", accent: "#c46b3d", floor: "#b98a5e", wall: "#f1e3cc", trim: "#f6ead6", pot: "#c46b3d" },
    wood: "rattan", fabric: "cotton", floor: "terracotta", wall: "paint", rug: "kilim", legs: "low", pendant: "woven",
    decor: ["tallPlant", "pouf", "floorCushion", "plant"],
    colours: ["#c46b3d", "#3f7f6e", "#e0b04f", "#8c3b4e", "#f0e2c8"],
    light: { sky: "#fff0d8", ground: "#9b6a44", hemi: 1.6, ambient: 0.45, sun: 2.2, sunColor: "#ffd9a0", lamp: "#ffc27a", lampIntensity: 1.3, exposure: 1 },
  },
};

export function styleFor(theme: string): ThemeStyle {
  return THEME_STYLES[theme.toLowerCase()] ?? THEME_STYLES.modern;
}

export function paletteFor(theme: string): ThemePalette {
  return styleFor(theme).palette;
}
