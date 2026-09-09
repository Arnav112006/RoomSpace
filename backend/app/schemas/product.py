from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ProductCategory(str, Enum):
    BED = "bed"
    WARDROBE = "wardrobe"
    TABLE = "table"
    CHAIR = "chair"
    DESK = "desk"
    SOFA = "sofa"
    SHELF = "shelf"
    LAMP = "lamp"
    DECOR = "decor"
    OTHER = "other"


class Product(BaseModel):
    id: str
    name: str
    category: ProductCategory
    image_url: str
    product_url: str
    price: float = Field(..., ge=0)
    width_cm: float
    depth_cm: float
    height_cm: Optional[float] = None
    theme: Optional[str] = Field(
        default=None,
        description="e.g. 'modern', 'minimalist' -- used by the CLIP matching "
        "stage later, not by the hard filter in product_filter.py",
    )