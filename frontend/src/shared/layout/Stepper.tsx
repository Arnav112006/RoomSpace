import { useRoomStore, type WizardStep } from "@/shared/store/roomStore";

interface Step {
  id: WizardStep;
  title: string;
  /** Which of the 12 workflow stages (docs/proposal) this screen covers. */
  stages: string;
}

const ALL_STEPS: Step[] = [
  { id: "input", title: "Room", stages: "Stage 1" },
  { id: "analysis", title: "Verify", stages: "Stage 2" },
  { id: "model", title: "Model", stages: "Stage 3" },
  { id: "studio", title: "Studio", stages: "Stages 4–11" },
  { id: "recommendations", title: "Products", stages: "Stage 12" },
];

/**
 * Horizontal progress across the five screens. Completed steps can be
 * clicked to go back; future steps can't be skipped to.
 */
export function Stepper({ current, hasPhoto }: { current: WizardStep; hasPhoto: boolean }) {
  const steps = ALL_STEPS.filter((s) => hasPhoto || s.id !== "analysis");
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === current));
  const progress = steps.length > 1 ? currentIndex / (steps.length - 1) : 0;

  return (
    <nav aria-label="Progress" className="mb-10">
      <ol className="relative flex items-start justify-between">
        {/* Track, then the filled part. Inset by half a dot so it runs centre to centre. */}
        <div className="absolute left-4 right-4 top-4 h-px bg-white/10" aria-hidden />
        <div
          className="absolute left-4 top-4 h-px bg-gradient-to-r from-moss-500 via-blueprint-600 to-brass-400 transition-all duration-700 ease-out"
          style={{ width: `calc((100% - 2rem) * ${progress})` }}
          aria-hidden
        />
        {steps.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={step.id} className="relative flex flex-col items-center gap-2 w-24 first:items-start last:items-end">
              <button
                type="button"
                disabled={!done}
                onClick={() => useRoomStore.setState({ step: step.id })}
                aria-current={active ? "step" : undefined}
                aria-label={`${step.title}${done ? " (completed — go back)" : active ? " (current)" : ""}`}
                className={`relative h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-500 ${
                  active
                    ? "bg-gradient-to-b from-brass-200 to-brass-500 text-ink-950 shadow-glow-brass scale-110"
                    : done
                    ? "bg-moss-500/15 text-moss-400 border border-moss-500/50 hover:bg-moss-500/25 cursor-pointer"
                    : "bg-ink-950 text-ink-muted border border-white/15"
                }`}
              >
                {active && <span className="absolute inset-0 rounded-full animate-pulse-ring text-brass-400" aria-hidden />}
                {done ? "✓" : i + 1}
              </button>
              <div className={`flex flex-col ${i === 0 ? "items-start" : i === steps.length - 1 ? "items-end" : "items-center"}`}>
                <span
                  className={`text-sm transition-colors duration-300 ${
                    active ? "text-paper font-medium" : done ? "text-paper/70" : "text-ink-muted"
                  }`}
                >
                  {step.title}
                </span>
                <span className="text-[10px] font-mono text-ink-muted/70">{step.stages}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
