import type { FurnitureType, MoveTarget, ParsedCommandAction } from "../types";

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

const TYPE_SYNONYMS: Record<FurnitureType, string[]> = {
  bed: ["bed"],
  wardrobe: ["wardrobe", "closet", "cupboard"],
  table: ["table", "coffee table", "dining table", "side table"],
  chair: ["chair", "armchair", "recliner"],
  desk: ["desk", "workstation"],
  sofa: ["sofa", "couch", "settee"],
  shelf: ["shelf", "bookshelf", "shelving", "bookcase"],
  window: ["window"],
  door: ["door"],
  other: [],
};

function findLabelInCommand(command: string, knownLabels: string[]): string | null {
  const lower = command.toLowerCase();
  // Prefer an exact known placement label (e.g. "Sofa" already in the room)
  const exact = knownLabels.find((label) => lower.includes(label.toLowerCase()));
  if (exact) return exact;
  // Fall back to a furniture-type keyword so "remove the chair" still
  // resolves even if the room's label is "Accent Chair".
  for (const [type, words] of Object.entries(TYPE_SYNONYMS)) {
    if (words.some((w) => lower.includes(w))) {
      const byType = knownLabels.find((label) => label.toLowerCase().includes(type));
      if (byType) return byType;
    }
  }
  return null;
}

function findFurnitureType(command: string): FurnitureType | null {
  const lower = command.toLowerCase();
  for (const [type, words] of Object.entries(TYPE_SYNONYMS) as [FurnitureType, string[]][]) {
    if (words.some((w) => lower.includes(w))) return type;
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

export function parseCommand(raw: string, knownLabels: string[]): ParsedCommandAction {
  const command = raw.trim();
  const lower = command.toLowerCase();
  if (!command) return { kind: "unknown", raw };

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
    const itemType = findFurnitureType(command);
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
    case "unknown":
      return `Couldn't understand "${action.raw}"`;
  }
}
