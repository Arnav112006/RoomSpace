"""
Converts detected FurnitureItems (which only carry a rough text zone,
from room_analysis.py's _zone_for_box) into concrete Placements that
the Constraint Engine and renderer can work with.

This is deliberately NOT the real Candidate Layout Generator (still
"NEXT" on the roadmap). It doesn't optimize anything -- it just maps
each item's zone description to an approximate room position so
detected furniture can be visualized without the user manually typing
coordinates. Overlaps and clearance violations are expected and
correctly caught by the Constraint Engine downstream, not silently
avoided here.
"""

from app.schemas.furniture import FurnitureItem
from app.schemas.layout import Placement
from app.schemas.room import RoomDimensions
from app.services.units import room_dimensions_cm

# Mirrors the exact vocabulary produced by
# room_analysis._zone_for_box(), with " of the frame" stripped.
_ZONE_TO_FRACTION = {
    "back left": (0.15, 0.15),
    "back center": (0.5, 0.15),
    "back right": (0.85, 0.15),
    "middle left": (0.15, 0.5),
    "center of the room": (0.5, 0.5),
    "middle right": (0.85, 0.5),
    "front left": (0.15, 0.85),
    "front center": (0.5, 0.85),
    "front right": (0.85, 0.85),
}
_DEFAULT_FRACTION = (0.5, 0.5)


def _fraction_for_zone(zone: str | None) -> tuple[float, float]:
    if not zone:
        return _DEFAULT_FRACTION
    key = zone.replace(" of the frame", "").strip().lower()
    return _ZONE_TO_FRACTION.get(key, _DEFAULT_FRACTION)


def placements_from_detection(
    dimensions: RoomDimensions,
    furniture: list[FurnitureItem],
) -> list[Placement]:
    """Rough, non-optimizing placement: centers each item at the room
    position implied by its detected zone, nudging items that share a
    zone so they don't start exactly stacked. This can still produce
    overlaps -- that's expected, and the Constraint Engine downstream
    will flag it correctly rather than hide it.
    """
    length_cm, width_cm = room_dimensions_cm(dimensions)
    placements: list[Placement] = []
    seen_zone_counts: dict[str, int] = {}

    for i, item in enumerate(furniture):
        x_frac, y_frac = _fraction_for_zone(item.approximate_zone)

        zone_key = item.approximate_zone or "default"
        offset_index = seen_zone_counts.get(zone_key, 0)
        seen_zone_counts[zone_key] = offset_index + 1
        nudge_cm = offset_index * 40

        x_cm = min(max(x_frac * length_cm - item.width_cm / 2 + nudge_cm, 0), max(length_cm - item.width_cm, 0))
        y_cm = min(max(y_frac * width_cm - item.depth_cm / 2 + nudge_cm, 0), max(width_cm - item.depth_cm, 0))

        placements.append(
            Placement(
                item_id=f"detected-{i}",
                label=item.label,
                x_cm=round(x_cm, 1),
                y_cm=round(y_cm, 1),
                width_cm=item.width_cm,
                depth_cm=item.depth_cm,
            )
        )

    return placements