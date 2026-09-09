import { useRoomStore } from "../../store/roomStore";
import { SectionHeading, Spinner } from "../ui/Primitives";
import { CandidatePanel } from "./CandidatePanel";
import { FloorPlanCanvas } from "./FloorPlanCanvas";
import { CommandBar } from "./CommandBar";
import { VersionHistory } from "./VersionHistory";

export function StudioLayout() {
  const { generating, activeFeasible, room } = useRoomStore();
  const goToRecommendations = () => useRoomStore.setState({ step: "recommendations" });

  return (
    <div className="h-full flex flex-col">
      <SectionHeading
        eyebrow="Stages 4–11"
        title="Design studio"
        description="Generated candidates are validated, scored and ranked automatically. Pick one, drag furniture or type a command — every change is re-validated and saved as a version."
      />

      {generating ? (
        <div className="py-20 flex justify-center">
          <Spinner label="Generating and scoring candidate layouts…" />
        </div>
      ) : (
        <div className="grid grid-cols-[280px,1fr,280px] gap-5 flex-1 min-h-[560px]">
          <div className="panel p-4 overflow-y-auto">
            <CandidatePanel />
          </div>

          <div className="min-h-[500px]">
            <FloorPlanCanvas />
          </div>

          <div className="flex flex-col gap-5">
            <div className="panel p-4">
              <CommandBar />
            </div>
            <div className="panel p-4 flex-1">
              <VersionHistory />
            </div>
          </div>
        </div>
      )}

      {!generating && room && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-xs text-ink-muted">
            {activeFeasible ? "This layout is feasible." : "This layout has unresolved violations."} You can continue to
            product recommendations regardless — refine first if you'd like a cleaner floor plan.
          </p>
          <button className="btn-primary" onClick={goToRecommendations}>
            Find matching products
          </button>
        </div>
      )}
    </div>
  );
}
