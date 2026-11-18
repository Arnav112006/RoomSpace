/**
 * When to trust the local language model's reading of a command.
 *
 * Scores are cosine similarities from sentence-transformers/all-MiniLM-L6-v2
 * (backend/app/services/command_matching.py). Calibrated on real phrasings:
 * correct matches scored 0.53–0.86 ("spin the bed around" → rotate 0.84,
 * "get rid of the lamp dangling from the ceiling" → remove the hanging
 * light 0.67); right-but-vague ones 0.38–0.40 ("some greenery please");
 * unrelated text 0.21–0.28 ("bake a cake").
 */
export const ACCEPT_SCORE = 0.5;
export const SUGGEST_SCORE = 0.35;
/** The best match must beat the runner-up by this much to be applied. */
export const MIN_MARGIN = 0.05;

export type ModelReading =
  | { status: "apply"; command: string; score: number }
  | { status: "suggest"; command: string; score: number }
  | { status: "none" };

type VerbClass = "remove" | "add" | "move" | "rotate";

const VERB_CLASSES: [VerbClass, RegExp][] = [
  ["remove", /\b(remove|delete|get rid|take (?:away|out)|throw|ditch|don'?t (?:want|need)|no more)\b/],
  ["rotate", /\b(rotate|spin|flip|turn (?:it|the|around))\b/],
  ["move", /\b(move|shift|relocate|slide|push|reposition)\b/],
  ["add", /\b(add|bring in|include|install|buy)\b/],
];

/** What kind of change a sentence clearly asks for, if any. */
export function verbClass(text: string): VerbClass | null {
  const lower = text.toLowerCase();
  return VERB_CLASSES.find(([, re]) => re.test(lower))?.[0] ?? null;
}

/**
 * `typed` is what the user wrote. When it clearly asks for one kind of change
 * (move, remove, add, rotate), the model may only apply a command of that
 * kind — "shift the couch" must never become "add a sofa".
 */
export function decide(matches: { candidate: string; score: number }[], typed = ""): ModelReading {
  const [best, next] = matches;
  if (!best || best.score < SUGGEST_SCORE) return { status: "none" };
  const clear = !next || best.score - next.score >= MIN_MARGIN;
  const asked = verbClass(typed);
  const same = !asked || verbClass(best.candidate) === null || verbClass(best.candidate) === asked;
  if (best.score >= ACCEPT_SCORE && clear && same) return { status: "apply", command: best.candidate, score: best.score };
  return { status: "suggest", command: best.candidate, score: best.score };
}
