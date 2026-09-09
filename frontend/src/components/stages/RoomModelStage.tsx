import { useRoomStore } from "../../store/roomStore";
import { Card, SectionHeading, Spinner } from "../ui/Primitives";
import { roomDimensionsCm } from "../../lib/units";

export function RoomModelStage() {
  const { room, furniture, generateAndRank, generating } = useRoomStore();
  if (!room) return null;

  const [lengthCm, widthCm] = roomDimensionsCm(room.dimensions);
  const roomAreaM2 = (lengthCm * widthCm) / 10000;
  const furnitureAreaCm2 = furniture.reduce((sum, f) => sum + f.width_cm * f.depth_cm, 0);
  const freeAreaM2 = Math.max(0, roomAreaM2 - furnitureAreaCm2 / 10000);
  const fixedCount = furniture.filter((f) => f.is_fixed).length;

  return (
    <div className="max-w-3xl">
      <SectionHeading
        eyebrow="Stage 3"
        title="Structured room model"
        description="Your verified inputs, converted into the walls, furniture and free-space representation the Layout Engine works from."
      />

      <Card className="space-y-5">
        <div className="grid grid-cols-4 gap-4 font-mono text-sm">
          <Stat label="Footprint" value={`${lengthCm.toFixed(0)}×${widthCm.toFixed(0)} cm`} />
          <Stat label="Room area" value={`${roomAreaM2.toFixed(1)} m²`} />
          <Stat label="Est. free space" value={`${freeAreaM2.toFixed(1)} m²`} />
          <Stat label="Fixed items" value={String(fixedCount)} />
        </div>

        <div className="border-t border-ink/10 pt-4">
          <p className="field-label mb-2">Furniture &amp; constraints entering the layout engine</p>
          {furniture.length === 0 ? (
            <p className="text-sm text-ink-muted">No furniture yet — the room will be generated empty.</p>
          ) : (
            <ul className="divide-y divide-ink/8">
              {furniture.map((f, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span>{f.label}</span>
                  <span className="text-ink-muted font-mono text-xs">
                    {f.width_cm}×{f.depth_cm}cm · {f.is_fixed ? "fixed" : "movable"}
                    {f.approximate_zone ? ` · ${f.approximate_zone}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-ink/10 pt-4">
          <p className="field-label mb-2">Hard constraints that will be enforced</p>
          <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
            {["Room boundaries", "No overlap", "Door clearance", "Window unobstructed", "Fixed-item rules", "Min. walking space (75cm)"].map(
              (c) => (
                <span key={c} className="border border-ink/15 rounded-sm px-2 py-1">
                  {c}
                </span>
              )
            )}
          </div>
        </div>

        <div className="pt-2">
          <button className="btn-primary" disabled={generating} onClick={generateAndRank}>
            {generating ? <Spinner label="Generating candidate layouts…" /> : "Generate layouts"}
          </button>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-ink-muted text-[11px] font-sans">{label}</p>
      <p className="text-ink">{value}</p>
    </div>
  );
}
