import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomStore } from "@/shared/store/roomStore";
import { roomDimensionsCm } from "@/shared/lib/units";
import type { Placement } from "@/shared/types";
import { Badge, Spinner } from "@/shared/ui/Primitives";
import { OpeningsLayer } from "@/shared/ui/OpeningsLayer";

const FALLBACK_SCALE = 0.55; // px per cm before the canvas has been measured
const PAD_PX = 48; // breathing room around the room at 100% zoom
const TOP_BAR_PX = 44; // space for the status badge and zoom controls

/** Fill/stroke per furniture type, matching the Stage 1 preview palette. */
const TYPE_COLORS: [string, string, string][] = [
  ["bed", "#cfe0f2", "#3e7bb0"],
  ["wardrobe", "#efe2c2", "#a8843f"],
  ["sofa", "#cfe8da", "#3c7a5d"],
  ["couch", "#cfe8da", "#3c7a5d"],
  ["table", "#f2d9d2", "#b0604f"],
  ["desk", "#d9e6f2", "#5c87ac"],
  ["chair", "#e6e8ec", "#6b7380"],
  ["shelf", "#f0e6cf", "#9c7d3e"],
];
function colorsFor(label: string): [string, string] {
  const lower = label.toLowerCase();
  const hit = TYPE_COLORS.find(([key]) => lower.includes(key));
  return hit ? [hit[1], hit[2]] : ["#d6e9e0", "#2e7d5b"];
}

/** Fit a label into `maxPx`, shortening with an ellipsis if needed. */
function fitLabel(label: string, maxPx: number, charPx = 6.6): string {
  const maxChars = Math.floor(maxPx / charPx);
  if (label.length <= maxChars) return label;
  return maxChars <= 1 ? "" : `${label.slice(0, maxChars - 1)}…`;
}

export function FloorPlanCanvas() {
  const { room, activePlacements, activeFeasible, activeViolations, validating, revalidateActive } = useRoomStore();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  // The item under the pointer follows it instantly; everything else glides.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<{ itemId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Measure the canvas so the room is drawn as large as it fits.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ w: width, h: height });
    });
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  const selectedPlacement = activePlacements.find((p) => p.item_id === selected) ?? null;

  function removeSelected() {
    if (!selectedPlacement) return;
    setSelected(null);
    revalidateActive(
      activePlacements.filter((p) => p.item_id !== selectedPlacement.item_id),
      `Removed ${selectedPlacement.label}`
    );
  }

  // Delete / Backspace removes the selected item, unless the user is typing.
  useEffect(() => {
    if (!selectedPlacement) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!room) return null;
  const [lengthCm, widthCm] = roomDimensionsCm(room.dimensions);
  // px per cm at 100% zoom: as large as fits inside the measured canvas.
  const scale = box
    ? Math.max(0.1, Math.min((box.w - 2 * PAD_PX) / lengthCm, (box.h - TOP_BAR_PX - 2 * PAD_PX) / widthCm))
    : FALLBACK_SCALE;

  const violatingLabels = new Set(
    activePlacements.filter((p) => activeViolations.some((v) => v.includes(p.label))).map((p) => p.item_id)
  );

  function toRoomDelta(dxPx: number, dyPx: number) {
    return { dx: dxPx / (scale * zoom), dy: dyPx / (scale * zoom) };
  }

  function onItemPointerDown(e: React.PointerEvent, p: Placement) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setSelected(p.item_id);
    setDraggingId(p.item_id);
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
    setDraggingId(null);
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

  const roomWidthPx = lengthCm * scale;
  const roomHeightPx = widthCm * scale;
  // Centre the (zoomed) room in the canvas, below the top bar.
  const offsetX = box ? (box.w - roomWidthPx * zoom) / 2 : 40;
  const offsetY = box ? TOP_BAR_PX + (box.h - TOP_BAR_PX - roomHeightPx * zoom) / 2 : 40;

  return (
    <div ref={measureRef} className="relative h-full w-full overflow-hidden blueprint-surface rounded-2xl border border-white/10">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        {activeFeasible ? (
          <span key="ok" className="animate-fade-in">
            <Badge tone="good">Feasible — no violations</Badge>
          </span>
        ) : (
          <span key="bad" className="animate-fade-in">
            <Badge tone="bad">{activeViolations.length} violation{activeViolations.length === 1 ? "" : "s"}</Badge>
          </span>
        )}
        {validating && <Spinner />}
        {selectedPlacement && (
          <button
            className="btn-danger !px-2 !py-1 text-xs bg-ink-800/90"
            onClick={removeSelected}
            title="Or press Delete"
          >
            Remove {selectedPlacement.label}
          </button>
        )}
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        <button className="btn-ghost !px-2 !py-1 bg-ink-800/90" onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}>
          −
        </button>
        <span className="text-xs font-mono w-10 text-center bg-ink-800/90 border border-white/10 rounded-sm py-1">{Math.round(zoom * 100)}%</span>
        <button className="btn-ghost !px-2 !py-1 bg-ink-800/90" onClick={() => setZoom((z) => Math.min(3, z + 0.15))}>
          +
        </button>
        <button
          className="btn-ghost !px-2 !py-1 bg-ink-800/90"
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
        <g transform={`translate(${pan.x + offsetX}, ${pan.y + offsetY}) scale(${zoom})`}>
          <rect
            x={0}
            y={0}
            width={roomWidthPx}
            height={roomHeightPx}
            fill="#faf8f2"
            stroke="#232A33"
            strokeWidth={2}
          />
          <OpeningsLayer
            openings={room.openings ?? []}
            lengthCm={lengthCm}
            widthCm={widthCm}
            scale={scale}
          />
          {activePlacements.map((p) => {
            const rotated = p.rotation_deg === 90 || p.rotation_deg === 270;
            const w = (rotated ? p.depth_cm : p.width_cm) * scale;
            const h = (rotated ? p.width_cm : p.depth_cm) * scale;
            const x = p.x_cm * scale;
            const y = p.y_cm * scale;
            // Turn the label sideways on tall, narrow items where it fits better.
            const vertical = h > w * 1.4 && fitLabel(p.label, w - 8) !== p.label;
            const label = fitLabel(p.label, (vertical ? h : w) - 8);
            const isViolating = violatingLabels.has(p.item_id);
            const isSelected = selected === p.item_id;
            return (
              <g
                key={p.item_id}
                onPointerDown={(e) => onItemPointerDown(e, p)}
                onPointerMove={onItemPointerMove}
                onPointerUp={(e) => onItemPointerUp(e, p)}
                className="cursor-move"
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                  transition: draggingId === p.item_id ? "none" : "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <rect
                  x={0}
                  y={0}
                  width={w}
                  height={h}
                  rx={3}
                  fill={isViolating ? "#f6b6ab" : colorsFor(p.label)[0]}
                  stroke={isSelected ? "#B8863B" : isViolating ? "#c0392b" : colorsFor(p.label)[1]}
                  strokeWidth={isSelected ? 3 : 2}
                  className={isViolating ? "animate-soft-pulse" : undefined}
                  style={{
                    transition: "fill 300ms, stroke 300ms, width 450ms, height 450ms",
                    filter: isSelected ? "drop-shadow(0 4px 10px rgba(184, 134, 59, 0.45))" : undefined,
                  }}
                />
                <text
                  x={w / 2}
                  y={h / 2}
                  transform={vertical ? `rotate(-90 ${w / 2} ${h / 2})` : undefined}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={12}
                  fontWeight={500}
                  fill="#222"
                  className="select-none pointer-events-none"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {!activeFeasible && (
        <div className="absolute bottom-0 left-0 right-0 bg-clay-600/85 backdrop-blur-md border-t border-clay-400/40 text-paper text-xs px-4 py-2 max-h-24 overflow-y-auto animate-fade-up">
          {activeViolations.map((v, i) => (
            <div key={i}>· {v}</div>
          ))}
        </div>
      )}
    </div>
  );
}
