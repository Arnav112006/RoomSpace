import { lazy, Suspense, useMemo } from "react";
import { useRoomStore } from "@/shared/store/roomStore";
import { categoryForLabel } from "@/shared/lib/catalog";
import { roomDimensionsCm } from "@/shared/lib/units";
import type { RoomItem } from "@/shared/lib/room3d";
import { ThemePicker } from "@/shared/ui/ThemePicker";
import { SectionHeading } from "@/shared/ui/Primitives";
import { CandidatePanel } from "./CandidatePanel";
import { FloorPlanCanvas } from "./FloorPlanCanvas";
import { CommandBar } from "./CommandBar";
import { VersionHistory } from "./VersionHistory";

// three.js is large; only load it once the studio is opened.
const Room3DView = lazy(() => import("@/shared/ui/Room3DView"));

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function StudioLayout() {
  const {
    generating, activeFeasible, room, activePlacements, activeViolations,
    viewTheme, setViewTheme, styleOverrides, resetStyle, styleSuggestion,
  } = useRoomStore();
  const goToRecommendations = () => useRoomStore.setState({ step: "recommendations" });

  // The 3D view follows the active layout: every drag, command, candidate
  // switch or version restore changes activePlacements and rebuilds it.
  const items3d = useMemo<RoomItem[]>(
    () => activePlacements.map((placement) => ({ placement, category: categoryForLabel(placement.label) })),
    [activePlacements]
  );
  // Pieces named in a violation ("Bed overlaps with Desk", "Only 60cm between…").
  const flaggedIds = useMemo(
    () =>
      activePlacements
        .filter((p) => activeViolations.some((v) => new RegExp(`\\b${escapeRegExp(p.label)}\\b`).test(v)))
        .map((p) => p.item_id),
    [activePlacements, activeViolations]
  );
  const openings = useMemo(() => room?.openings ?? [], [room]);
  // Preview the 3D room in another theme ("make it industrial" does the
  // same); the room's saved theme is unchanged.
  const theme3d = viewTheme ?? room?.theme ?? "Modern";
  const customised =
    !!styleOverrides.wall || !!styleOverrides.floor || !!styleOverrides.floorKind || Object.keys(styleOverrides.items).length > 0;
  const topSuggestion = styleSuggestion?.themes[0];

  return (
    <div className="h-full flex flex-col">
      <SectionHeading
        eyebrow="Stages 4–11"
        title="Design studio"
        description="Generated candidates are validated, scored and ranked automatically. Pick one, drag furniture or type a command — every change is re-validated and saved as a version."
      />

      {generating ? (
        <div className="grid grid-cols-[280px,1fr,280px] gap-5 min-h-[560px]" aria-busy="true">
          <span className="sr-only">Generating and scoring candidate layouts…</span>
          <div className="panel skeleton" />
          <div className="panel skeleton" />
          <div className="panel skeleton" />
        </div>
      ) : (
        <div className="grid grid-cols-[280px,1fr,280px] gap-5 flex-1 min-h-[560px] stagger">
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
        <div className="panel p-4 mt-5 space-y-3 animate-fade-up [animation-delay:200ms]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Your layout in 3D</p>
              <p className="text-xs text-ink-muted">
                Updates as you change the layout. Pieces breaking a rule are outlined in red. Try “paint the walls
                beige” or “make the floor dark wood” in the command box.
              </p>
            </div>
            <ThemePicker compact value={theme3d} roomTheme={room.theme} onChange={setViewTheme} label="Preview the 3D room in a theme" />
            <span className={`text-xs ${activeFeasible ? "text-moss-400" : "text-clay-400"}`}>
              {activeFeasible ? "Feasible" : `${activeViolations.length} violation${activeViolations.length === 1 ? "" : "s"}`}
            </span>
          </div>
          {(topSuggestion || customised) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {topSuggestion && (
                <button
                  className="rounded-full border border-white/10 px-2.5 py-1 text-ink-muted hover:text-paper hover:border-white/25"
                  onClick={() => setViewTheme(topSuggestion.theme)}
                  title="CLIP's best guess from your photos — click to preview it"
                >
                  Your photos look <span className="text-brass-700">{topSuggestion.theme}</span>{" "}
                  ({Math.round(topSuggestion.score * 100)}%)
                </button>
              )}
              {customised && (
                <span className="inline-flex items-center gap-2 rounded-full border border-brass-400/40 px-2.5 py-1">
                  {[styleOverrides.wall, styleOverrides.floor, ...Object.values(styleOverrides.items)]
                    .filter(Boolean)
                    .map((c, i) => (
                      <span key={i} className="h-3 w-3 rounded-full ring-1 ring-white/20" style={{ background: c }} aria-hidden />
                    ))}
                  Custom colours
                  <button className="text-ink-muted hover:text-paper underline" onClick={resetStyle}>
                    Reset
                  </button>
                </span>
              )}
            </div>
          )}
          <Suspense fallback={<div className="skeleton rounded-xl h-[460px]" aria-hidden />}>
            <Room3DView
              lengthCm={roomDimensionsCm(room.dimensions)[0]}
              widthCm={roomDimensionsCm(room.dimensions)[1]}
              openings={openings}
              items={items3d}
              theme={theme3d}
              flaggedIds={flaggedIds}
              overrides={styleOverrides}
            />
          </Suspense>
        </div>
      )}

      {!generating && room && (
        <div className="flex items-center justify-between gap-6 mt-6 animate-fade-up [animation-delay:300ms]">
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
