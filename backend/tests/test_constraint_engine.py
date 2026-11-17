"""Constraint Engine: one rule, one function, one test (docs/room-model.md §7).

The parametrised "known configurations" at the bottom are the proposal's
primary metric guard: every layout recorded as valid must pass, and every
layout recorded as invalid must be rejected.
"""

import math

import pytest

from app.services.constraint_engine import (
    MIN_CLEARANCE_CM,
    clearance_between,
    overlaps,
    validate_layout,
    within_bounds,
)
from tests.conftest import DEMO_LENGTH_CM as L
from tests.conftest import DEMO_WIDTH_CM as W
from tests.conftest import make_placement as P


def test_min_clearance_matches_room_model_doc():
    assert MIN_CLEARANCE_CM == 75


# --- within_bounds -------------------------------------------------------

def test_item_inside_room_is_within_bounds():
    assert within_bounds(P(x=10, y=10, w=100, d=60), L, W)


def test_item_flush_with_far_corner_is_within_bounds():
    assert within_bounds(P(x=L - 100, y=W - 60, w=100, d=60), L, W)


@pytest.mark.parametrize(
    "placement",
    [
        P(x=-1, y=10),                    # past the west wall
        P(x=10, y=-1),                    # past the north wall
        P(x=L - 49, y=10, w=50),          # past the east wall
        P(x=10, y=W - 49, d=50),          # past the south wall
    ],
    ids=["west", "north", "east", "south"],
)
def test_item_crossing_any_wall_is_out_of_bounds(placement):
    assert not within_bounds(placement, L, W)


def test_item_larger_than_room_is_out_of_bounds():
    assert not within_bounds(P(w=L + 1, d=10), L, W)


# --- rotation ------------------------------------------------------------

@pytest.mark.parametrize("rotation", [90, 270])
def test_quarter_turn_swaps_footprint(rotation):
    # 200 wide × 60 deep pokes through the east wall; turned a quarter
    # it becomes 60 wide × 200 deep and fits.
    x = L - 70
    assert not within_bounds(P(x=x, y=10, w=200, d=60), L, W)
    assert within_bounds(P(x=x, y=10, w=200, d=60, rotation=rotation), L, W)


def test_half_turn_keeps_footprint():
    x = L - 70
    assert not within_bounds(P(x=x, y=10, w=200, d=60, rotation=180), L, W)


# --- overlaps ------------------------------------------------------------

def test_intersecting_items_overlap():
    assert overlaps(P(x=0, y=0, w=100, d=100), P(x=50, y=50, w=100, d=100))


def test_edge_touching_items_do_not_overlap():
    assert not overlaps(P(x=0, y=0, w=100, d=100), P(x=100, y=0, w=100, d=100))


def test_separate_items_do_not_overlap():
    assert not overlaps(P(x=0, y=0, w=50, d=50), P(x=200, y=200, w=50, d=50))


def test_overlap_is_symmetric():
    a, b = P(x=0, y=0, w=100, d=100), P(x=90, y=90, w=20, d=20)
    assert overlaps(a, b) and overlaps(b, a)


# --- clearance_between ---------------------------------------------------

def test_horizontal_gap():
    assert clearance_between(P(x=0, y=0, w=100, d=50), P(x=180, y=0, w=50, d=50)) == pytest.approx(80)


def test_vertical_gap():
    assert clearance_between(P(x=0, y=0, w=50, d=100), P(x=0, y=130, w=50, d=50)) == pytest.approx(30)


def test_diagonal_gap_is_euclidean():
    gap = clearance_between(P(x=0, y=0, w=50, d=50), P(x=80, y=90, w=50, d=50))
    assert gap == pytest.approx(math.hypot(30, 40))


def test_overlapping_items_have_negative_clearance():
    assert clearance_between(P(x=0, y=0, w=100, d=100), P(x=90, y=90, w=100, d=100)) < 0


# --- validate_layout -----------------------------------------------------

def test_empty_layout_is_feasible(demo_dims):
    assert validate_layout(demo_dims, []) == (True, [])


def test_single_item_inside_room_is_feasible(demo_dims):
    assert validate_layout(demo_dims, [P("Bed", x=10, y=10, w=150, d=200)]) == (True, [])


def test_out_of_bounds_violation_names_the_item(demo_dims):
    feasible, violations = validate_layout(demo_dims, [P("Wardrobe", x=L - 50, y=10, w=120, d=60)])
    assert not feasible
    assert violations == ["Wardrobe extends outside the room boundary"]


def test_overlap_violation_names_both_items(demo_dims):
    feasible, violations = validate_layout(
        demo_dims, [P("Bed", x=10, y=10, w=150, d=200), P("Desk", x=100, y=100, w=120, d=60)]
    )
    assert not feasible
    assert violations == ["Bed overlaps with Desk"]


def test_gap_just_below_minimum_clearance_fails(demo_dims):
    feasible, violations = validate_layout(
        demo_dims, [P("Bed", x=10, y=10, w=100, d=100), P("Chair", x=184, y=10, w=50, d=50)]
    )
    assert not feasible
    assert violations == ["Only 74cm between Bed and Chair (minimum 75cm)"]


def test_gap_exactly_at_minimum_clearance_passes(demo_dims):
    feasible, _ = validate_layout(
        demo_dims, [P("Bed", x=10, y=10, w=100, d=100), P("Chair", x=185, y=10, w=50, d=50)]
    )
    assert feasible


def test_custom_min_clearance_is_respected(demo_dims):
    layout = [P("Bed", x=10, y=10, w=100, d=100), P("Chair", x=150, y=10, w=50, d=50)]
    assert not validate_layout(demo_dims, layout)[0]
    assert validate_layout(demo_dims, layout, min_clearance_cm=40)[0]


def test_every_violation_is_reported(demo_dims):
    layout = [
        P("Bed", x=10, y=10, w=150, d=200),
        P("Desk", x=100, y=100, w=120, d=60),     # overlaps Bed
        P("Shelf", x=L - 10, y=10, w=90, d=30),   # out of bounds
    ]
    feasible, violations = validate_layout(demo_dims, layout)
    assert not feasible
    assert "Shelf extends outside the room boundary" in violations
    assert "Bed overlaps with Desk" in violations


# --- known demo-room configurations (primary metric guard) --------------

VALID_LAYOUTS = {
    "bed alone in north-west corner": [P("Bed", x=10, y=10, w=150, d=200)],
    "bed west, desk on east wall": [
        P("Bed", x=10, y=10, w=150, d=200),
        P("Desk", x=L - 70, y=10, w=120, d=60, rotation=90),
    ],
    "two chairs across the room": [
        P("Chair A", x=10, y=10, w=45, d=45),
        P("Chair B", x=L - 55, y=W - 55, w=45, d=45),
    ],
}

INVALID_LAYOUTS = {
    "bed deeper than the room": [P("Bed", x=10, y=10, w=150, d=320)],
    "desk 10cm from bed": [
        P("Bed", x=10, y=10, w=150, d=200),
        P("Desk", x=170, y=10, w=120, d=60),
    ],
    "wardrobe through the east wall": [P("Wardrobe", x=300, y=10, w=120, d=60)],
    "chairs side by side": [
        P("Chair A", x=100, y=100, w=45, d=45),
        P("Chair B", x=150, y=100, w=45, d=45),
    ],
}


@pytest.mark.parametrize("layout", VALID_LAYOUTS.values(), ids=VALID_LAYOUTS.keys())
def test_known_valid_layouts_pass(demo_dims, layout):
    feasible, violations = validate_layout(demo_dims, layout)
    assert feasible, violations


@pytest.mark.parametrize("layout", INVALID_LAYOUTS.values(), ids=INVALID_LAYOUTS.keys())
def test_known_invalid_layouts_are_rejected(demo_dims, layout):
    feasible, violations = validate_layout(demo_dims, layout)
    assert not feasible
    assert violations
