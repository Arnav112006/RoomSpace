"""
Zero-shot product-to-style matching using pretrained CLIP — no
fine-tuning, no training data required.
"""

from functools import lru_cache
from io import BytesIO

import requests
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

from app.schemas.product import Product

_MODEL_NAME = "openai/clip-vit-base-patch32"
_IMAGE_FETCH_TIMEOUT_S = 10


@lru_cache(maxsize=1)
def _load_model() -> tuple[CLIPModel, CLIPProcessor]:
    model = CLIPModel.from_pretrained(_MODEL_NAME)
    processor = CLIPProcessor.from_pretrained(_MODEL_NAME)
    model.eval()
    return model, processor


def _fetch_image(url: str) -> Image.Image | None:
    try:
        response = requests.get(url, timeout=_IMAGE_FETCH_TIMEOUT_S)
        response.raise_for_status()
        return Image.open(BytesIO(response.content)).convert("RGB")
    except Exception:
        return None


def score_products(
    style_text: str,
    products: list[Product],
    top_k: int | None = None,
) -> list[tuple[Product, float]]:
    if not products:
        return []

    model, processor = _load_model()

    images: list[Image.Image] = []
    valid_products: list[Product] = []
    for product in products:
        image = _fetch_image(product.image_url)
        if image is not None:
            images.append(image)
            valid_products.append(product)

    if not images:
        return []

    inputs = processor(text=[style_text], images=images, return_tensors="pt", padding=True)

    with torch.no_grad():
        outputs = model(**inputs)
        text_embeds = outputs.text_embeds
        image_embeds = outputs.image_embeds
        text_embeds = text_embeds / text_embeds.norm(dim=-1, keepdim=True)
        image_embeds = image_embeds / image_embeds.norm(dim=-1, keepdim=True)
        similarities = (image_embeds @ text_embeds.T).squeeze(-1)

    scored = list(zip(valid_products, similarities.tolist()))
    scored.sort(key=lambda pair: pair[1], reverse=True)

    return scored[:top_k] if top_k is not None else scored