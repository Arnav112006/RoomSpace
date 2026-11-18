"""Style suggestion: colour extraction and theme ranking run for real; the
CLIP model itself is replaced by a fake so CI never downloads it."""

import io

import numpy as np
import pytest
from PIL import Image

from app.api import rooms
from app.services import style_suggestion as ss

BEIGE = (226, 211, 186)
WALNUT = (92, 62, 40)
SAGE = (125, 154, 140)


def room_photo(wall=BEIGE, floor=WALNUT, accent=SAGE, size=(320, 240)) -> Image.Image:
    """Wall colour on top, floor colour at the bottom, an accent block (sofa) in between."""
    w, h = size
    pixels = np.zeros((h, w, 3), dtype=np.uint8)
    pixels[: int(h * 0.6)] = wall
    pixels[int(h * 0.6):] = floor
    pixels[int(h * 0.45): int(h * 0.7), int(w * 0.3): int(w * 0.7)] = accent
    return Image.fromarray(pixels)


def png_bytes(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def close(hex_colour: str, rgb: tuple[int, int, int], tol: int = 6) -> bool:
    got = [int(hex_colour[i: i + 2], 16) for i in (1, 3, 5)]
    return all(abs(a - b) <= tol for a, b in zip(got, rgb))


# --- pure helpers ------------------------------------------------------------------------


def test_rank_themes_is_a_sorted_probability_distribution():
    ranked = ss.rank_themes([0.20, 0.21, 0.27, 0.19, 0.18, 0.22])
    assert ranked[0].theme == "Scandinavian"
    assert [r.score for r in ranked] == sorted((r.score for r in ranked), reverse=True)
    assert sum(r.score for r in ranked) == pytest.approx(1, abs=1e-3)
    assert {r.theme for r in ranked} == set(ss.THEMES)


def test_dominant_colours_finds_the_main_colours_by_share():
    pixels = np.array([BEIGE] * 70 + [WALNUT] * 20 + [SAGE] * 10)
    colours = ss.dominant_colours(pixels, k=3)
    assert close(colours[0][0], BEIGE) and colours[0][1] == pytest.approx(0.7)
    assert close(colours[1][0], WALNUT)
    assert close(colours[2][0], SAGE)


def test_wall_and_floor_come_from_the_top_and_bottom_of_the_frame():
    photos = [room_photo(), room_photo(size=(200, 300))]
    assert close(ss.region_colour(photos, 0.0, 0.33), BEIGE)
    assert close(ss.region_colour(photos, 0.8, 1.0), WALNUT)
    assert close(ss.palette_of(photos)[0], BEIGE)


def test_suggest_style_combines_clip_and_colours(monkeypatch):
    monkeypatch.setattr(ss, "theme_similarities", lambda images, room_type: ([0.2, 0.25, 0.3, 0.1, 0.1, 0.2], 100.0))
    result = ss.suggest_style([room_photo()], "Bedroom")
    assert result.themes[0].theme == "Scandinavian"
    assert close(result.wall, BEIGE) and close(result.floor, WALNUT)


# --- endpoint ------------------------------------------------------------------------------


def post_photos(client, room_id, *images, name="room.png"):
    files = [("photos", (name, png_bytes(i) if isinstance(i, Image.Image) else i, "image/png")) for i in images]
    return client.post(f"/api/rooms/{room_id}/style-suggestion", files=files)


def test_endpoint_returns_ranked_themes_and_colours(client, room_id, monkeypatch):
    seen = {}

    def fake(images, room_type):
        seen["n"], seen["room_type"] = len(images), room_type
        return [0.1, 0.1, 0.1, 0.3, 0.1, 0.1], 100.0

    monkeypatch.setattr(ss, "theme_similarities", fake)
    response = post_photos(client, room_id, room_photo(), room_photo())
    assert response.status_code == 200
    body = response.json()
    assert body["themes"][0]["theme"] == "Industrial"
    assert close(body["wall"], BEIGE) and close(body["floor"], WALNUT)
    assert seen == {"n": 2, "room_type": "bedroom"}  # the fixture room


def test_endpoint_explains_when_the_ml_extras_are_missing(client, room_id, monkeypatch):
    def missing(images, room_type):
        raise ss.MLUnavailable("No module named 'torch'")

    monkeypatch.setattr(ss, "theme_similarities", missing)
    response = post_photos(client, room_id, room_photo())
    assert response.status_code == 503
    assert "requirements-ml.txt" in response.json()["detail"]


def test_endpoint_rejects_empty_unreadable_and_too_many_photos(client, room_id, monkeypatch):
    monkeypatch.setattr(ss, "theme_similarities", lambda images, room_type: ([0.2] * 6, 100.0))
    assert post_photos(client, room_id, b"").status_code == 400
    assert post_photos(client, room_id, b"not an image").status_code == 400
    too_many = [room_photo()] * (rooms.room_analysis.MAX_PHOTOS_PER_ROOM + 1)
    assert post_photos(client, room_id, *too_many).status_code == 422
