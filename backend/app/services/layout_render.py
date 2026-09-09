"""
Renders a layout as a top-down SVG floor plan — the starting point
for stage 8 (Interactive 2D SVG Visualization). Violating items are
rendered in red so a failed layout is visually obvious.
"""

from app.schemas.layout import Placement
from app.schemas.room import RoomDimensions
from app.services.units import room_dimensions_cm

_SCALE = 0.5  # px per cm
_MARGIN = 40


def render_layout_svg(
    dimensions: RoomDimensions,
    placements: list[Placement],
    violations: list[str] | None = None,
) -> str:
    length_cm, width_cm = room_dimensions_cm(dimensions)
    violations = violations or []

    violating_labels = {p.label for p in placements if any(p.label in v for v in violations)}

    svg_width = length_cm * _SCALE + _MARGIN * 2
    svg_height = width_cm * _SCALE + _MARGIN * 2 + (18 * len(violations) + 24 if violations else 30)

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width:.0f}" height="{svg_height:.0f}" '
        f'viewBox="0 0 {svg_width:.0f} {svg_height:.0f}" font-family="sans-serif">',
        f'<rect x="{_MARGIN}" y="{_MARGIN}" width="{length_cm * _SCALE:.0f}" '
        f'height="{width_cm * _SCALE:.0f}" fill="#faf8f2" stroke="#333" stroke-width="2"/>',
    ]

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