import { useRoomStore } from "@/shared/store/roomStore";
import type { Opening, WallSide } from "@/shared/types";
import { openingFitErrors } from "@/shared/lib/constraintEngine";
import { OpeningsLayer } from "@/shared/ui/OpeningsLayer";
import { NumberInput } from "@/shared/ui/NumberInput";

const WALLS: WallSide[] = ["north", "south", "east", "west"];

/** Where offset is measured from, per docs/room-model.md §4. */
function offsetFrom(wall: WallSide) {
  return wall === "north" || wall === "south" ? "from left (west) end" : "from top (north) end";
}

export function OpeningsEditor({ lengthCm, widthCm }: { lengthCm: number; widthCm: number }) {
  const { openings, openingsError, addOpening, updateOpening, removeOpening } = useRoomStore();
  const fitErrors = openingFitErrors(openings, lengthCm, widthCm);

  const previewScale = 220 / Math.max(lengthCm, widthCm);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="field-label !mb-0">Doors &amp; windows</p>
        <div className="flex gap-2">
          <button className="btn-ghost !px-3 !py-1 text-xs" onClick={() => addOpening("door")}>
            + Door
          </button>
          <button className="btn-ghost !px-3 !py-1 text-xs" onClick={() => addOpening("window")}>
            + Window
          </button>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        <svg
          width={lengthCm * previewScale + 16}
          height={widthCm * previewScale + 16}
          className="shrink-0"
          aria-label="Room preview with doors and windows"
        >
          <g transform="translate(8, 8)">
            <rect
              width={lengthCm * previewScale}
              height={widthCm * previewScale}
              fill="#faf8f2"
              stroke="#232A33"
              strokeWidth={2}
            />
            <OpeningsLayer openings={openings} lengthCm={lengthCm} widthCm={widthCm} scale={previewScale} />
            <text x={4} y={12} fontSize={9} fill="#8b98a5">
              N ↑
            </text>
          </g>
        </svg>

        <div className="flex-1 space-y-2 min-w-0">
          {openings.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No doors or windows yet. Add them so layouts keep doorways clear and don't wall off windows.
            </p>
          ) : (
            openings.map((o) => <OpeningRow key={o.id} opening={o} onChange={updateOpening} onRemove={removeOpening} />)
          )}
        </div>
      </div>

      {[...fitErrors, ...(openingsError && !fitErrors.includes(openingsError) ? [openingsError] : [])].map((e) => (
        <p key={e} className="text-xs text-clay-400">
          {e}
        </p>
      ))}
    </div>
  );
}

function OpeningRow({
  opening: o,
  onChange,
  onRemove,
}: {
  opening: Opening;
  onChange: (id: string, patch: Partial<Opening>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="border border-white/10 rounded-sm p-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm capitalize">{o.kind}</span>
        <button className="text-xs text-clay-400" onClick={() => onRemove(o.id)}>
          Remove
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-ink-muted">
          Wall
          <select
            value={o.wall}
            onChange={(e) => onChange(o.id, { wall: e.target.value as WallSide })}
            className="w-full mt-1"
          >
            {WALLS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-muted">
          Offset (cm)
          <NumberInput
            min={0}
            value={o.offset_cm}
            onChange={(offset_cm) => onChange(o.id, { offset_cm })}
            className="w-full mt-1"
          />
        </label>
        <label className="text-xs text-ink-muted">
          Width (cm)
          <NumberInput
            min={1}
            value={o.width_cm}
            onChange={(width_cm) => onChange(o.id, { width_cm })}
            className="w-full mt-1"
          />
        </label>
      </div>
      <p className="text-[11px] text-ink-muted">Offset is measured {offsetFrom(o.wall)} of the wall.</p>
      {o.kind === "door" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-ink-muted">
            Hinge side
            <select
              value={o.hinge ?? "start"}
              onChange={(e) => onChange(o.id, { hinge: e.target.value as "start" | "end" })}
              className="w-full mt-1"
            >
              <option value="start">{o.wall === "north" || o.wall === "south" ? "left (west)" : "top (north)"}</option>
              <option value="end">{o.wall === "north" || o.wall === "south" ? "right (east)" : "bottom (south)"}</option>
            </select>
          </label>
          <label className="text-xs text-ink-muted">
            Opens
            <select
              value={o.swing ?? "inward"}
              onChange={(e) => onChange(o.id, { swing: e.target.value as "inward" | "outward" })}
              className="w-full mt-1"
            >
              <option value="inward">into the room</option>
              <option value="outward">out of the room</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
