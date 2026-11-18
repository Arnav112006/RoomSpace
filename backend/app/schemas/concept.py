"""Request shape for the final concept-image endpoint.

The frontend owns the (currently mock) product catalog, so the selected
products are sent with the request instead of being duplicated here. This
keeps the endpoint a pure renderer: it never invents recommendations.
"""

from pydantic import BaseModel, Field

from app.schemas.layout import Placement


class ConceptProduct(BaseModel):
    """The subset of Product needed to draw one item on the concept sheet."""

    id: str
    name: str
    image_url: str
    price: float
    width_cm: float
    depth_cm: float


class ConceptImageRequest(BaseModel):
    placements: list[Placement]
    selections: dict[str, ConceptProduct]  # placement.item_id -> chosen product
    # Theme the products were browsed in; defaults to the room's theme.
    theme: str | None = Field(default=None, max_length=40)
