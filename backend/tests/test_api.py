"""HTTP-level tests through FastAPI's TestClient. No server, no YOLO."""

from tests.conftest import DEMO_ROOM_JSON

BED = {"item_id": "bed", "label": "Bed", "x_cm": 10, "y_cm": 10, "width_cm": 150, "depth_cm": 200}
DESK_OVERLAPPING = {"item_id": "desk", "label": "Desk", "x_cm": 100, "y_cm": 100, "width_cm": 120, "depth_cm": 60}


def test_health(client):
    assert client.get("/health").json() == {"status": "ok", "service": "RoomSpace API"}


def test_create_then_get_room(client):
    created = client.post("/api/rooms", json=DEMO_ROOM_JSON).json()
    assert created["id"]
    assert created["furniture"] == []

    fetched = client.get(f"/api/rooms/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == created


def test_unknown_room_is_404(client):
    assert client.get("/api/rooms/does-not-exist").status_code == 404


def test_non_positive_dimensions_are_rejected(client):
    bad = {**DEMO_ROOM_JSON, "dimensions": {"length": 0, "width": 10, "unit": "ft"}}
    assert client.post("/api/rooms", json=bad).status_code == 422


def test_negative_budget_is_rejected(client):
    assert client.post("/api/rooms", json={**DEMO_ROOM_JSON, "budget": -1}).status_code == 422


def test_validate_feasible_layout(client, room_id):
    body = client.post(f"/api/rooms/{room_id}/validate-layout", json=[BED]).json()
    assert body["feasible"] is True
    assert body["violations"] == []
    assert body["svg"].startswith("<svg")


def test_validate_infeasible_layout(client, room_id):
    body = client.post(f"/api/rooms/{room_id}/validate-layout", json=[BED, DESK_OVERLAPPING]).json()
    assert body["feasible"] is False
    assert body["violations"] == ["Bed overlaps with Desk"]


def test_validate_layout_unknown_room_is_404(client):
    assert client.post("/api/rooms/nope/validate-layout", json=[BED]).status_code == 404


def test_validate_preview_returns_svg(client, room_id):
    response = client.post(f"/api/rooms/{room_id}/validate-layout/preview", json=[BED])
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")


def test_layout_from_detection_without_furniture(client, room_id):
    body = client.get(f"/api/rooms/{room_id}/layout-from-detection").json()
    assert body["feasible"] is True
    assert body["svg"] is None


def test_concept_image_returns_png(client, room_id):
    payload = {
        "placements": [BED],
        "selections": {
            "bed": {
                "id": "p-bed-01",
                "name": "Oslo Platform Bed",
                "image_url": "bed-scandi",
                "price": 18999,
                "width_cm": 150,
                "depth_cm": 200,
            }
        },
    }
    response = client.post(f"/api/rooms/{room_id}/concept-image", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")


def test_empty_photo_upload_is_rejected(client, room_id):
    # Rejected before the YOLO model is loaded, so this needs no ML deps.
    response = client.post(
        f"/api/rooms/{room_id}/photo", files={"photo": ("empty.jpg", b"", "image/jpeg")}
    )
    assert response.status_code == 400


# --- doors and windows ---------------------------------------------------

DOOR_JSON = {"id": "door-1", "kind": "door", "wall": "south", "offset_cm": 60, "width_cm": 90}
WINDOW_JSON = {"id": "win-1", "kind": "window", "wall": "east", "offset_cm": 80, "width_cm": 120}
WARDROBE_IN_DOORWAY = {"item_id": "w", "label": "Wardrobe", "x_cm": 40, "y_cm": 244.8, "width_cm": 120, "depth_cm": 60}


def test_create_room_with_openings(client):
    body = client.post("/api/rooms", json={**DEMO_ROOM_JSON, "openings": [DOOR_JSON, WINDOW_JSON]}).json()
    assert [o["id"] for o in body["openings"]] == ["door-1", "win-1"]
    assert body["openings"][0]["hinge"] == "start"
    assert body["openings"][0]["swing"] == "inward"


def test_create_room_rejects_opening_past_wall_end(client):
    too_far = {**WINDOW_JSON, "offset_cm": 250}
    response = client.post("/api/rooms", json={**DEMO_ROOM_JSON, "openings": [too_far]})
    assert response.status_code == 422
    assert "runs past the end" in response.json()["detail"][0]


def test_set_openings_replaces_them(client, room_id):
    response = client.put(f"/api/rooms/{room_id}/openings", json=[DOOR_JSON])
    assert response.status_code == 200
    assert [o["id"] for o in client.get(f"/api/rooms/{room_id}").json()["openings"]] == ["door-1"]

    client.put(f"/api/rooms/{room_id}/openings", json=[])
    assert client.get(f"/api/rooms/{room_id}").json()["openings"] == []


def test_set_openings_rejects_overlap_and_keeps_old_ones(client, room_id):
    client.put(f"/api/rooms/{room_id}/openings", json=[DOOR_JSON])
    clash = {**WINDOW_JSON, "wall": "south", "offset_cm": 100}
    assert client.put(f"/api/rooms/{room_id}/openings", json=[DOOR_JSON, clash]).status_code == 422
    assert len(client.get(f"/api/rooms/{room_id}").json()["openings"]) == 1


def test_validate_layout_uses_room_openings(client, room_id):
    url = f"/api/rooms/{room_id}/validate-layout"
    assert client.post(url, json=[WARDROBE_IN_DOORWAY]).json()["feasible"] is True

    client.put(f"/api/rooms/{room_id}/openings", json=[DOOR_JSON, WINDOW_JSON])
    body = client.post(url, json=[WARDROBE_IN_DOORWAY]).json()
    assert body["feasible"] is False
    assert body["violations"] == ["Wardrobe blocks the door on the south wall"]
    assert 'data-opening="door"' in body["svg"]
    assert 'data-opening="window"' in body["svg"]
