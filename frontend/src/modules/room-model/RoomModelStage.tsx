import { useRoomStore } from "@/shared/store/roomStore";
import { Card, SectionHeading, Spinner } from "@/shared/ui/Primitives";
import { roomDimensionsCm } from "@/shared/lib/units";
import { openingFitErrors } from "@/shared/lib/constraintEngine";
import { OpeningsEditor } from "./OpeningsEditor";

export function RoomModelStage() {
  const { room, furniture, openings, generateAndRank, generating, removeFurnitureItem } = useRoomStore();
  if (!room) return null;

  const [lengthCm, widthCm] = roomDimensionsCm(room.dimensions);
  const roomAreaM2 = (lengthCm * widthCm) / 10000;
  const furnitureAreaCm2 = furniture.reduce((sum, f) => sum + f.width_cm * f.depth_cm, 0);
  const freeAreaM2 = Math.max(0, roomAreaM2 - furnitureAreaCm2 / 10000);
  const fixedCount = furniture.filter((f) => f.is_fixed).length;
  const openingsInvalid = openingFitErrors(openings, lengthCm, widthCm).length > 0;

  return (
    <div className="max-w-3xl">
      <SectionHeading
        eyebrow="Stage 3"
        title="Structured room model"
        description="Your verified inputs, converted into the walls, furniture and free-space representation the Layout Engine works from."
      />

      <Card className="space-y-5 stagger">
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Footprint" value={`${lengthCm.toFixed(0)}×${widthCm.toFixed(0)} cm`} />
          <Stat label="Room area" value={`${roomAreaM2.toFixed(1)} m²`} />
          <Stat label="Est. free space" value={`${freeAreaM2.toFixed(1)} m²`} />
          <Stat label="Fixed items" value={String(fixedCount)} />
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="field-label mb-2">Furniture &amp; constraints entering the layout engine</p>
          {furniture.length === 0 ? (
            <p className="text-sm text-ink-muted">No furniture yet — the room will be generated empty.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {furniture.map((f, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span>{f.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-ink-muted font-mono text-xs">
                      {f.width_cm}×{f.depth_cm}cm · {f.is_fixed ? "fixed" : "movable"}
                      {f.approximate_zone ? ` · ${f.approximate_zone}` : ""}
                    </span>
                    <button
                      className="text-xs text-clay-400 hover:underline"
                      onClick={() => removeFurnitureItem(i)}
                      aria-label={`Remove ${f.label}`}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-white/10 pt-4">
          <OpeningsEditor lengthCm={lengthCm} widthCm={widthCm} />
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="field-label mb-2">Hard constraints that will be enforced</p>
          <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
            {["Room boundaries", "No overlap", "Door clearance", "Window unobstructed", "Fixed-item rules", "Min. walking space (75cm)"].map(
              (c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 border border-white/15 rounded-full px-2.5 py-1 transition-colors hover:border-moss-500/50 hover:text-paper"
                >
                  <span className="h-1 w-1 rounded-full bg-moss-500" aria-hidden />
                  {c}
                </span>
              )
            )}
          </div>
        </div>

        <div className="pt-2">
          <button className="btn-primary" disabled={generating || openingsInvalid} onClick={generateAndRank}>
            {generating ? <Spinner label="Generating candidate layouts…" /> : "Generate layouts"}
          </button>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/15">
      <p className="text-ink-muted text-[11px]">{label}</p>
      <p className="font-display text-xl text-paper mt-0.5 tracking-tight">{value}</p>
    </div>
  );
}
