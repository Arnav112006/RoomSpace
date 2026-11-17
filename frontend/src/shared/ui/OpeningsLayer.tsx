import type { Opening, WallSide } from "@/shared/types";
import { doorHingePoint, openingSpan, wallPoint } from "@/shared/lib/constraintEngine";

const INWARD_NORMAL: Record<WallSide, [number, number]> = {
  north: [0, 1],
  south: [0, -1],
  west: [1, 0],
  east: [-1, 0],
};

const PAPER = "#faf8f2";
const WINDOW = "#4a90c2";
const DOOR = "#8b6b3d";

/**
 * Draws doors (wall gap + leaf + swing arc) and windows (blue wall
 * segment) inside an SVG whose room origin is at (0, 0). Geometry follows
 * docs/room-model.md §4–5 and matches backend layout_renderer.py.
 */
export function OpeningsLayer({
  openings,
  lengthCm,
  widthCm,
  scale,
  wallStroke = 2,
}: {
  openings: Opening[];
  lengthCm: number;
  widthCm: number;
  scale: number;
  wallStroke?: number;
}) {
  const px = ([x, y]: [number, number]) => [x * scale, y * scale] as const;

  return (
    <g className="pointer-events-none">
      {openings.map((o) => {
        const [s0, s1] = openingSpan(o);
        const [x1, y1] = px(wallPoint(o.wall, s0, lengthCm, widthCm));
        const [x2, y2] = px(wallPoint(o.wall, s1, lengthCm, widthCm));
        const gap = (
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={PAPER} strokeWidth={wallStroke + 2} />
        );

        if (o.kind === "window") {
          return (
            <g key={o.id}>
              {gap}
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={WINDOW} strokeWidth={wallStroke + 1} strokeDasharray="6 3" />
            </g>
          );
        }

        const hinge = doorHingePoint(o, lengthCm, widthCm);
        const free = wallPoint(o.wall, o.hinge === "end" ? s0 : s1, lengthCm, widthCm);
        let [nx, ny] = INWARD_NORMAL[o.wall];
        if (o.swing === "outward") [nx, ny] = [-nx, -ny];
        const leaf: [number, number] = [hinge[0] + nx * o.width_cm, hinge[1] + ny * o.width_cm];
        // y points down, so a positive cross product is a clockwise turn on screen.
        const cross = (leaf[0] - hinge[0]) * (free[1] - hinge[1]) - (leaf[1] - hinge[1]) * (free[0] - hinge[0]);
        const [hx, hy] = px(hinge);
        const [lx, ly] = px(leaf);
        const [fx, fy] = px(free);
        const r = o.width_cm * scale;

        return (
          <g key={o.id}>
            {gap}
            <path
              d={`M ${hx} ${hy} L ${lx} ${ly} A ${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${fx} ${fy}`}
              fill="none"
              stroke={DOOR}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          </g>
        );
      })}
    </g>
  );
}
