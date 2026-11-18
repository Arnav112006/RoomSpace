import { THEMES } from "@/shared/lib/catalog";

// A colour cue per theme for the picker (wood, steel, terracotta…).
const THEME_SWATCH: Record<string, string> = {
  Modern: "linear-gradient(135deg, #2f3640, #8395a7)",
  Minimalist: "linear-gradient(135deg, #f5f2ec, #cfc8bb)",
  Scandinavian: "linear-gradient(135deg, #ecdcc0, #b89466)",
  Industrial: "linear-gradient(135deg, #5b5f63, #9a5b3c)",
  Traditional: "linear-gradient(135deg, #7a3b2e, #c8a45d)",
  Bohemian: "linear-gradient(135deg, #c46b3d, #3f7f6e)",
};

/** One chip per theme; the room's own theme is marked "yours". */
export function ThemePicker({
  value,
  roomTheme,
  onChange,
  compact = false,
  label = "Choose a theme",
}: {
  value: string;
  roomTheme: string;
  onChange: (theme: string) => void;
  /** Smaller chips, no bottom margin — for panel headers. */
  compact?: boolean;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2 mb-6"}`}>
      {THEMES.map((t) => {
        const active = t.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t)}
            className={`inline-flex items-center gap-2 rounded-full border transition-all duration-300 ${
              compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
            } ${
              active
                ? "border-brass-400/80 bg-brass-400/10 text-paper shadow-glow-brass"
                : "border-white/10 text-ink-muted hover:border-white/25 hover:text-paper"
            }`}
          >
            <span className="h-3.5 w-3.5 rounded-full ring-1 ring-white/20" style={{ background: THEME_SWATCH[t] }} aria-hidden />
            {t}
            {t.toLowerCase() === roomTheme.toLowerCase() && (
              <span className="text-[10px] uppercase tracking-wider text-brass-700">yours</span>
            )}
          </button>
        );
      })}
    </div>
  );
}