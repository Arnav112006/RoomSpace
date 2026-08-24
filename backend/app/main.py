from fastapi import FastAPI

from app.api.rooms import router as rooms_router


app = FastAPI(
    title="RoomSpace API",
    version="0.1.0"
)


app.include_router(rooms_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "RoomSpace API"
    }