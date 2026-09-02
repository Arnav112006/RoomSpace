from uuid import uuid4

from fastapi import APIRouter

from app.schemas.room import RoomCreate, RoomResponse


router = APIRouter(
    prefix="/api/rooms",
    tags=["Rooms"]
)


@router.post("", response_model=RoomResponse)
def create_room(room: RoomCreate):
    room_id = str(uuid4())

    return RoomResponse(
        id=room_id,
        dimensions=room.dimensions,
        room_type=room.room_type,
        theme=room.theme,
        occasion=room.occasion,
        budget=room.budget,
    )