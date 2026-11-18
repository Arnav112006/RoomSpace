"""Command matching: ranking runs for real on fake embeddings, so CI never
downloads the sentence model."""

import numpy as np

from app.services import command_matching as cm

# Tiny hand-made "embedding space": each phrase points along an axis.
VECTORS = {
    "remove the hanging light": [1, 0, 0],
    "add a ceiling fan": [0, 1, 0],
    "rotate the bed": [0, 0, 1],
    "get rid of the lamp dangling from the ceiling": [0.9, 0.1, 0],
    "put a fan up top": [0.1, 0.95, 0.1],
}


def fake_embed(texts):
    out = np.array([VECTORS[t.strip().lower()] for t in texts], dtype=float)
    return out / np.linalg.norm(out, axis=1, keepdims=True)


CANDIDATES = ["remove the hanging light", "add a ceiling fan", "rotate the bed"]


def test_rank_orders_candidates_by_meaning(monkeypatch):
    monkeypatch.setattr(cm, "embed", fake_embed)
    ranked = cm.rank("get rid of the lamp dangling from the ceiling", CANDIDATES)
    assert [c for c, _ in ranked] == ["remove the hanging light", "add a ceiling fan", "rotate the bed"]
    assert ranked[0][1] > 0.9 and ranked[0][1] > ranked[1][1]


def test_endpoint_returns_best_matches_first(client, monkeypatch):
    monkeypatch.setattr(cm, "embed", fake_embed)
    response = client.post("/api/commands/interpret", json={"text": "put a fan up top", "candidates": CANDIDATES})
    assert response.status_code == 200
    matches = response.json()["matches"]
    assert matches[0]["candidate"] == "add a ceiling fan"
    assert len(matches) == 3


def test_endpoint_explains_when_the_ml_extras_are_missing(client, monkeypatch):
    def missing(texts):
        raise cm.MLUnavailable("No module named 'torch'")

    monkeypatch.setattr(cm, "embed", missing)
    response = client.post("/api/commands/interpret", json={"text": "add a fan", "candidates": CANDIDATES})
    assert response.status_code == 503
    assert "requirements-ml.txt" in response.json()["detail"]


def test_endpoint_validates_its_input(client):
    assert client.post("/api/commands/interpret", json={"text": "", "candidates": CANDIDATES}).status_code == 422
    assert client.post("/api/commands/interpret", json={"text": "add a fan", "candidates": []}).status_code == 422
    too_many = {"text": "add a fan", "candidates": ["x"] * 401}
    assert client.post("/api/commands/interpret", json=too_many).status_code == 422
    too_long = {"text": "add a fan", "candidates": ["x" * 121]}
    assert client.post("/api/commands/interpret", json=too_long).status_code == 422
