"""
Shared, dependency-free unit conversion. Lives on its own so that
constraint_engine.py and layout_renderer.py don't need to import each
other just to agree on how a room's dimensions convert to centimetres
-- each pipeline stage should only ever depend on schemas/, never on
another stage's module.
"""

from app.schemas.room import RoomDimensions

_UNIT_TO_CM = {"cm": 1.0, "m": 100.0, "ft": 30.48}


def room_dimensions_cm(dimensions: RoomDimensions) -> tuple[float, float]:
    """Returns (length_cm, width_cm), converting from whatever unit
    the room was recorded in (RoomDimensions.unit defaults to 'ft',
    while every FurnitureItem/Placement dimension is in cm)."""
    factor = _UNIT_TO_CM.get(dimensions.unit, 1.0)
    return dimensions.length * factor, dimensions.width * factor