import type { FixtureKind, FloorFinish, FurnitureType, MoveTarget, ParsedCommandAction, PendantStyle } from "@/shared/types";
import { FURNITURE_SYNONYMS, furnitureTypeIn } from "./furniture";
import { parseColour } from "./colours";
import { THEMES, themesIn } from "./catalog";

// Stage 9 — User Refinement / Commands.
// A small, predictable rule-based parser: predefined verbs, keyword
// synonym tables, and pattern matching. No external LLM call — the
// project's design goal is a self-contained, auditable Request ->
// Validate -> Apply loop.

const REMOVE_VERBS = ["remove", "delete", "get rid of", "take away", "take out"];
const MOVE_VERBS = ["move", "shift", "relocate", "put", "place"];
const ADD_VERBS = ["add", "put in", "bring in", "include", "insert"];
const ROTATE_VERBS = ["rotate", "turn", "spin", "flip"];

const TARGET_SYNONYMS: Record<MoveTarget, string[]> = {
  "left-wall": ["left wall", "left side", "west wall", "to the left"],
  "right-wall": ["right wall", "right side", "east wall", "to the right"],
  "back-wall": ["back wall", "north wall", "far wall", "rear wall"],
  "front-wall": ["front wall", "south wall", "near the door", "front"],
  window: ["window", "near the window", "by the window"],
  center: ["center", "centre", "middle of the room"],
};

function findLabelInCommand(command: string, knownLabels: string[]): string | null {
  const lower = command.toLowerCase();
  // Prefer an exact known placement label (e.g. "Sofa" already in the room)
  const exact = knownLabels.find((label) => lower.includes(label.toLowerCase()));
  if (exact) return exact;
  // Fall back to a furniture-type keyword so "remove the chair" still
  // resolves even if the room's label is "Accent Chair".
  for (const [type, words] of FURNITURE_SYNONYMS) {
    if (words.some((w) => lower.includes(w))) {
      const byType = knownLabels.find((label) => label.toLowerCase().includes(type));
      if (byType) return byType;
    }
  }
  return null;
}

function findTarget(command: string): MoveTarget | null {
  const lower = command.toLowerCase();
  for (const [target, words] of Object.entries(TARGET_SYNONYMS)) {
    if (words.some((w) => lower.includes(w))) return target as MoveTarget;
  }
  return null;
}

// Floor finishes by keyword; more specific phrases first ("dark wood" before "wood").
const FLOOR_FINISHES: [string[], FloorFinish, string, string][] = [
  [["dark wood", "dark oak", "walnut", "espresso"], "oakPlanks", "#5b3d29", "dark wood"],
  [["herringbone", "parquet"], "herringbone", "#8b5a3c", "parquet"],
  [["concrete", "cement"], "concrete", "#8d8984", "concrete"],
  [["terracotta", "clay tile", "saltillo"], "terracotta", "#b98a5e", "terracotta tiles"],
  [["marble", "white tile", "light tile", "pale tile"], "paleTiles", "#e6e0d6", "pale tiles"],
  [["grey tile", "gray tile", "tiles", "tile"], "greyTiles", "#b9b5ae", "grey tiles"],
  [["light wood", "oak", "wooden", "wood", "hardwood", "plank", "timber", "laminate"], "oakPlanks", "#d9bf94", "oak planks"],
];

const has = (lower: string, pattern: RegExp) => pattern.test(lower);

/**
 * Appearance commands: wall/floor/furniture colours, floor finish, theme,
 * and resetting them. Returns null when the command isn't about style.
 */
function parseStyleCommand(command: string, lower: string, knownLabels: string[]): ParsedCommandAction | null {
  if (has(lower, /\b(reset|undo|clear|restore|remove)\b.*\b(colou?rs?|paint|style|custom)/)) return { kind: "reset-style" };

  const walls = has(lower, /\bwalls?\b/);
  const floor = has(lower, /\b(floor|floors|flooring)\b/);
  if (floor && !walls) {
    const finish = FLOOR_FINISHES.find(([words]) => words.some((w) => lower.includes(w)));
    if (finish) return { kind: "floor", floor: finish[1], colour: finish[2], name: finish[3] };
  }

  const colour = parseColour(lower);
  const intent = has(lower, /\b(colou?r|paint|repaint|recolou?r|make|turn|change|switch)\b/);
  if (colour && (intent || walls || floor)) {
    if (walls) return { kind: "colour", target: "walls", colour: colour.hex, name: colour.name };
    if (floor) return { kind: "colour", target: "floor", colour: colour.hex, name: colour.name };
    const label = findLabelInCommand(command, knownLabels);
    if (label) return { kind: "colour", target: "item", label, colour: colour.hex, name: colour.name };
  }
  if (!colour && has(lower, /\b(colou?r|paint|repaint)\b/) && (walls || floor || findLabelInCommand(command, knownLabels))) {
    return { kind: "unknown", raw: command, hint: `Not a colour I know — try beige, sage, navy, terracotta or a hex like #e8dcc4.` };
  }

  const themes = themesIn(lower);
  if (themes.length > 0 && has(lower, /\b(theme|style|make|switch|change|go|turn|look)\b/)) {
    const theme = THEMES.find((t) => t.toLowerCase() === themes[0])!;
    return { kind: "theme", theme };
  }
  return null;
}

// Fixtures by keyword; more specific first ("floor lamp" before "lamp", "ceiling fan" before "light").
const FIXTURE_WORDS: [FixtureKind, string[]][] = [
  ["fan", ["ceiling fan", "fan"]],
  ["floorLamp", ["floor lamp", "standing lamp", "reading lamp", "lamp"]],
  ["pendant", [
    "hanging light", "hanging lamp", "pendant", "ceiling light", "ceiling lamp", "chandelier",
    "light fixture", "overhead light", "lights", "light",
  ]],
  ["rug", ["rug", "carpet"]],
  ["plants", ["plants", "plant", "greenery", "greens"]],
];

const PENDANT_STYLES: [PendantStyle, string[]][] = [
  ["chandelier", ["chandelier"]],
  ["globe", ["globe", "paper lantern", "paper light", "round light"]],
  ["cage", ["cage", "edison", "industrial light"]],
  ["woven", ["woven", "rattan", "wicker", "basket light"]],
  ["cone", ["cone", "dome"]],
  ["disc", ["disc", "flush", "flat light"]],
];

/** "add a ceiling fan", "remove the hanging light", "change the light to a chandelier". */
function parseFixtureCommand(lower: string): ParsedCommandAction | null {
  // "the lamp dangling from the ceiling" is the hanging light, not a floor lamp.
  const overhead = /\b(lamps?|lights?)\b/.test(lower) && /\b(ceiling|hanging|dangling|overhead|suspended)\b/.test(lower) && !/\bfan\b/.test(lower);
  const hit = overhead
    ? FIXTURE_WORDS.find(([kind]) => kind === "pendant")
    : FIXTURE_WORDS.find(([, words]) => words.some((w) => new RegExp(`\\b${w}\\b`).test(lower)));
  if (!hit) return null;
  const [fixture] = hit;
  const variant = fixture === "pendant" ? PENDANT_STYLES.find(([, words]) => words.some((w) => lower.includes(w)))?.[0] : undefined;
  // Negation wins: "I don't need the carpet" removes it, even though "need" alone would add.
  const removing = REMOVE_VERBS.some((v) => lower.includes(v)) || /\b(no|without|don'?t|do not|not|never)\b/.test(lower);
  if (removing) return { kind: "fixture", fixture, on: false };
  const adding = [...ADD_VERBS, "install", "hang", "want", "need", "change", "swap", "make", "use", "switch"].some((v) =>
    new RegExp(`\\b${v}\\b`).test(lower)
  );
  if (adding) return { kind: "fixture", fixture, on: true, variant };
  return null;
}

const VERB = "add|remove|delete|move|put|place|rotate|turn|paint|repaint|make|change|switch|reset|get rid|take|install|hang|shift|bring|include|insert|colou?r|spin|swap|replace|use";

/**
 * Splits "remove the hanging light and add a fan" into one command per
 * clause, and rewrites "replace X with Y" as "remove X" + "add Y". "and"
 * only splits before a verb, so "black and white" stays together.
 */
export function splitClauses(text: string): string[] {
  const t = text.trim().replace(/\b(?:replace|swap)\s+(?:the\s+)?(.+?)\s+(?:with|for)\s+(.+)/i, "remove $1 and add $2");
  return t
    .split(new RegExp(`\\s*(?:[,;]|\\band then\\b|\\bthen\\b|\\band\\s+(?=(?:${VERB})\\b))\\s*`, "i"))
    .map((s) => s.trim())
    .filter(Boolean);
}

const FURNITURE_TYPES: FurnitureType[] = ["bed", "wardrobe", "table", "chair", "desk", "sofa", "shelf"];
const TARGET_PHRASES: Record<Exclude<MoveTarget, never>, string> = {
  "left-wall": "the left wall", "right-wall": "the right wall", "back-wall": "the back wall",
  "front-wall": "the front wall", window: "the window", center: "the center",
};

/**
 * Every canonical command the rules understand for this room. The local
 * language model matches a free-form phrasing to one of these, and the
 * match is then parsed by the same rules as typed text.
 */
export function commandCandidates(labels: string[]): string[] {
  const out: string[] = [];
  for (const label of labels) {
    out.push(`remove the ${label}`, `rotate the ${label}`);
    for (const target of Object.values(TARGET_PHRASES)) out.push(`move the ${label} to ${target}`);
  }
  for (const type of FURNITURE_TYPES) out.push(`add a ${type}`, `add a ${type} near the window`, `add a ${type} near the door`);
  out.push(
    "remove the hanging light", "add a hanging light", "add a ceiling fan", "remove the ceiling fan",
    "add a rug", "remove the rug", "add plants", "remove the plants", "add a floor lamp", "remove the floor lamp",
    ...PENDANT_STYLES.map(([style]) => `change the light to a ${style === "cage" ? "cage light" : style === "woven" ? "woven light" : style === "disc" ? "flush disc light" : style}`),
    ...THEMES.map((t) => `make it ${t.toLowerCase()}`),
    ...FLOOR_FINISHES.map(([, , , name]) => `make the floor ${name}`),
    "reset colours",
  );
  return [...new Set(out)];
}

export function parseCommand(raw: string, knownLabels: string[]): ParsedCommandAction {
  const command = raw.trim();
  const lower = command.toLowerCase();
  if (!command) return { kind: "unknown", raw };

  const style = parseStyleCommand(command, lower, knownLabels);
  if (style) return style;
  // Fixtures before furniture, unless the command names a piece in the layout.
  if (!findLabelInCommand(command, knownLabels) || /\b(light|lamp|fan|rug|carpet|plants?)\b/.test(lower)) {
    const fixture = parseFixtureCommand(lower);
    if (fixture) return fixture;
  }

  if (REMOVE_VERBS.some((v) => lower.startsWith(v) || lower.includes(` ${v} `) || lower.includes(v))) {
    const label = findLabelInCommand(command, knownLabels);
    if (label) return { kind: "remove", label };
  }

  if (ROTATE_VERBS.some((v) => lower.includes(v))) {
    const label = findLabelInCommand(command, knownLabels);
    if (label) return { kind: "rotate", label };
  }

  if (MOVE_VERBS.some((v) => lower.includes(v))) {
    const label = findLabelInCommand(command, knownLabels);
    const target = findTarget(command);
    if (label && target) return { kind: "move", label, target };
  }

  if (ADD_VERBS.some((v) => lower.includes(v))) {
    const itemType = furnitureTypeIn(command);
    if (itemType) {
      const near = lower.includes("window")
        ? "window"
        : lower.includes("door")
        ? "door"
        : lower.includes("center") || lower.includes("centre")
        ? "center"
        : undefined;
      return { kind: "add", itemType, near };
    }
  }

  return { kind: "unknown", raw };
}

export function describeAction(action: ParsedCommandAction): string {
  switch (action.kind) {
    case "remove":
      return `Remove ${action.label}`;
    case "move":
      return `Move ${action.label} to the ${action.target.replace("-", " ")}`;
    case "add":
      return `Add a ${action.itemType}${action.near ? ` near the ${action.near}` : ""}`;
    case "rotate":
      return `Rotate ${action.label}`;
    case "colour":
      return action.target === "item"
        ? `Make the ${action.label} ${action.name}`
        : `Paint the ${action.target === "walls" ? "walls" : "floor"} ${action.name}`;
    case "floor":
      return `Change the floor to ${action.name}`;
    case "fixture": {
      const name = { pendant: "hanging light", fan: "ceiling fan", rug: "rug", plants: "plants", floorLamp: "floor lamp" }[action.fixture];
      if (!action.on) return `Remove the ${name}`;
      return action.variant ? `Change the light to a ${action.variant}` : `Add ${action.fixture === "plants" ? "" : "a "}${name}`;
    }
    case "theme":
      return `Switch the room to ${action.theme}`;
    case "reset-style":
      return "Reset colours to the theme";
    case "unknown":
      return `Couldn't understand "${action.raw}"`;
  }
}
