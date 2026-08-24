from pydantic import BaseModel, Field
from typing import Optional


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


class RoomResponse(BaseModel):
    id: str
    dimensions: RoomDimensions
    room_type: str
    theme: str
    occasion: Optional[str] = None
    budget: Optional[float] = None