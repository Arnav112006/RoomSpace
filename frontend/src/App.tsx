import { useEffect } from "react";
import { useRoomStore } from "./store/roomStore";
import { Header } from "./components/layout/Header";
import { StageRail } from "./components/layout/StageRail";
import { RoomInputStage } from "./components/stages/RoomInputStage";
import { AnalysisStage } from "./components/stages/AnalysisStage";
import { RoomModelStage } from "./components/stages/RoomModelStage";
import { StudioLayout } from "./components/studio/StudioLayout";
import { RecommendationsStage } from "./components/stages/RecommendationsStage";

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
      <footer className="border-t border-ink/10 py-4">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between text-xs text-ink-muted">
          <span>RoomSpace — physically feasible layouts first, styling second.</span>
          <a
            href="https://github.com/Arnav112006/RoomSpace"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink"
          >
            github.com/Arnav112006/RoomSpace
          </a>
        </div>
      </footer>
    </div>
  );
}
