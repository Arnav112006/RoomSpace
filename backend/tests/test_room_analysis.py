"""Room analysis post-processing, tested against a hand-built fake YOLO
result so the real model (and torch) is never loaded."""

from types import SimpleNamespace

import pytest

from app.schemas.furniture import FurnitureType
from app.services.room_analysis import _results_to_furniture, _zone_for_box

NAMES = {0: "person", 1: "bed", 2: "chair", 3: "couch"}


def _box(cls: int, conf: float, xyxy: tuple[float, float, float, float]):
    return SimpleNamespace(cls=[cls], conf=[conf], xyxy=[list(xyxy)])


def _result(*boxes):
    return SimpleNamespace(boxes=list(boxes), names=NAMES)


@pytest.mark.parametrize(
    ("x", "y", "zone"),
    [
        (0.1, 0.1, "back left of the frame"),
        (0.5, 0.5, "center of the room"),
        (0.9, 0.9, "front right of the frame"),
        (0.5, 0.1, "back center of the frame"),
    ],
)
def test_zone_for_box(x, y, zone):
    assert _zone_for_box(x, y) == zone


def test_ignores_low_confidence_and_unmapped_classes():
    result = _result(
        _box(0, 0.99, (0, 0, 100, 100)),   # person: not furniture
        _box(2, 0.10, (0, 0, 100, 100)),   # chair, below threshold
    )
    assert _results_to_furniture(result, 1000, 1000) == []


def test_maps_coco_class_to_furniture_type():
    result = _result(_box(3, 0.9, (0, 0, 500, 300)))
    (item,) = _results_to_furniture(result, 1000, 1000)
    assert item.type is FurnitureType.SOFA
    assert item.label == "Couch"
    assert item.source == "vision" and not item.is_fixed


def test_size_is_estimated_from_room_dimensions():
    # Box covers half the frame width and a quarter of its height.
    result = _result(_box(1, 0.9, (0, 0, 500, 250)))
    (item,) = _results_to_furniture(result, 1000, 1000, room_length_cm=400, room_width_cm=300)
    assert (item.width_cm, item.depth_cm) == (200, 75)


def test_falls_back_to_default_size_without_room_dimensions():
    result = _result(_box(1, 0.9, (0, 0, 500, 250)))
    (item,) = _results_to_furniture(result, 1000, 1000)
    assert (item.width_cm, item.depth_cm) == (150, 200)


def test_falls_back_to_default_size_when_estimate_is_implausibly_small():
    result = _result(_box(2, 0.9, (0, 0, 10, 10)))  # 1% of frame -> 4cm
    (item,) = _results_to_furniture(result, 1000, 1000, room_length_cm=400, room_width_cm=300)
    assert (item.width_cm, item.depth_cm) == (45, 45)
