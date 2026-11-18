"""
Constraint Engine — pure geometry, no model calls, no network.
Validates a proposed layout (a list of Placements) against the room's
physical constraints:

- staying within the room boundary,
- not overlapping other furniture,
- keeping a minimum walkway clearance between items,
- staying out of every inward-swinging door's swing area,
- not blocking a window.

Coordinates, units and every threshold follow docs/room-model.md:
origin at the north-west corner, +x east, +y south, centimetres.

Deliberately dependency-free so it can be unit tested with hand-built
fixtures, independent of YOLO, CLIP, or any layout generator.
Mirrored in frontend/src/shared/lib/constraintEngine.ts.
"""

import math

from app.schemas.layout import Placement
from app.schemas.opening import Opening, OpeningKind, WallSide
from app.schemas.room import RoomDimensions
from app.services.units import room_dimensions_cm

# docs/room-model.md §7
MIN_CLEARANCE_CM = 75.0
WINDOW_BACK_GAP_CM = 30.0
WINDOW_BLOCK_RATIO = 0.80
EPSILON_CM = 1e-6

Rect = tuple[float, float, float, float]  # (x_min, y_min, x_max, y_max)


def _effective_footprint(p: Placement) -> tuple[float, float]:
    """Swaps width/depth if the item is rotated 90 or 270 degrees."""
    if p.rotation_deg in (90, 270):
        return p.depth_cm, p.width_cm
    return p.width_cm, p.depth_cm


def _bbox(p: Placement) -> Rect:
    """Returns (x_min, y_min, x_max, y_max) for a placement."""
    w, d = _effective_footprint(p)
    return p.x_cm, p.y_cm, p.x_cm + w, p.y_cm + d


# --- furniture vs room / furniture ------------------------------------

def within_bounds(p: Placement, room_length_cm: float, room_width_cm: float) -> bool:
    x_min, y_min, x_max, y_max = _bbox(p)
    return (
        x_min >= -EPSILON_CM
        and y_min >= -EPSILON_CM
        and x_max <= room_length_cm + EPSILON_CM
        and y_max <= room_width_cm + EPSILON_CM
    )


def overlaps(a: Placement, b: Placement) -> bool:
    ax1, ay1, ax2, ay2 = _bbox(a)
    bx1, by1, bx2, by2 = _bbox(b)
    return not (
        ax2 <= bx1 + EPSILON_CM
        or bx2 <= ax1 + EPSILON_CM
        or ay2 <= by1 + EPSILON_CM
        or by2 <= ay1 + EPSILON_CM
    )


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


# --- openings (docs/room-model.md §4–6) --------------------------------

def wall_length(wall: WallSide, room_length_cm: float, room_width_cm: float) -> float:
    return room_length_cm if wall in (WallSide.NORTH, WallSide.SOUTH) else room_width_cm


def opening_span(o: Opening) -> tuple[float, float]:
    """(start, end) of the opening along its wall, in the wall's own
    direction of travel: west→east for north/south, north→south for
    east/west (§4)."""
    return o.offset_cm, o.offset_cm + o.width_cm


def opening_fit_errors(
    openings: list[Opening], room_length_cm: float, room_width_cm: float
) -> list[str]:
    """Problems with the openings themselves: running past the end of
    their wall, overlapping another opening on the same wall, or reusing
    an id. Empty list means the openings are usable."""
    errors: list[str] = []
    seen_ids: set[str] = set()
    for o in openings:
        if o.id in seen_ids:
            errors.append(f"Duplicate opening id '{o.id}'")
        seen_ids.add(o.id)
        _, end = opening_span(o)
        length = wall_length(o.wall, room_length_cm, room_width_cm)
        if end > length + EPSILON_CM:
            errors.append(
                f"The {o.kind.value} on the {o.wall.value} wall runs past the end of the wall "
                f"(ends at {end:.0f}cm, wall is {length:.0f}cm)"
            )
    for i, a in enumerate(openings):
        for b in openings[i + 1:]:
            if a.wall != b.wall:
                continue
            a0, a1 = opening_span(a)
            b0, b1 = opening_span(b)
            if a0 < b1 - EPSILON_CM and b0 < a1 - EPSILON_CM:
                errors.append(
                    f"The {a.kind.value} and the {b.kind.value} on the {a.wall.value} wall overlap"
                )
    return errors


def door_swing_square(door: Opening, room_length_cm: float, room_width_cm: float) -> Rect:
    """The square (side = door width) that contains the door's
    quarter-disc swing, with one corner on the hinge (§5)."""
    s0, s1 = opening_span(door)
    w = door.width_cm
    if door.wall is WallSide.NORTH:
        return s0, 0.0, s1, w
    if door.wall is WallSide.SOUTH:
        return s0, room_width_cm - w, s1, room_width_cm
    if door.wall is WallSide.WEST:
        return 0.0, s0, w, s1
    return room_length_cm - w, s0, room_length_cm, s1


def wall_point(
    wall: WallSide, along: float, room_length_cm: float, room_width_cm: float
) -> tuple[float, float]:
    """The room coordinate `along` cm down a wall, in the wall's own
    direction of travel (§4)."""
    if wall is WallSide.NORTH:
        return along, 0.0
    if wall is WallSide.SOUTH:
        return along, room_width_cm
    if wall is WallSide.WEST:
        return 0.0, along
    return room_length_cm, along


def door_hinge_point(door: Opening, room_length_cm: float, room_width_cm: float) -> tuple[float, float]:
    s0, s1 = opening_span(door)
    return wall_point(door.wall, s0 if door.hinge != "end" else s1, room_length_cm, room_width_cm)


def in_door_swing(p: Placement, door: Opening, room_length_cm: float, room_width_cm: float) -> bool:
    """True if the item intrudes on an inward door's quarter-disc swing.

    The swing is the disc of radius door.width_cm around the hinge,
    restricted to door_swing_square. Clip the item to that square; it
    intrudes if the clipped part has area and its closest point to the
    hinge is strictly inside the radius. Outward doors never intrude.
    """
    if door.kind is not OpeningKind.DOOR or door.swing == "outward":
        return False
    sx1, sy1, sx2, sy2 = door_swing_square(door, room_length_cm, room_width_cm)
    px1, py1, px2, py2 = _bbox(p)
    cx1, cy1 = max(sx1, px1), max(sy1, py1)
    cx2, cy2 = min(sx2, px2), min(sy2, py2)
    if cx2 - cx1 <= EPSILON_CM or cy2 - cy1 <= EPSILON_CM:
        return False
    hx, hy = door_hinge_point(door, room_length_cm, room_width_cm)
    nearest_x = min(max(hx, cx1), cx2)
    nearest_y = min(max(hy, cy1), cy2)
    return math.hypot(nearest_x - hx, nearest_y - hy) < door.width_cm - EPSILON_CM


def window_coverage(p: Placement, window: Opening) -> float:
    """Fraction (0–1) of the window's width that the item spans, measured
    along the window's wall."""
    x1, y1, x2, y2 = _bbox(p)
    lo, hi = (x1, x2) if window.wall in (WallSide.NORTH, WallSide.SOUTH) else (y1, y2)
    s0, s1 = opening_span(window)
    covered = max(0.0, min(hi, s1) - max(lo, s0))
    return covered / window.width_cm


def gap_to_wall(p: Placement, wall: WallSide, room_length_cm: float, room_width_cm: float) -> float:
    """Distance from the item's edge nearest `wall` to that wall."""
    x1, y1, x2, y2 = _bbox(p)
    if wall is WallSide.NORTH:
        return y1
    if wall is WallSide.SOUTH:
        return room_width_cm - y2
    if wall is WallSide.WEST:
        return x1
    return room_length_cm - x2


def blocks_window(p: Placement, window: Opening, room_length_cm: float, room_width_cm: float) -> bool:
    """§6: blocked when the item's back edge is within WINDOW_BACK_GAP_CM
    of the wall AND it covers at least WINDOW_BLOCK_RATIO of the window."""
    if window.kind is not OpeningKind.WINDOW:
        return False
    near_wall = gap_to_wall(p, window.wall, room_length_cm, room_width_cm) <= WINDOW_BACK_GAP_CM + EPSILON_CM
    return near_wall and window_coverage(p, window) >= WINDOW_BLOCK_RATIO - EPSILON_CM


# --- the whole layout --------------------------------------------------

def validate_layout(
    dimensions: RoomDimensions,
    placements: list[Placement],
    min_clearance_cm: float = MIN_CLEARANCE_CM,
    openings: list[Opening] | None = None,
) -> tuple[bool, list[str]]:
    """Returns (feasible, violations). A layout is infeasible if any
    item is out of bounds, overlaps another item, leaves less than
    min_clearance_cm of walkway to a neighbouring item, sits in a door's
    swing, or blocks a window."""
    violations: list[str] = []
    openings = openings or []
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
                if gap < min_clearance_cm - EPSILON_CM:
                    # Rounded down, so a 74.99 cm gap never reads as "75cm (minimum 75cm)".
                    violations.append(
                        f"Only {math.floor(gap)}cm between {a.label} and {b.label} "
                        f"(minimum {min_clearance_cm:.0f}cm)"
                    )

    for p in placements:
        for o in openings:
            if in_door_swing(p, o, length_cm, width_cm):
                violations.append(f"{p.label} blocks the door on the {o.wall.value} wall")
            elif blocks_window(p, o, length_cm, width_cm):
                violations.append(f"{p.label} blocks the window on the {o.wall.value} wall")

    return len(violations) == 0, violations
