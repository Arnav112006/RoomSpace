"""
Command matching — understands command phrasings the rule-based parser
doesn't, using a small local sentence-embedding model.

The frontend sends what the user typed plus the canonical commands the app
knows for the current room ("remove the Bed", "add a ceiling fan", ...).
This service embeds both with sentence-transformers/all-MiniLM-L6-v2 and
returns the canonical commands closest in meaning. The frontend then runs
the chosen canonical command through the same rule parser and checks as a
typed one, so the model can only ever pick something the rules allow.

Local only: no API key, nothing leaves the machine. The model (~90 MB) is
downloaded from Hugging Face on first use. torch/transformers come from
requirements-ml.txt and are imported lazily, so the core API and CI run
without them (the endpoint then returns 503).
"""

from functools import lru_cache

import numpy as np

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


class MLUnavailable(RuntimeError):
    """torch/transformers aren't installed (requirements-ml.txt)."""


@lru_cache(maxsize=1)
def _load_model():
    try:
        from transformers import AutoModel, AutoTokenizer
    except ImportError as e:  # pragma: no cover - depends on the environment
        raise MLUnavailable(str(e)) from e
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME)
    model.eval()
    return tokenizer, model


@lru_cache(maxsize=4096)
def _embed_one(text: str) -> tuple[float, ...]:
    """Unit-length sentence embedding (mean pooling, as the model card
    recommends). Cached: the candidate commands repeat on every call."""
    try:
        import torch
    except ImportError as e:
        raise MLUnavailable(str(e)) from e
    tokenizer, model = _load_model()
    with torch.no_grad():
        batch = tokenizer([text], padding=True, truncation=True, max_length=64, return_tensors="pt")
        tokens = model(**batch).last_hidden_state
        mask = batch["attention_mask"].unsqueeze(-1).float()
        vector = (tokens * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
        vector = torch.nn.functional.normalize(vector, dim=-1)[0]
    return tuple(vector.tolist())


def embed(texts: list[str]) -> np.ndarray:
    return np.array([_embed_one(t.strip().lower()) for t in texts])


def rank(query: str, candidates: list[str], top_k: int = 3) -> list[tuple[str, float]]:
    """Candidates most similar in meaning to `query` (cosine similarity,
    -1..1), best first."""
    vectors = embed([query, *candidates])
    scores = vectors[1:] @ vectors[0]
    order = np.argsort(-scores)[:top_k]
    return [(candidates[i], round(float(scores[i]), 4)) for i in order]
