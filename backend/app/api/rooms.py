from uuid import uuid4

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import Response

from app.schemas.layout import Placement
from app.schemas.room import RoomCreate, RoomResponse
from app.services import constraint_engine, layout_renderer, room_analysis, room_store


router = APIRouter(prefix="/api/rooms", tags=["Rooms"])


@router.post("", response_model=RoomResponse)
def create_room(room: RoomCreate):
    room_id = str(uuid4())
    response = RoomResponse(
        id=room_id,
        dimensions=room.dimensions,
        room_type=room.room_type,
        theme=room.theme,
        occasion=room.occasion,
        budget=room.budget,
    )
    return room_store.save(response)


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(room_id: str):
    return room_store.get(room_id)


@router.post("/{room_id}/photo", response_model=RoomResponse)
async def analyze_room_photo(room_id: str, photo: UploadFile = File(...)):
    room = room_store.get(room_id)
    furniture = await room_analysis.detect_furniture(photo)
    room.furniture = furniture
    return room_store.save(room)


@router.post("/{room_id}/validate-layout")
def validate_layout(room_id: str, placements: list[Placement]):
    room = room_store.get(room_id)
    feasible, violations = constraint_engine.validate_layout(room.dimensions, placements)
    svg = layout_renderer.render_layout_svg(room.dimensions, placements, violations)
    return {"feasible": feasible, "violations": violations, "svg": svg}


@router.post("/{room_id}/validate-layout/preview")
def validate_layout_preview(room_id: str, placements: list[Placement]):
    room = room_store.get(room_id)
    _, violations = constraint_engine.validate_layout(room.dimensions, placements)
    svg = layout_renderer.render_layout_svg(room.dimensions, placements, violations)
    return Response(content=svg, media_type="image/svg+xml")