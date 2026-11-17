import pytest

from app.schemas.room import RoomDimensions
from app.services.units import room_dimensions_cm


@pytest.mark.parametrize(
    ("length", "width", "unit", "expected"),
    [
        (12, 10, "ft", (365.76, 304.80)),
        (3.5, 3, "m", (350.0, 300.0)),
        (400, 320, "cm", (400.0, 320.0)),
    ],
)
def test_known_units_convert_to_cm(length, width, unit, expected):
    got = room_dimensions_cm(RoomDimensions(length=length, width=width, unit=unit))
    assert got == pytest.approx(expected)


def test_default_unit_is_feet():
    assert room_dimensions_cm(RoomDimensions(length=1, width=1)) == pytest.approx((30.48, 30.48))


def test_unknown_unit_is_treated_as_cm():
    # Pins current behaviour: an unrecognised unit is not rejected, it
    # silently falls back to a factor of 1. If this changes to a
    # validation error, update this test deliberately.
    assert room_dimensions_cm(RoomDimensions(length=5, width=4, unit="yd")) == (5, 4)
