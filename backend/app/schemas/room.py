from pydantic import BaseModel, Field
from typing import Optional

from app.schemas.furniture import FurnitureItem
from app.schemas.opening import Opening


class RoomDimensions(BaseModel):
    length: float = Field(gt=0)
    width: float = Field(gt=0)
    unit: str = "ft"


class RoomCreate(BaseModel):
    dimensions: RoomDimensions
    room_type: str
    theme: str
    occasion: Optional[str] = None
    budget: Optional[float] = Field(default=None, ge=0)
    openings: list[Opening] = Field(default_factory=list)


class RoomResponse(BaseModel):
    id: str
    dimensions: RoomDimensions
    room_type: str
    theme: str
    occasion: Optional[str] = None
    budget: Optional[float] = None
    openings: list[Opening] = Field(default_factory=list)
    furniture: list[FurnitureItem] = Field(default_factory=list)