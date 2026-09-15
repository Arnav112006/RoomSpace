import { useEffect } from "react";
import { useRoomStore } from "@/shared/store/roomStore";
import { Header } from "@/shared/layout/Header";
import { StageRail } from "@/shared/layout/StageRail";
import { RoomInputStage } from "@/modules/room-input/RoomInputStage";
import { AnalysisStage } from "@/modules/analysis/AnalysisStage";
import { RoomModelStage } from "@/modules/room-model/RoomModelStage";
import { StudioLayout } from "@/modules/studio/StudioLayout";
import { RecommendationsStage } from "@/modules/recommendations/RecommendationsStage";

export default function App() {
  const step = useRoomStore((s) => s.step);
  const photoFile = useRoomStore((s) => s.photoFile);
  const checkBackend = useRoomStore((s) => s.checkBackend);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8 flex gap-8">
        <StageRail current={step} hasPhoto={!!photoFile} />
        <main className="flex-1 min-w-0">
          {step === "input" && <RoomInputStage />}
          {step === "analysis" && <AnalysisStage />}
          {step === "model" && <RoomModelStage />}
          {step === "studio" && <StudioLayout />}
          {step === "recommendations" && <RecommendationsStage />}
        </main>
      </div>
      <footer className="border-t border-white/10 py-4">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between text-xs text-ink-muted">
          <span>RoomSpace — physically feasible layouts first, styling second.</span>
          <a
            href="https://github.com/Arnav112006/RoomSpace"
            target="_blank"
            rel="noreferrer"
            className="hover:text-paper transition-colors"
          >
            github.com/Arnav112006/RoomSpace
          </a>
        </div>
      </footer>
    </div>
  );
}
