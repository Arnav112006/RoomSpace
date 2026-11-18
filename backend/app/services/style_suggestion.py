"""
Style suggestion — which of the six themes a room already looks like, and
what colours it has, from the user's own photos.

Theme: zero-shot CLIP (openai/clip-vit-base-patch32), run locally. Each
theme is described by a few text prompts; the photos' image embeddings are
compared with each theme's prompt embedding and turned into probabilities.
No fine-tuning and no training data; no API key; nothing leaves the machine.
The first run downloads the model weights (~600 MB) from Hugging Face.

Colours: a small k-means over the photos' pixels (numpy only). The wall
colour is taken from the upper part of the frame and the floor colour from
the bottom, which is where they usually are in a room photo — a heuristic,
so the UI presents both as suggestions the user can accept or ignore.

torch/transformers come from requirements-ml.txt and are imported lazily,
so the core API and CI run without them (the endpoint then returns 503).
"""

import io
import math
from functools import lru_cache

import numpy as np
from fastapi import HTTPException, UploadFile
from PIL import Image

from app.schemas.style import StyleSuggestion, ThemeScore

MODEL_NAME = "openai/clip-vit-base-patch32"
THEMES = ["Modern", "Minimalist", "Scandinavian", "Industrial", "Traditional", "Bohemian"]

# A few phrasings per theme; their embeddings are averaged, which makes
# zero-shot CLIP noticeably more stable than a single prompt.
_PROMPTS: dict[str, list[str]] = {
    "Modern": [
        "a photo of a modern {room} interior with sleek furniture and clean lines",
        "a contemporary {room} with dark accents and metal details",
        "a stylish modern {room}",
    ],
    "Minimalist": [
        "a photo of a minimalist {room} interior, white and uncluttered",
        "a simple {room} with very little furniture and bare surfaces",
        "a calm minimal {room} with plain white walls",
    ],
    "Scandinavian": [
        "a photo of a scandinavian {room} interior with light wood and white walls",
        "a cosy nordic {room} with pale oak furniture and plants",
        "a bright scandi style {room}",
    ],
    "Industrial": [
        "a photo of an industrial {room} interior with exposed brick and metal",
        "a loft {room} with a concrete floor and black steel",
        "a raw urban warehouse style {room}",
    ],
    "Traditional": [
        "a photo of a traditional {room} interior with classic wooden furniture",
        "an elegant {room} with ornate antique furniture and rich colours",
        "a classic formal {room} with mouldings",
    ],
    "Bohemian": [
        "a photo of a bohemian {room} interior with plants, rattan and colourful textiles",
        "an eclectic boho {room} with patterned rugs",
        "a relaxed {room} with macrame and lots of plants",
    ],
}

_THUMB_PX = 96  # photos are downsampled to this for colour clustering


class MLUnavailable(RuntimeError):
    """torch/transformers aren't installed (requirements-ml.txt)."""


@lru_cache(maxsize=1)
def _load_clip():
    try:
        from transformers import CLIPModel, CLIPProcessor
    except ImportError as e:  # pragma: no cover - depends on the environment
        raise MLUnavailable(str(e)) from e
    model = CLIPModel.from_pretrained(MODEL_NAME)
    processor = CLIPProcessor.from_pretrained(MODEL_NAME)
    model.eval()
    return model, processor


# --- pure helpers (tested without the model) ----------------------------------------


def rank_themes(similarities: list[float], logit_scale: float = 100.0) -> list[ThemeScore]:
    """Softmax over per-theme cosine similarities (CLIP's own logit scale),
    best first."""
    logits = [s * logit_scale for s in similarities]
    top = max(logits)
    exps = [math.exp(v - top) for v in logits]
    total = sum(exps)
    scored = [ThemeScore(theme=t, score=round(e / total, 4)) for t, e in zip(THEMES, exps)]
    return sorted(scored, key=lambda s: s.score, reverse=True)


def _hex(rgb: np.ndarray) -> str:
    r, g, b = (int(round(float(c))) for c in np.clip(rgb, 0, 255))
    return f"#{r:02x}{g:02x}{b:02x}"


def dominant_colours(pixels: np.ndarray, k: int = 5, iterations: int = 12) -> list[tuple[str, float]]:
    """k-means over an (N, 3) RGB array. Returns (hex, share) pairs, most
    common first. Deterministic: initial centres are spread over the
    brightness-sorted pixels rather than chosen at random."""
    pixels = pixels.reshape(-1, 3).astype(np.float64)
    if len(pixels) == 0:
        return []
    k = min(k, len(pixels))
    order = np.argsort(pixels.sum(axis=1))
    centres = pixels[order[np.linspace(0, len(pixels) - 1, k).astype(int)]].copy()
    for _ in range(iterations):
        distances = ((pixels[:, None, :] - centres[None, :, :]) ** 2).sum(axis=2)
        labels = distances.argmin(axis=1)
        for i in range(k):
            members = pixels[labels == i]
            if len(members):
                centres[i] = members.mean(axis=0)
    counts = np.bincount(labels, minlength=k)
    ranked = sorted(range(k), key=lambda i: counts[i], reverse=True)
    return [(_hex(centres[i]), counts[i] / len(pixels)) for i in ranked if counts[i] > 0]


def _thumb(image: Image.Image) -> np.ndarray:
    return np.asarray(image.convert("RGB").resize((_THUMB_PX, _THUMB_PX)))


def region_colour(images: list[Image.Image], top: float, bottom: float) -> str:
    """Dominant colour of the band between `top` and `bottom` (fractions of
    the frame height) across all photos."""
    bands = []
    for image in images:
        thumb = _thumb(image)
        bands.append(thumb[int(top * _THUMB_PX): max(int(bottom * _THUMB_PX), int(top * _THUMB_PX) + 1)])
    return dominant_colours(np.concatenate([b.reshape(-1, 3) for b in bands]), k=3)[0][0]


def palette_of(images: list[Image.Image], k: int = 5) -> list[str]:
    pixels = np.concatenate([_thumb(i).reshape(-1, 3) for i in images])
    return [colour for colour, _ in dominant_colours(pixels, k=k)]


# --- the model -------------------------------------------------------------------------


def theme_similarities(images: list[Image.Image], room_type: str) -> tuple[list[float], float]:
    """Cosine similarity of the photos (averaged) to each theme's prompts
    (averaged), in THEMES order, plus CLIP's logit scale."""
    import torch

    model, processor = _load_clip()
    room = (room_type or "room").lower()
    prompts = [p.format(room=room) for t in THEMES for p in _PROMPTS[t]]
    per_theme = len(prompts) // len(THEMES)
    with torch.no_grad():
        text = model.get_text_features(**processor(text=prompts, return_tensors="pt", padding=True))
        text = text / text.norm(dim=-1, keepdim=True)
        themes = text.reshape(len(THEMES), per_theme, -1).mean(dim=1)
        themes = themes / themes.norm(dim=-1, keepdim=True)
        pics = model.get_image_features(**processor(images=[i.convert("RGB") for i in images], return_tensors="pt"))
        pics = pics / pics.norm(dim=-1, keepdim=True)
        photo = pics.mean(dim=0)
        photo = photo / photo.norm()
        sims = (themes @ photo).tolist()
        scale = float(model.logit_scale.exp().item())
    return sims, scale


def suggest_style(images: list[Image.Image], room_type: str) -> StyleSuggestion:
    try:
        sims, scale = theme_similarities(images, room_type)
    except ImportError as e:  # torch missing
        raise MLUnavailable(str(e)) from e
    return StyleSuggestion(
        themes=rank_themes(sims, scale),
        palette=palette_of(images),
        wall=region_colour(images, 0.0, 0.33),
        floor=region_colour(images, 0.8, 1.0),
    )


async def read_image(photo: UploadFile) -> Image.Image:
    data = await photo.read()
    if not data:
        raise HTTPException(status_code=400, detail=f"{photo.filename}: uploaded photo is empty")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
        return image.convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"{photo.filename}: could not read image") from e
