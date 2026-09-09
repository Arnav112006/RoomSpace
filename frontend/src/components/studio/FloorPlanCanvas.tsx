import { useRef, useState } from "react";
import { useRoomStore } from "../../store/roomStore";
import { roomDimensionsCm } from "../../lib/units";
import type { Placement } from "../../types";
import { Badge, Spinner } from "../ui/Primitives";

const SCALE_PX_PER_CM = 0.55;

export function FloorPlanCanvas() {
  const { room, activePlacements, activeFeasible, activeViolations, validating, revalidateActive } = useRoomStore();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<{ itemId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!room) return null;
  const [lengthCm, widthCm] = roomDimensionsCm(room.dimensions);

  const violatingLabels = new Set(
    activePlacements.filter((p) => activeViolations.some((v) => v.includes(p.label))).map((p) => p.item_id)
  );

  function toRoomDelta(dxPx: number, dyPx: number) {
    return { dx: dxPx / (SCALE_PX_PER_CM * zoom), dy: dyPx / (SCALE_PX_PER_CM * zoom) };
  }

  function onItemPointerDown(e: React.PointerEvent, p: Placement) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setSelected(p.item_id);
    dragRef.current = { itemId: p.item_id, startX: e.clientX, startY: e.clientY, origX: p.x_cm, origY: p.y_cm };
  }

  function onItemPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const { itemId, startX, startY, origX, origY } = dragRef.current;
    const { dx, dy } = toRoomDelta(e.clientX - startX, e.clientY - startY);
    const updated = activePlacements.map((p) =>
      p.item_id === itemId ? { ...p, x_cm: Math.max(0, origX + dx), y_cm: Math.max(0, origY + dy) } : p
    );
    useRoomStore.setState({ activePlacements: updated });
  }

  function onItemPointerUp(e: React.PointerEvent, p: Placement) {
    if (!dragRef.current) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    revalidateActive(useRoomStore.getState().activePlacements, `Moved ${p.label}`);
  }

  function onBgPointerDown(e: React.PointerEvent) {
    setSelected(null);
    panRef.current = { startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onBgPointerMove(e: React.PointerEvent) {
    if (!panRef.current) return;
    const { startX, startY, origX, origY } = panRef.current;
    setPan({ x: origX + (e.clientX - startX), y: origY + (e.clientY - startY) });
  }
  function onBgPointerUp(e: React.PointerEvent) {
    panRef.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
  }

  const roomWidthPx = lengthCm * SCALE_PX_PER_CM;
  const roomHeightPx = widthCm * SCALE_PX_PER_CM;

  return (
    <div className="relative h-full w-full overflow-hidden blueprint-surface rounded-md border border-ink/10">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        {activeFeasible ? (
          <Badge tone="good">Feasible — no violations</Badge>
        ) : (
          <Badge tone="bad">{activeViolations.length} violation{activeViolations.length === 1 ? "" : "s"}</Badge>
        )}
        {validating && <Spinner />}
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        <button className="btn-ghost !px-2 !py-1 bg-white/80" onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}>
          −
        </button>
        <span className="text-xs font-mono w-10 text-center bg-white/80 rounded-sm py-1">{Math.round(zoom * 100)}%</span>
        <button className="btn-ghost !px-2 !py-1 bg-white/80" onClick={() => setZoom((z) => Math.min(3, z + 0.15))}>
          +
        </button>
        <button
          className="btn-ghost !px-2 !py-1 bg-white/80"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Reset
        </button>
      </div>

      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerUp={onBgPointerUp}
      >
        <g transform={`translate(${pan.x + 40}, ${pan.y + 40}) scale(${zoom})`}>
          <rect
            x={0}
            y={0}
            width={roomWidthPx}
            height={roomHeightPx}
            fill="#faf8f2"
            stroke="#232A33"
            strokeWidth={2}
          />
          {activePlacements.map((p) => {
            const rotated = p.rotation_deg === 90 || p.rotation_deg === 270;
            const w = (rotated ? p.depth_cm : p.width_cm) * SCALE_PX_PER_CM;
            const h = (rotated ? p.width_cm : p.depth_cm) * SCALE_PX_PER_CM;
            const x = p.x_cm * SCALE_PX_PER_CM;
            const y = p.y_cm * SCALE_PX_PER_CM;
            const isViolating = violatingLabels.has(p.item_id);
            const isSelected = selected === p.item_id;
            return (
              <g
                key={p.item_id}
                onPointerDown={(e) => onItemPointerDown(e, p)}
                onPointerMove={onItemPointerMove}
                onPointerUp={(e) => onItemPointerUp(e, p)}
                className="cursor-move"
              >
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={3}
                  fill={isViolating ? "#f6b6ab" : "#a8d5c2"}
                  stroke={isSelected ? "#B8863B" : isViolating ? "#c0392b" : "#2e7d5b"}
                  strokeWidth={isSelected ? 3 : 2}
                />
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="#222"
                  className="select-none pointer-events-none"
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {!activeFeasible && (
        <div className="absolute bottom-0 left-0 right-0 bg-clay-500/95 text-paper text-xs px-4 py-2 max-h-24 overflow-y-auto">
          {activeViolations.map((v, i) => (
            <div key={i}>· {v}</div>
          ))}
        </div>
      )}
    </div>
  );
}
