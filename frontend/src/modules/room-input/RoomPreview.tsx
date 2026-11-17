import type { RoomDimensions } from "@/shared/types";
import { roomDimensionsCm } from "@/shared/lib/units";

// Typical footprints (cm), matching the defaults the store seeds.
const FOOTPRINT: Record<string, [number, number]> = {
  bed: [150, 200],
  wardrobe: [120, 60],
  sofa: [180, 90],
  table: [140, 80],
  chair: [45, 45],
  desk: [120, 60],
  shelf: [90, 30],
};

const TINT: Record<string, string> = {
  bed: "from-blueprint-500/50 to-blueprint-400/25 border-blueprint-600/70",
  wardrobe: "from-brass-400/45 to-brass-500/20 border-brass-400/70",
  sofa: "from-moss-500/45 to-moss-600/20 border-moss-400/70",
  table: "from-clay-400/40 to-clay-500/15 border-clay-400/60",
  chair: "from-paper/30 to-paper/10 border-paper/50",
  desk: "from-blueprint-200/40 to-blueprint-300/15 border-blueprint-200/60",
  shelf: "from-brass-200/40 to-brass-300/15 border-brass-200/60",
};

const LABEL: Record<string, string> = {
  bed: "Bed", wardrobe: "Wardrobe", sofa: "Sofa", table: "Table", chair: "Chair", desk: "Desk", shelf: "Shelf",
};

// The preview box is a 5:4 stage measured in abstract units.
const STAGE_W = 500;
const STAGE_H = 400;
const GAP_CM = 15;

interface Block {
  id: string;
  x: number;
  y: number;
  w: number;
  d: number;
}

/** Simple left-to-right, row-by-row packing — enough to give a feel for scale. */
function pack(ids: string[], lengthCm: number): Block[] {
  const blocks: Block[] = [];
  let x = GAP_CM;
  let y = GAP_CM;
  let rowDepth = 0;
  for (const id of ids) {
    const [w, d] = FOOTPRINT[id] ?? [60, 60];
    if (x + w + GAP_CM > lengthCm && x > GAP_CM) {
      x = GAP_CM;
      y += rowDepth + GAP_CM;
      rowDepth = 0;
    }
    blocks.push({ id, x, y, w, d });
    x += w + GAP_CM;
    rowDepth = Math.max(rowDepth, d);
  }
  return blocks;
}

function formatLength(value: number, unit: string) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
}

/**
 * Live, to-scale sketch of the room being described: its shape follows the
 * typed dimensions and the requested furniture appears inside it. Purely a
 * preview — real layouts are generated and validated in the studio.
 */
export function RoomPreview({
  dimensions,
  furniture,
  photoCount,
}: {
  dimensions: RoomDimensions;
  furniture: string[];
  photoCount: number;
}) {
  const [lengthCm, widthCm] = roomDimensionsCm(dimensions);
  const scale = Math.min((STAGE_W * 0.8) / lengthCm, (STAGE_H * 0.72) / widthCm);
  const roomW = (lengthCm * scale) / STAGE_W; // fraction of stage width
  const roomH = (widthCm * scale) / STAGE_H; // fraction of stage height
  const blocks = pack(furniture, lengthCm);
  const usedCm2 = blocks.reduce((sum, b) => sum + b.w * b.d, 0);
  const areaM2 = (lengthCm * widthCm) / 10000;
  const fill = Math.min(1, usedCm2 / (lengthCm * widthCm));

  const pct = (n: number) => `${(n * 100).toFixed(3)}%`;
  const ease = "all 600ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div className="panel p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="label-eyebrow">Live preview</p>
          <p className="text-sm text-paper/80 mt-0.5">Your room, to scale</p>
        </div>
        <div className="flex items-center gap-2">
          {photoCount > 0 && (
            <span className="rounded-full border border-blueprint-600/40 bg-blueprint-600/10 px-2.5 py-1 text-[11px] text-blueprint-700 animate-fade-in">
              {photoCount} photo{photoCount === 1 ? "" : "s"}
            </span>
          )}
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-mono text-paper/70">
            {areaM2.toFixed(1)} m²
          </span>
        </div>
      </div>

      {/* 5:4 drawing stage */}
      <div className="relative w-full blueprint-surface rounded-xl border border-white/[0.06]" style={{ aspectRatio: "5 / 4" }}>
        {/* Compass */}
        <div className="absolute top-3 right-3 flex flex-col items-center text-[10px] font-mono text-paper/50">
          <span className="text-brass-300">N</span>
          <span className="h-4 w-px bg-gradient-to-b from-brass-300 to-transparent" />
        </div>

        {/* Room, centred; size follows the typed dimensions */}
        <div
          className="absolute"
          style={{
            left: pct((1 - roomW) / 2),
            top: pct((1 - roomH) / 2 + 0.03),
            width: pct(roomW),
            height: pct(roomH),
            transition: ease,
          }}
        >
          {/* Length dimension line */}
          <div className="absolute -top-6 left-0 right-0 flex items-center gap-2 text-[11px] font-mono text-brass-200">
            <span className="h-2 w-px bg-brass-300/70" />
            <span className="flex-1 h-px bg-brass-300/40" />
            <span className="px-1 whitespace-nowrap">{formatLength(dimensions.length, dimensions.unit)}</span>
            <span className="flex-1 h-px bg-brass-300/40" />
            <span className="h-2 w-px bg-brass-300/70" />
          </div>
          {/* Width dimension line */}
          <div className="absolute -left-7 top-0 bottom-0 flex flex-col items-center gap-2 text-[11px] font-mono text-brass-200">
            <span className="w-2 h-px bg-brass-300/70" />
            <span className="flex-1 w-px bg-brass-300/40" />
            <span className="py-1 whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
              {formatLength(dimensions.width, dimensions.unit)}
            </span>
            <span className="flex-1 w-px bg-brass-300/40" />
            <span className="w-2 h-px bg-brass-300/70" />
          </div>

          {/* Walls */}
          <div className="absolute inset-0 rounded-[3px] border-2 border-paper/85 bg-paper/[0.03] shadow-[0_0_40px_-8px_rgba(121,178,230,0.35)] overflow-hidden">
            {blocks.map((b, i) => (
              <div
                key={b.id}
                className={`absolute rounded-[3px] border bg-gradient-to-br backdrop-blur-sm flex items-center justify-center overflow-hidden animate-fade-up ${
                  TINT[b.id] ?? "from-paper/20 to-paper/5 border-paper/40"
                }`}
                style={{
                  left: pct(b.x / lengthCm),
                  top: pct(b.y / widthCm),
                  width: pct(b.w / lengthCm),
                  height: pct(b.d / widthCm),
                  transition: ease,
                  animationDelay: `${i * 50}ms`,
                }}
                title={`${LABEL[b.id] ?? b.id} · ${b.w}×${b.d} cm`}
              >
                <span className="text-[10px] font-medium text-paper/90 truncate px-1">{LABEL[b.id] ?? b.id}</span>
              </div>
            ))}
          </div>
        </div>

        {furniture.length === 0 && (
          <p className="absolute bottom-3 inset-x-0 text-center text-[11px] text-paper/50 animate-fade-in">
            Pick furniture below to see it here
          </p>
        )}
      </div>

      {/* Footprint meter */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-ink-muted">Floor taken by furniture</span>
          <span className={`font-mono ${fill > 0.55 ? "text-clay-400" : "text-paper/80"}`}>{Math.round(fill * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              fill > 0.55 ? "bg-gradient-to-r from-brass-400 to-clay-500" : "bg-gradient-to-r from-moss-500 to-blueprint-600"
            }`}
            style={{ width: `${Math.max(2, fill * 100)}%` }}
          />
        </div>
        <p className="text-[11px] text-ink-muted mt-2">
          A rough sketch — real layouts are generated and checked in the studio.
        </p>
      </div>
    </div>
  );
}
