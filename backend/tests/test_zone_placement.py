import pytest

from app.schemas.furniture import FurnitureItem, FurnitureType
from app.services.constraint_engine import within_bounds
from app.services.zone_placement import placements_from_detection
from tests.conftest import DEMO_LENGTH_CM, DEMO_WIDTH_CM

ZONES = [
    "back left of the frame",
    "back center of the frame",
    "back right of the frame",
    "middle left of the frame",
    "center of the room",
    "middle right of the frame",
    "front left of the frame",
    "front center of the frame",
    "front right of the frame",
    None,
    "somewhere unexpected",
]


def _item(zone, w=150.0, d=200.0, label="Bed"):
    return FurnitureItem(type=FurnitureType.BED, label=label, width_cm=w, depth_cm=d, approximate_zone=zone)


def test_no_furniture_gives_no_placements(demo_dims):
    assert placements_from_detection(demo_dims, []) == []


@pytest.mark.parametrize("zone", ZONES)
def test_every_zone_lands_inside_the_room(demo_dims, zone):
    (placement,) = placements_from_detection(demo_dims, [_item(zone)])
    assert within_bounds(placement, DEMO_LENGTH_CM, DEMO_WIDTH_CM)


def test_many_items_in_one_zone_stay_inside_the_room(demo_dims):
    items = [_item("front right of the frame", w=60, d=60, label=f"Chair {i}") for i in range(8)]
    for placement in placements_from_detection(demo_dims, items):
        assert within_bounds(placement, DEMO_LENGTH_CM, DEMO_WIDTH_CM)


def test_items_sharing_a_zone_are_nudged_apart(demo_dims):
    a, b = placements_from_detection(
        demo_dims, [_item("center of the room", 50, 50, "A"), _item("center of the room", 50, 50, "B")]
    )
    assert (a.x_cm, a.y_cm) != (b.x_cm, b.y_cm)


def test_placements_carry_ids_labels_and_sizes(demo_dims):
    placements = placements_from_detection(
        demo_dims, [_item("back left of the frame", 150, 200, "Bed"), _item(None, 45, 45, "Chair")]
    )
    assert [p.item_id for p in placements] == ["detected-0", "detected-1"]
    assert [p.label for p in placements] == ["Bed", "Chair"]
    assert [(p.width_cm, p.depth_cm) for p in placements] == [(150, 200), (45, 45)]
