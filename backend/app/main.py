from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.rooms import router as rooms_router

_STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(
    title="RoomSpace API",
    description=(
        "AI-assisted room layout planning. Detects existing furniture "
        "from a photo (YOLO), generates and validates physically "
        "feasible layouts (deterministic geometry), and recommends "
        "real products that match the room's style (CLIP)."
    ),
    version="0.1.0",
    openapi_tags=[
        {
            "name": "Rooms",
            "description": (
                "Create a room, run vision-based furniture detection on a "
                "photo, and validate proposed layouts against physical "
                "constraints (boundaries, overlap, walkway clearance)."
            ),
        },
    ],
)

app.include_router(rooms_router)

# The Vite dev server runs on a different origin, so the browser needs
# explicit permission to call this API. Add any other dev origin here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def demo_page():
    return FileResponse(_STATIC_DIR / "demo.html")


@app.get("/health", tags=["Rooms"])
def health_check():
    return {"status": "ok", "service": "RoomSpace API"}