"""Openings: doors and windows. See docs/room-model.md §3–6.

An opening is not furniture. It never moves, is never scored and is never
recommended. It is stored as wall + offset + width; its floor position is
derived from those (constraint_engine.opening_span).
"""

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class OpeningKind(str, Enum):
    DOOR = "door"
    WINDOW = "window"


class WallSide(str, Enum):
    NORTH = "north"
    SOUTH = "south"
    EAST = "east"
    WEST = "west"


class Opening(BaseModel):
    id: str = Field(min_length=1)
    kind: OpeningKind
    wall: WallSide
    offset_cm: float = Field(ge=0, description="From the west end (north/south walls) or north end (east/west walls)")
    width_cm: float = Field(gt=0)
    hinge: Optional[Literal["start", "end"]] = None  # doors only
    swing: Optional[Literal["inward", "outward"]] = None  # doors only

    @model_validator(mode="after")
    def _door_fields(self) -> "Opening":
        if self.kind is OpeningKind.WINDOW:
            if self.hinge is not None or self.swing is not None:
                raise ValueError("hinge and swing only apply to doors")
        else:
            # v1 defaults: hinged at the start end, opening into the room.
            self.hinge = self.hinge or "start"
            self.swing = self.swing or "inward"
        return self
