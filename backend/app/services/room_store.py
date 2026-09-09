"""
In-memory room storage. Swap for a real database later — every
function here is the only place that should touch the underlying
store, so that swap only touches this file.
"""

from fastapi import HTTPException

from app.schemas.room import RoomResponse

_ROOMS: dict[str, RoomResponse] = {}


def save(room: RoomResponse) -> RoomResponse:
    _ROOMS[room.id] = room
    return room


def get(room_id: str) -> RoomResponse:
    room = _ROOMS.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail=f"No room found with id {room_id}")
    return room