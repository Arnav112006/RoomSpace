"""Shared fixtures.

Every fixture uses the demo room from docs/room-model.md §8:
12 ft × 10 ft = 365.76 cm × 304.80 cm, origin at the north-west corner,
+x east along the length, +y south along the width.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.layout import Placement
from app.schemas.room import RoomDimensions
from app.services import room_store

DEMO_LENGTH_CM = 365.76
DEMO_WIDTH_CM = 304.80
DEMO_ROOM_JSON = {
    "dimensions": {"length": 12, "width": 10, "unit": "ft"},
    "room_type": "bedroom",
    "theme": "modern",
    "budget": 50000,
}


@pytest.fixture
def demo_dims() -> RoomDimensions:
    return RoomDimensions(length=12, width=10, unit="ft")


def make_placement(
    label: str = "Item",
    x: float = 0,
    y: float = 0,
    w: float = 50,
    d: float = 50,
    rotation: float = 0,
    item_id: str | None = None,
) -> Placement:
    return Placement(
        item_id=item_id or label.lower().replace(" ", "-"),
        label=label,
        x_cm=x,
        y_cm=y,
        width_cm=w,
        depth_cm=d,
        rotation_deg=rotation,
    )


@pytest.fixture(autouse=True)
def _clean_room_store():
    room_store._ROOMS.clear()
    yield
    room_store._ROOMS.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def room_id(client: TestClient) -> str:
    response = client.post("/api/rooms", json=DEMO_ROOM_JSON)
    assert response.status_code == 200
    return response.json()["id"]
