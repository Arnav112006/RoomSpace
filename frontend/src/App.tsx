import { useEffect } from "react";
import { useRoomStore } from "@/shared/store/roomStore";
import { Header } from "@/shared/layout/Header";
import { Stepper } from "@/shared/layout/Stepper";
import { RoomInputStage } from "@/modules/room-input/RoomInputStage";
import { AnalysisStage } from "@/modules/analysis/AnalysisStage";
import { RoomModelStage } from "@/modules/room-model/RoomModelStage";
import { StudioLayout } from "@/modules/studio/StudioLayout";
import { RecommendationsStage } from "@/modules/recommendations/RecommendationsStage";

export default function App() {
  const step = useRoomStore((s) => s.step);
  const hasPhoto = useRoomStore((s) => s.photoFiles.length > 0);
  const checkBackend = useRoomStore((s) => s.checkBackend);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 max-w-[1240px] w-full mx-auto px-6 pt-10 pb-16">
        <Stepper current={step} hasPhoto={hasPhoto} />
        {/* Keyed by step so each screen fades up as it appears. */}
        <main key={step} className="min-w-0 animate-fade-up">
          {step === "input" && <RoomInputStage />}
          {step === "analysis" && <AnalysisStage />}
          {step === "model" && <RoomModelStage />}
          {step === "studio" && <StudioLayout />}
          {step === "recommendations" && <RecommendationsStage />}
        </main>
      </div>
      <footer className="py-5">
        <div className="h-px mb-5 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
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
