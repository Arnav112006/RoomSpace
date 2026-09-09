"""
Ties together filtering (hard, deterministic) and CLIP scoring
(ranking only) into the full product recommendation pipeline.
"""

from app.schemas.product import Product, ProductCategory
from app.services.product_filter import filter_products
from ml.clip_matching.zero_shot import score_products


def recommend_products(
    catalog: list[Product],
    category: ProductCategory,
    max_width_cm: float,
    max_depth_cm: float,
    budget_remaining: float,
    style_text: str,
    top_k: int = 5,
) -> list[tuple[Product, float]]:
    eligible = filter_products(
        catalog,
        category=category,
        max_width_cm=max_width_cm,
        max_depth_cm=max_depth_cm,
        budget_remaining=budget_remaining,
    )
    return score_products(style_text, eligible, top_k=top_k)