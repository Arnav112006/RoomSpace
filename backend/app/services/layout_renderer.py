"""
Renders a layout as a top-down SVG floor plan — the starting point
for stage 8 (Interactive 2D SVG Visualization). Violating items are
rendered in red so a failed layout is visually obvious.
"""

from dataclasses import dataclass

from app.schemas.layout import Placement
from app.schemas.opening import Opening, OpeningKind, WallSide
from app.schemas.room import RoomDimensions
from app.services.constraint_engine import door_hinge_point, opening_span, wall_point
from app.services.units import room_dimensions_cm

_SCALE = 0.5  # px per cm
_MARGIN = 40

Point = tuple[float, float]

INWARD_NORMAL: dict[WallSide, Point] = {
    WallSide.NORTH: (0.0, 1.0),
    WallSide.SOUTH: (0.0, -1.0),
    WallSide.WEST: (1.0, 0.0),
    WallSide.EAST: (-1.0, 0.0),
}


@dataclass(frozen=True)
class OpeningShape:
    """Where to draw one opening, in room centimetres. For doors,
    `hinge`, `leaf_end` and `free_end` describe the open door leaf and
    its swing arc (leaf_end -> free_end around hinge, radius = width)."""

    kind: OpeningKind
    start: Point
    end: Point
    hinge: Point | None = None
    leaf_end: Point | None = None
    free_end: Point | None = None
    sweep_clockwise: bool = False


def opening_shape(o: Opening, length_cm: float, width_cm: float) -> OpeningShape:
    s0, s1 = opening_span(o)
    start = wall_point(o.wall, s0, length_cm, width_cm)
    end = wall_point(o.wall, s1, length_cm, width_cm)
    if o.kind is OpeningKind.WINDOW:
        return OpeningShape(kind=o.kind, start=start, end=end)

    hinge = door_hinge_point(o, length_cm, width_cm)
    free_end = end if o.hinge != "end" else start
    nx, ny = INWARD_NORMAL[o.wall]
    if o.swing == "outward":
        nx, ny = -nx, -ny
    leaf_end = (hinge[0] + nx * o.width_cm, hinge[1] + ny * o.width_cm)
    # y points down, so a positive cross product is a clockwise turn on screen.
    ax, ay = leaf_end[0] - hinge[0], leaf_end[1] - hinge[1]
    bx, by = free_end[0] - hinge[0], free_end[1] - hinge[1]
    return OpeningShape(
        kind=o.kind, start=start, end=end, hinge=hinge, leaf_end=leaf_end,
        free_end=free_end, sweep_clockwise=(ax * by - ay * bx) > 0,
    )


def _svg_opening(shape: OpeningShape, radius_cm: float) -> str:
    def pt(p: Point) -> str:
        return f"{_MARGIN + p[0] * _SCALE:.1f},{_MARGIN + p[1] * _SCALE:.1f}"

    x1, y1 = pt(shape.start).split(",")
    x2, y2 = pt(shape.end).split(",")
    if shape.kind is OpeningKind.WINDOW:
        return (
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#faf8f2" stroke-width="4"/>'
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#4a90c2" stroke-width="2" '
            f'stroke-dasharray="6 3" data-opening="window"/>'
        )
    r = radius_cm * _SCALE
    sweep = 1 if shape.sweep_clockwise else 0
    return (
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#faf8f2" stroke-width="4"/>'
        f'<path d="M {pt(shape.hinge)} L {pt(shape.leaf_end)} A {r:.1f} {r:.1f} 0 0 {sweep} {pt(shape.free_end)}" '
        f'fill="none" stroke="#8b6b3d" stroke-width="1.5" stroke-dasharray="4 3" data-opening="door"/>'
    )


def render_layout_svg(
    dimensions: RoomDimensions,
    placements: list[Placement],
    violations: list[str] | None = None,
    openings: list[Opening] | None = None,
) -> str:
    length_cm, width_cm = room_dimensions_cm(dimensions)
    violations = violations or []
    openings = openings or []

    violating_labels = {p.label for p in placements if any(p.label in v for v in violations)}

    svg_width = length_cm * _SCALE + _MARGIN * 2
    svg_height = width_cm * _SCALE + _MARGIN * 2 + (18 * len(violations) + 24 if violations else 30)

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width:.0f}" height="{svg_height:.0f}" '
        f'viewBox="0 0 {svg_width:.0f} {svg_height:.0f}" font-family="sans-serif">',
        f'<rect x="{_MARGIN}" y="{_MARGIN}" width="{length_cm * _SCALE:.0f}" '
        f'height="{width_cm * _SCALE:.0f}" fill="#faf8f2" stroke="#333" stroke-width="2"/>',
    ]
    for o in openings:
        parts.append(_svg_opening(opening_shape(o, length_cm, width_cm), o.width_cm))

    for p in placements:
        w, d = (p.depth_cm, p.width_cm) if p.rotation_deg in (90, 270) else (p.width_cm, p.depth_cm)
        x = _MARGIN + p.x_cm * _SCALE
        y = _MARGIN + p.y_cm * _SCALE
        is_violating = p.label in violating_labels
        fill = "#f6b6ab" if is_violating else "#a8d5c2"
        stroke = "#c0392b" if is_violating else "#2e7d5b"

        parts.append(
            f'<rect x="{x:.0f}" y="{y:.0f}" width="{w * _SCALE:.0f}" height="{d * _SCALE:.0f}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="2" rx="3"/>'
        )
        parts.append(
            f'<text x="{x + w * _SCALE / 2:.0f}" y="{y + d * _SCALE / 2:.0f}" text-anchor="middle" '
            f'dominant-baseline="middle" font-size="11" fill="#222">{p.label}</text>'
        )

    y_offset = width_cm * _SCALE + _MARGIN + 20
    if violations:
        parts.append(
            f'<text x="{_MARGIN}" y="{y_offset:.0f}" font-size="12" font-weight="bold" '
            f'fill="#c0392b">Violations:</text>'
        )
        for i, v in enumerate(violations):
            parts.append(
                f'<text x="{_MARGIN}" y="{y_offset + 18 * (i + 1):.0f}" font-size="11" '
                f'fill="#c0392b">- {v}</text>'
            )
    else:
        parts.append(
            f'<text x="{_MARGIN}" y="{y_offset:.0f}" font-size="12" font-weight="bold" '
            f'fill="#2e7d5b">Feasible — no violations</text>'
        )

    parts.append("</svg>")
    return "".join(parts)