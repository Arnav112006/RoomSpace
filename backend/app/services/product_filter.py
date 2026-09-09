"""
Deterministic pre-filtering for product recommendation. First stage of:
    Product Catalog -> Dimension/Budget/Category Filtering
        -> CLIP Matching -> Ranking -> Recommended Products
"""

from app.schemas.product import Product, ProductCategory


def filter_products(
    catalog: list[Product],
    category: ProductCategory,
    max_width_cm: float,
    max_depth_cm: float,
    budget_remaining: float,
) -> list[Product]:
    return [
        p
        for p in catalog
        if p.category == category
        and p.width_cm <= max_width_cm
        and p.depth_cm <= max_depth_cm
        and p.price <= budget_remaining
    ]