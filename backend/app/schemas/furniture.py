from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class FurnitureType(str, Enum):
    BED = "bed"
    WARDROBE = "wardrobe"
    TABLE = "table"
    CHAIR = "chair"
    DESK = "desk"
    SOFA = "sofa"
    SHELF = "shelf"
    WINDOW = "window"
    DOOR = "door"
    OTHER = "other"


class FurnitureItem(BaseModel):
    type: FurnitureType
    label: str
    width_cm: float
    depth_cm: float
    approximate_zone: Optional[str] = Field(
        default=None, description="e.g. 'against the north wall', 'left corner'"
    )
    is_fixed: bool = False
    source: str = "vision"