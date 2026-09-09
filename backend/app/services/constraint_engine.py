"""
Constraint Engine — pure geometry, no model calls, no network.
Validates a proposed layout (a list of Placements) against the room's
physical constraints: staying within the room boundary, not
overlapping other furniture, and maintaining a minimum walkway
clearance between items.

Deliberately dependency-free so it can be unit tested with hand-built
fixtures, independent of YOLO, CLIP, or any future layout generator
that eventually proposes placements for this to validate.

Known gap: door-swing clearance is not checked here, because doors
are never detected by the vision pipeline (see room_analysis.py) and
so have no position to check against yet.
"""

from app.schemas.layout import Placement
from app.schemas.room import RoomDimensions
from app.services.units import room_dimensions_cm

DEFAULT_MIN_CLEARANCE_CM = 75.0


def _effective_footprint(p: Placement) -> tuple[float, float]:
    """Swaps width/depth if the item is rotated 90 or 270 degrees."""
    if p.rotation_deg in (90, 270):
        return p.depth_cm, p.width_cm
    return p.width_cm, p.depth_cm


def _bbox(p: Placement) -> tuple[float, float, float, float]:
    """Returns (x_min, y_min, x_max, y_max) for a placement."""
    w, d = _effective_footprint(p)
    return p.x_cm, p.y_cm, p.x_cm + w, p.y_cm + d


def within_bounds(p: Placement, room_length_cm: float, room_width_cm: float) -> bool:
    x_min, y_min, x_max, y_max = _bbox(p)
    return x_min >= 0 and y_min >= 0 and x_max <= room_length_cm and y_max <= room_width_cm


def overlaps(a: Placement, b: Placement) -> bool:
    ax1, ay1, ax2, ay2 = _bbox(a)
    bx1, by1, bx2, by2 = _bbox(b)
    return not (ax2 <= bx1 or bx2 <= ax1 or ay2 <= by1 or by2 <= ay1)


def clearance_between(a: Placement, b: Placement) -> float:
    """Shortest gap between two bounding boxes, in cm. Negative means
    they overlap (magnitude is roughly the overlap depth)."""
    ax1, ay1, ax2, ay2 = _bbox(a)
    bx1, by1, bx2, by2 = _bbox(b)

    x_gap = max(bx1 - ax2, ax1 - bx2)
    y_gap = max(by1 - ay2, ay1 - by2)

    if x_gap < 0 and y_gap < 0:
        return max(x_gap, y_gap)
    if x_gap < 0:
        return y_gap
    if y_gap < 0:
        return x_gap
    return (x_gap**2 + y_gap**2) ** 0.5


def validate_layout(
    dimensions: RoomDimensions,
    placements: list[Placement],
    min_clearance_cm: float = DEFAULT_MIN_CLEARANCE_CM,
) -> tuple[bool, list[str]]:
    """Returns (feasible, violations). A layout is infeasible if any
    item is out of bounds, overlaps another item, or leaves less than
    min_clearance_cm of walkway to a neighboring item."""
    violations: list[str] = []
    length_cm, width_cm = room_dimensions_cm(dimensions)

    for p in placements:
        if not within_bounds(p, length_cm, width_cm):
            violations.append(f"{p.label} extends outside the room boundary")

    for i in range(len(placements)):
        for j in range(i + 1, len(placements)):
            a, b = placements[i], placements[j]
            if overlaps(a, b):
                violations.append(f"{a.label} overlaps with {b.label}")
            else:
                gap = clearance_between(a, b)
                if gap < min_clearance_cm:
                    violations.append(
                        f"Only {gap:.0f}cm between {a.label} and {b.label} "
                        f"(minimum {min_clearance_cm:.0f}cm)"
                    )

    return len(violations) == 0, violations