import { STAGE_META } from "../../types";
import type { WizardStep } from "../../store/roomStore";

const STEP_ORDER: WizardStep[] = ["input", "analysis", "model", "studio", "recommendations"];

// Maps the 12 stages from the workflow diagram onto the 5 screens the
// UI actually navigates between (4 through 11 are one continuous
// "studio" loop rather than 8 separate pages).
function stageScreen(stageId: number): WizardStep {
  if (stageId === 1) return "input";
  if (stageId === 2) return "analysis";
  if (stageId === 3) return "model";
  if (stageId === 12) return "recommendations";
  return "studio";
}

export function StageRail({ current, hasPhoto }: { current: WizardStep; hasPhoto: boolean }) {
  const currentIndex = STEP_ORDER.indexOf(current);
  const visibleStages = STAGE_META.filter((s) => hasPhoto || s.id !== 2);

  return (
    <nav aria-label="RoomSpace workflow stages" className="hidden lg:block w-[248px] shrink-0">
      <ol className="space-y-0.5">
        {visibleStages.map((stage) => {
          const screen = stageScreen(stage.id);
          const screenIndex = STEP_ORDER.indexOf(screen);
          const isCurrent = screen === current;
          const isDone = screenIndex < currentIndex;
          return (
            <li key={stage.id}>
              <div
                className={`flex items-start gap-3 rounded-sm px-2.5 py-2 border-l-2 ${
                  isCurrent
                    ? "border-blueprint-600 bg-blueprint-50"
                    : isDone
                    ? "border-moss-500/50"
                    : "border-transparent"
                }`}
              >
                <span
                  className={`font-mono text-[11px] mt-0.5 h-4 w-4 flex items-center justify-center rounded-full border ${
                    isCurrent
                      ? "bg-blueprint-600 text-paper border-blueprint-600"
                      : isDone
                      ? "bg-moss-500 text-paper border-moss-500"
                      : "text-ink-muted border-ink/20"
                  }`}
                >
                  {isDone ? "✓" : stage.id}
                </span>
                <span className={`text-[13px] leading-tight ${isCurrent ? "text-ink font-medium" : "text-ink-muted"}`}>
                  {stage.title}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
