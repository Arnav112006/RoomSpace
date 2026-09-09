import { useRoomStore } from "../../store/roomStore";
import { Badge } from "../ui/Primitives";

const SCORE_LABELS: { key: keyof import("../../types").ScoredLayout["scores"]; label: string }[] = [
  { key: "aesthetic", label: "Aesthetic" },
  { key: "themeAlignment", label: "Theme" },
  { key: "spaceUtilization", label: "Space use" },
  { key: "accessibility", label: "Accessibility" },
  { key: "budgetCompatibility", label: "Budget" },
];

export function CandidatePanel() {
  const { rankedLayouts, candidates, selectedLayoutId, selectLayout } = useRoomStore();
  const infeasibleCount = candidates.length - rankedLayouts.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="label-eyebrow">Ranked candidates</p>
        {infeasibleCount > 0 && (
          <span className="text-[11px] text-clay-600">{infeasibleCount} discarded (infeasible)</span>
        )}
      </div>

      {rankedLayouts.length === 0 && (
        <p className="text-sm text-ink-muted">No feasible layout was generated for this furniture set — try removing an item or enlarging the room.</p>
      )}

      <div className="space-y-2">
        {rankedLayouts.map((scored, i) => {
          const isSelected = scored.layout.id === selectedLayoutId;
          const style = scored.layout.id.split("-").pop();
          return (
            <button
              key={scored.layout.id}
              onClick={() => selectLayout(scored.layout.id)}
              className={`w-full text-left rounded-sm border p-3 transition-colors ${
                isSelected ? "border-blueprint-600 bg-blueprint-50" : "border-ink/12 bg-white/60 hover:border-ink/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium capitalize">
                  #{i + 1} · {style?.replace("-", " ")}
                </span>
                <Badge tone={isSelected ? "brass" : "neutral"}>{Math.round(scored.scores.total * 100)}</Badge>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {SCORE_LABELS.map(({ key, label }) => (
                  <div key={key} title={label} className="flex flex-col items-center gap-0.5">
                    <div className="h-8 w-full bg-ink/8 rounded-sm relative overflow-hidden">
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-blueprint-600"
                        style={{ height: `${Math.round(scored.scores[key] * 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-ink-muted">{label}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
