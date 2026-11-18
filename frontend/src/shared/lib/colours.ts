/**
 * Colour names the command box understands ("paint the walls beige",
 * "make the sofa dark green", "walls #e8dcc4"). A fixed vocabulary, matched
 * by rules like the rest of the parser — no model involved.
 */

export const NAMED_COLOURS: Record<string, string> = {
  white: "#f7f6f2", "off white": "#f3efe6", ivory: "#f6f1e1", cream: "#f1e6cf", beige: "#e2d3ba",
  sand: "#d8c3a0", taupe: "#a39382", greige: "#bdb5a6", "warm grey": "#b6aea3", grey: "#9b9da0",
  gray: "#9b9da0", "light grey": "#cfd0d0", charcoal: "#3c3f44", black: "#1f1f21", silver: "#c4c7cb",
  navy: "#243b5a", blue: "#4a78a8", "sky blue": "#9cc4e4", "powder blue": "#b9d1e6", "dusty blue": "#8aa3b8",
  teal: "#2f7f7a", turquoise: "#3fb5ad", aqua: "#7fd1cc", green: "#4f8a55", "forest green": "#2e5a3a",
  sage: "#a3b18a", olive: "#7a7a3a", mint: "#bfe3cf", emerald: "#2e8b62", yellow: "#e8c547",
  mustard: "#d1a43a", gold: "#c8a45d", ochre: "#c7892e", orange: "#e07b39", terracotta: "#c4643f",
  rust: "#a8502a", coral: "#ef8a6f", peach: "#f5c2a0", pink: "#e8a5b5", blush: "#e9c3bd",
  "dusty pink": "#d4a5a5", red: "#b83a3a", burgundy: "#7a2430", maroon: "#6b1f2a", wine: "#6e2639",
  purple: "#6f4e8c", lavender: "#c3b5dc", lilac: "#c8a8d6", plum: "#6b3a5c", brown: "#7a5236",
  chocolate: "#4e3426", tan: "#c19a6b", camel: "#b5875a", caramel: "#b07642", walnut: "#6b4a35",
  oak: "#d8bf98", mahogany: "#6b2f22", espresso: "#3b2a20",
};

// Longest names first, so "sky blue" wins over "blue" and "off white" over "white".
const NAMES = Object.keys(NAMED_COLOURS).sort((a, b) => b.length - a.length);

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: number[]): string {
  return `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("")}`;
}

/** Mix a colour towards white (amount > 0) or black (amount < 0). */
export function shadeHex(hex: string, amount: number): string {
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex(toRgb(hex).map((c) => c + (target - c) * t));
}

const LIGHTER = ["light", "pale", "soft", "pastel"];
const DARKER = ["dark", "deep", "rich"];

/** The colour named in `text`, with a light/dark modifier applied, or null. */
export function parseColour(text: string): { hex: string; name: string } | null {
  const lower = text.toLowerCase();
  const hex = lower.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return { hex: `#${h}`, name: `#${h}` };
  }
  for (const name of NAMES) {
    const at = lower.search(new RegExp(`\\b${name}\\b`));
    if (at < 0) continue;
    const before = lower.slice(0, at).trim().split(/\s+/).pop() ?? "";
    let colour = NAMED_COLOURS[name];
    let label = name;
    if (LIGHTER.includes(before) && !name.startsWith("light")) {
      colour = shadeHex(colour, 0.35);
      label = `${before} ${name}`;
    } else if (DARKER.includes(before)) {
      colour = shadeHex(colour, -0.35);
      label = `${before} ${name}`;
    }
    return { hex: colour, name: label };
  }
  return null;
}
