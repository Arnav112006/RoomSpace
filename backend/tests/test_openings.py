"""Doors and windows: docs/room-model.md §4–7.

Demo room (§8): door on the south wall, offset 60, width 90, hinge start,
inward; window on the east wall, offset 80, width 120.
"""

import pytest
from pydantic import ValidationError

from app.schemas.opening import Opening
from app.services.constraint_engine import (
    WINDOW_BACK_GAP_CM,
    WINDOW_BLOCK_RATIO,
    blocks_window,
    in_door_swing,
    opening_fit_errors,
    validate_layout,
)
from tests.conftest import DEMO_LENGTH_CM as L
from tests.conftest import DEMO_WIDTH_CM as W
from tests.conftest import make_placement as P

DOOR = Opening(id="door-1", kind="door", wall="south", offset_cm=60, width_cm=90, hinge="start", swing="inward")
WINDOW = Opening(id="win-1", kind="window", wall="east", offset_cm=80, width_cm=120)
DEMO_OPENINGS = [DOOR, WINDOW]


def _door(**overrides) -> Opening:
    return DOOR.model_copy(update=overrides)


def _window(**overrides) -> Opening:
    return WINDOW.model_copy(update=overrides)


# --- schema ----------------------------------------------------------------

def test_window_thresholds_match_room_model_doc():
    assert WINDOW_BACK_GAP_CM == 30
    assert WINDOW_BLOCK_RATIO == 0.80


def test_door_defaults_to_start_hinge_and_inward_swing():
    door = Opening(id="d", kind="door", wall="north", offset_cm=0, width_cm=80)
    assert (door.hinge, door.swing) == ("start", "inward")


def test_window_cannot_have_hinge_or_swing():
    with pytest.raises(ValidationError):
        Opening(id="w", kind="window", wall="north", offset_cm=0, width_cm=80, hinge="start")


@pytest.mark.parametrize("bad", [{"offset_cm": -1}, {"width_cm": 0}, {"wall": "up"}, {"kind": "arch"}])
def test_invalid_opening_fields_are_rejected(bad):
    with pytest.raises(ValidationError):
        Opening(**{"id": "x", "kind": "door", "wall": "north", "offset_cm": 0, "width_cm": 80, **bad})


# --- openings fit the room -------------------------------------------------

def test_demo_openings_fit():
    assert opening_fit_errors(DEMO_OPENINGS, L, W) == []


def test_opening_past_end_of_wall_is_reported():
    # East wall is the room's width (304.8 cm) long.
    errors = opening_fit_errors([_window(offset_cm=250)], L, W)
    assert len(errors) == 1 and "runs past the end" in errors[0]


def test_overlapping_openings_on_same_wall_are_reported():
    errors = opening_fit_errors([DOOR, _window(id="w2", wall="south", offset_cm=100, width_cm=60)], L, W)
    assert errors == ["The door and the window on the south wall overlap"]


def test_touching_openings_are_fine():
    assert opening_fit_errors([DOOR, _window(id="w2", wall="south", offset_cm=150, width_cm=60)], L, W) == []


def test_duplicate_opening_ids_are_reported():
    assert opening_fit_errors([DOOR, _window(id="door-1")], L, W) == ["Duplicate opening id 'door-1'"]


# --- door swing (§5) -------------------------------------------------------

def test_canonical_failing_wardrobe_in_door_swing():
    wardrobe = P("Wardrobe", x=40, y=W - 60, w=120, d=60)
    feasible, violations = validate_layout_demo([wardrobe])
    assert not feasible
    assert violations == ["Wardrobe blocks the door on the south wall"]


def test_canonical_passing_wardrobe_moved_clear():
    wardrobe = P("Wardrobe", x=200, y=W - 60, w=120, d=60)
    assert validate_layout_demo([wardrobe]) == (True, [])


def test_swing_is_a_quarter_disc_not_a_square():
    # Sits in the far corner of the swing square, 113 cm from the hinge:
    # outside the 90 cm swing radius.
    corner_item = P("Plant", x=140, y=W - 90, w=10, d=10)
    assert not in_door_swing(corner_item, DOOR, L, W)


def test_moving_the_hinge_moves_the_swing():
    # Same item, but now only 80 cm from the hinge at the east end.
    corner_item = P("Plant", x=140, y=W - 90, w=10, d=10)
    assert in_door_swing(corner_item, _door(hinge="end"), L, W)


def test_outward_door_has_no_swing_rule():
    wardrobe = P("Wardrobe", x=40, y=W - 60, w=120, d=60)
    assert not in_door_swing(wardrobe, _door(swing="outward"), L, W)


def test_item_beside_the_swing_does_not_intrude():
    assert not in_door_swing(P("Shelf", x=150, y=W - 30, w=60, d=30), DOOR, L, W)


@pytest.mark.parametrize(
    ("wall", "item"),
    [
        ("north", P("Box", x=100, y=0, w=30, d=30)),
        ("south", P("Box", x=100, y=W - 30, w=30, d=30)),
        ("west", P("Box", x=0, y=100, w=30, d=30)),
        ("east", P("Box", x=L - 30, y=100, w=30, d=30)),
    ],
)
def test_door_swing_on_every_wall(wall, item):
    door = Opening(id="d", kind="door", wall=wall, offset_cm=100, width_cm=80)
    assert in_door_swing(item, door, L, W)


def test_item_against_perpendicular_wall_can_block_door():
    # Door near the south-west corner; a bookcase on the west wall
    # reaches into its swing.
    door = _door(offset_cm=20, width_cm=80)
    bookcase = P("Bookcase", x=0, y=W - 120, w=40, d=110)
    assert in_door_swing(bookcase, door, L, W)


# --- window obstruction (§6) -----------------------------------------------

def _against_east_wall(depth_along_wall: float, gap: float = 0, y: float = 80) -> object:
    return P("Wardrobe", x=L - 60 - gap, y=y, w=60, d=depth_along_wall)


def test_full_coverage_against_the_wall_blocks():
    assert blocks_window(_against_east_wall(120), WINDOW, L, W)


def test_exactly_80_percent_coverage_blocks():
    assert blocks_window(_against_east_wall(96), WINDOW, L, W)


def test_below_80_percent_coverage_is_allowed():
    assert not blocks_window(_against_east_wall(94.8), WINDOW, L, W)


def test_back_edge_exactly_30cm_from_wall_blocks():
    assert blocks_window(_against_east_wall(120, gap=30), WINDOW, L, W)


def test_back_edge_more_than_30cm_from_wall_is_allowed():
    assert not blocks_window(_against_east_wall(120, gap=31), WINDOW, L, W)


def test_coverage_only_counts_the_part_in_front_of_the_window():
    # 200 cm long item, but only 60 cm of it lines up with the window.
    assert not blocks_window(_against_east_wall(200, y=140), WINDOW, L, W)


def test_window_on_north_wall():
    window = Opening(id="w", kind="window", wall="north", offset_cm=100, width_cm=100)
    assert blocks_window(P("Desk", x=95, y=10, w=120, d=60), window, L, W)
    assert not blocks_window(P("Desk", x=95, y=41, w=120, d=60), window, L, W)


def test_window_violation_message():
    feasible, violations = validate_layout_demo([_against_east_wall(120)])
    assert not feasible
    assert violations == ["Wardrobe blocks the window on the east wall"]


def test_door_rule_does_not_apply_to_windows_and_vice_versa():
    item = P("Box", x=100, y=W - 30, w=30, d=30)
    assert not blocks_window(item, DOOR, L, W)
    assert not in_door_swing(_against_east_wall(120), WINDOW, L, W)


def test_no_openings_keeps_old_behaviour(demo_dims):
    wardrobe = P("Wardrobe", x=40, y=W - 60, w=120, d=60)
    assert validate_layout(demo_dims, [wardrobe]) == (True, [])


# --- helper ----------------------------------------------------------------

def validate_layout_demo(placements):
    from app.schemas.room import RoomDimensions

    return validate_layout(RoomDimensions(length=12, width=10, unit="ft"), placements, openings=DEMO_OPENINGS)
