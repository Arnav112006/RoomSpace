from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from app.schemas.concept import ConceptImageRequest
from app.schemas.layout import Placement
from app.schemas.opening import Opening
from app.schemas.room import RoomCreate, RoomDimensions, RoomResponse
from app.schemas.style import StyleSuggestion
from app.services import (
    constraint_engine,
    concept_renderer,
    layout_renderer,
    room_analysis,
    room_store,
    style_suggestion,
    zone_placement,
    units,
)


router = APIRouter(prefix="/api/rooms", tags=["Rooms"])


def _check_openings(dimensions: RoomDimensions, openings: list[Opening]) -> None:
    """Doors/windows must fit on their wall and not overlap each other."""
    length_cm, width_cm = units.room_dimensions_cm(dimensions)
    errors = constraint_engine.opening_fit_errors(openings, length_cm, width_cm)
    if errors:
        raise HTTPException(status_code=422, detail=errors)


@router.post("", response_model=RoomResponse)
def create_room(room: RoomCreate):
    _check_openings(room.dimensions, room.openings)
    room_id = str(uuid4())
    response = RoomResponse(
        id=room_id,
        dimensions=room.dimensions,
        room_type=room.room_type,
        theme=room.theme,
        occasion=room.occasion,
        budget=room.budget,
        openings=room.openings,
    )
    return room_store.save(response)


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(room_id: str):
    return room_store.get(room_id)


@router.put("/{room_id}/openings", response_model=RoomResponse)
def set_openings(room_id: str, openings: list[Opening]):
    """Replaces the room's doors and windows (docs/room-model.md §4)."""
    room = room_store.get(room_id)
    _check_openings(room.dimensions, openings)
    room.openings = openings
    return room_store.save(room)


@router.post("/{room_id}/photo", response_model=RoomResponse)
async def analyze_room_photo(room_id: str, photo: UploadFile = File(...)):
    room = room_store.get(room_id)
    room_length_cm, room_width_cm = units.room_dimensions_cm(room.dimensions)
    furniture = await room_analysis.detect_furniture(photo, room_length_cm, room_width_cm)
    room.furniture = furniture
    return room_store.save(room)


@router.post("/{room_id}/photos", response_model=RoomResponse)
async def analyze_room_photos(room_id: str, photos: list[UploadFile] = File(...)):
    """Several photos of the same room (different angles). Each is run
    through detection, then merged so furniture seen in more than one
    photo is not counted twice (see room_analysis.merge_detections)."""
    room = room_store.get(room_id)
    if len(photos) > room_analysis.MAX_PHOTOS_PER_ROOM:
        raise HTTPException(
            status_code=422,
            detail=f"Upload at most {room_analysis.MAX_PHOTOS_PER_ROOM} photos per room",
        )
    room_length_cm, room_width_cm = units.room_dimensions_cm(room.dimensions)
    per_photo = []
    for photo in photos:
        try:
            per_photo.append(await room_analysis.detect_furniture(photo, room_length_cm, room_width_cm))
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=f"{photo.filename}: {e.detail}") from e
    room.furniture = room_analysis.merge_detections(per_photo)
    return room_store.save(room)

@router.post("/{room_id}/style-suggestion", response_model=StyleSuggestion)
async def suggest_room_style(room_id: str, photos: list[UploadFile] = File(...)):
    """Which theme the room already looks like (zero-shot CLIP, run locally)
    and its dominant wall/floor colours. Suggestions only: nothing about the
    room is changed."""
    room = room_store.get(room_id)
    if len(photos) > room_analysis.MAX_PHOTOS_PER_ROOM:
        raise HTTPException(
            status_code=422,
            detail=f"Upload at most {room_analysis.MAX_PHOTOS_PER_ROOM} photos per room",
        )
    images = [await style_suggestion.read_image(photo) for photo in photos]
    try:
        # CLIP is CPU-heavy; keep it off the event loop.
        return await run_in_threadpool(style_suggestion.suggest_style, images, room.room_type)
    except style_suggestion.MLUnavailable as e:
        raise HTTPException(
            status_code=503,
            detail="Style suggestions need the ML extras: pip install -r requirements-ml.txt",
        ) from e


@router.post("/{room_id}/validate-layout")
def validate_layout(room_id: str, placements: list[Placement]):
    room = room_store.get(room_id)
    feasible, violations = constraint_engine.validate_layout(room.dimensions, placements, openings=room.openings)
    svg = layout_renderer.render_layout_svg(room.dimensions, placements, violations, room.openings)
    return {"feasible": feasible, "violations": violations, "svg": svg}


@router.post("/{room_id}/validate-layout/preview")
def validate_layout_preview(room_id: str, placements: list[Placement]):
    room = room_store.get(room_id)
    _, violations = constraint_engine.validate_layout(room.dimensions, placements, openings=room.openings)
    svg = layout_renderer.render_layout_svg(room.dimensions, placements, violations, room.openings)
    return Response(content=svg, media_type="image/svg+xml")

@router.post("/{room_id}/concept-image")
def concept_image(room_id: str, request: ConceptImageRequest):
    """Final PNG: the chosen layout with the chosen products placed in it.

    Selections come from the client's catalog so this route stays a renderer —
    it does not pick products and does not modify the room.
    """
    room = room_store.get(room_id)
    _, violations = constraint_engine.validate_layout(room.dimensions, request.placements, openings=room.openings)
    png = concept_renderer.render_concept_image(
        room.dimensions,
        request.placements,
        request.selections,
        # The theme picked on the products stage, if any; otherwise the room's.
        theme=request.theme or room.theme,
        budget=room.budget,
        violations=violations,
        openings=room.openings,
    )
    return Response(content=png, media_type="image/png")


@router.get("/{room_id}/layout-from-detection")
def layout_from_detection(room_id: str):
    """Turns whatever furniture was detected by /photo into a rough
    floor plan: maps each item's detected zone to an approximate
    position, then runs it through the same Constraint Engine and
    renderer as /validate-layout. Not an optimized layout -- see
    zone_placement.py's docstring -- but it makes detection visually
    verifiable without the user typing coordinates by hand.
    """
    room = room_store.get(room_id)
    if not room.furniture:
        return {"feasible": True, "violations": [], "svg": None, "message": "No furniture detected yet."}

    placements = zone_placement.placements_from_detection(room.dimensions, room.furniture)
    feasible, violations = constraint_engine.validate_layout(room.dimensions, placements, openings=room.openings)
    svg = layout_renderer.render_layout_svg(room.dimensions, placements, violations, room.openings)
    return {"feasible": feasible, "violations": violations, "svg": svg}