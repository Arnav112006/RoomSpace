from pydantic import BaseModel


class Placement(BaseModel):
    """A furniture item's resolved position within a specific layout
    candidate. width_cm/depth_cm are copied from the FurnitureItem at
    placement time so the Constraint Engine is self-contained and
    doesn't need to look anything up elsewhere."""

    item_id: str
    label: str
    x_cm: float
    y_cm: float
    width_cm: float
    depth_cm: float
    rotation_deg: float = 0  # one of 0, 90, 180, 270

