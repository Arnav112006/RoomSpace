"""
Room Analysis service — local object detection via YOLOv8 (ultralytics),
pretrained on COCO. No API key, no network call at inference time.

Known limitation: COCO has no "door" or "window" classes, so those are
never auto-detected here. They stay a manual step in the preference
form until/unless a custom-trained or fine-tuned model replaces this.

Sizing: when the room's real dimensions are known (passed in from the
room the photo belongs to), each item's width/depth is estimated
proportionally from how much of the photo's frame its bounding box
occupies, scaled against the room's actual length/width in cm. This
assumes the photo roughly captures the room's full width -- a tight
crop or steep angle will skew the estimate, same limitation any
single-photo approach has without a calibration reference. When room
dimensions aren't provided, or the proportional estimate comes out
implausibly small, a per-type default is used instead. Either way,
these are starting values for the user to correct, not measurements.
"""

from functools import lru_cache

from fastapi import HTTPException, UploadFile

from app.schemas.furniture import FurnitureItem, FurnitureType

# Maps YOLO's COCO class names to our FurnitureType enum. COCO classes
# not listed here (e.g. "person", "cat") are ignored entirely.
_COCO_TO_FURNITURE_TYPE: dict[str, FurnitureType] = {
    "bed": FurnitureType.BED,
    "couch": FurnitureType.SOFA,
    "chair": FurnitureType.CHAIR,
    "dining table": FurnitureType.TABLE,
    "tv": FurnitureType.OTHER,
    "refrigerator": FurnitureType.OTHER,
    "sink": FurnitureType.OTHER,
    "toilet": FurnitureType.OTHER,
    "potted plant": FurnitureType.OTHER,
    "book": FurnitureType.SHELF,  # weak proxy signal for a bookshelf area
}

# Fallback dimensions per type, in centimetres -- used when room
# dimensions aren't available or the proportional estimate is
# implausible. Editable by the user after detection either way.
_DEFAULT_DIMENSIONS_CM: dict[FurnitureType, tuple[float, float]] = {
    FurnitureType.BED: (150, 200),
    FurnitureType.WARDROBE: (120, 60),
    FurnitureType.TABLE: (140, 80),
    FurnitureType.CHAIR: (45, 45),
    FurnitureType.DESK: (120, 60),
    FurnitureType.SOFA: (180, 90),
    FurnitureType.SHELF: (90, 30),
    FurnitureType.OTHER: (60, 60),
}

_CONFIDENCE_THRESHOLD = 0.4
_MIN_PLAUSIBLE_DIMENSION_CM = 20.0  # below this, the proportional estimate is discarded


@lru_cache(maxsize=1)
def _load_model():
    """Loaded once per process. Downloads yolov8n.pt on first run if
    not already cached locally by ultralytics."""
    from ultralytics import YOLO

    return YOLO("yolov8n.pt")


def _zone_for_box(x_center_frac: float, y_center_frac: float) -> str:
    """Turns a bounding box center (as a 0-1 fraction of image width
    and height) into a coarse, human-readable zone description."""
    if x_center_frac < 1 / 3:
        x_zone = "left"
    elif x_center_frac < 2 / 3:
        x_zone = "center"
    else:
        x_zone = "right"

    if y_center_frac < 1 / 3:
        y_zone = "back"
    elif y_center_frac < 2 / 3:
        y_zone = "middle"
    else:
        y_zone = "front"

    if x_zone == "center" and y_zone == "middle":
        return "center of the room"
    return f"{y_zone} {x_zone} of the frame"


def _estimate_dimensions_cm(
    furniture_type: FurnitureType,
    box_width_frac: float,
    box_height_frac: float,
    room_length_cm: float | None,
    room_width_cm: float | None,
) -> tuple[float, float]:
    """Scales a bounding box's fraction of the frame against the
    room's real dimensions. Falls back to the per-type default if room
    dimensions weren't given, or if the result is implausibly small
    (a common symptom of a partially-occluded or distant object)."""
    default_w, default_d = _DEFAULT_DIMENSIONS_CM[furniture_type]

    if room_length_cm is None or room_width_cm is None:
        return default_w, default_d

    estimated_w = box_width_frac * room_length_cm
    estimated_d = box_height_frac * room_width_cm

    if estimated_w < _MIN_PLAUSIBLE_DIMENSION_CM or estimated_d < _MIN_PLAUSIBLE_DIMENSION_CM:
        return default_w, default_d

    return round(estimated_w, 1), round(estimated_d, 1)


def _results_to_furniture(
    result,
    image_width: int,
    image_height: int,
    room_length_cm: float | None = None,
    room_width_cm: float | None = None,
) -> list[FurnitureItem]:
    """Converts one ultralytics Results object into FurnitureItems.
    Pulled out of detect_furniture() so it can be unit-tested against
    a hand-built fake Results object without loading the real model.
    """
    items: list[FurnitureItem] = []

    for box in result.boxes:
        confidence = float(box.conf[0])
        if confidence < _CONFIDENCE_THRESHOLD:
            continue

        class_name = result.names[int(box.cls[0])]
        furniture_type = _COCO_TO_FURNITURE_TYPE.get(class_name)
        if furniture_type is None:
            continue  # not a class we care about (e.g. "person")

        x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
        x_center_frac = ((x1 + x2) / 2) / image_width
        y_center_frac = ((y1 + y2) / 2) / image_height
        box_width_frac = (x2 - x1) / image_width
        box_height_frac = (y2 - y1) / image_height

        width_cm, depth_cm = _estimate_dimensions_cm(
            furniture_type, box_width_frac, box_height_frac, room_length_cm, room_width_cm
        )

        items.append(
            FurnitureItem(
                type=furniture_type,
                label=class_name.replace("_", " ").title(),
                width_cm=width_cm,
                depth_cm=depth_cm,
                approximate_zone=_zone_for_box(x_center_frac, y_center_frac),
                is_fixed=False,
                source="vision",
            )
        )

    return items


async def detect_furniture(
    photo: UploadFile,
    room_length_cm: float | None = None,
    room_width_cm: float | None = None,
) -> list[FurnitureItem]:
    """Runs local YOLO detection on the uploaded photo and returns one
    FurnitureItem per recognized object above the confidence threshold.
    Doors and windows are never returned here — see module docstring.

    If room_length_cm/room_width_cm are given (the room this photo
    belongs to), item sizes are estimated proportionally from the
    photo; otherwise per-type defaults are used.
    """
    image_bytes = await photo.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded photo is empty")

    try:
        import numpy as np
        from PIL import Image
        import io

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read image: {e}") from e

    model = _load_model()
    results = model(np.array(image), verbose=False)

    if not results:
        return []

    return _results_to_furniture(
        results[0], image.width, image.height, room_length_cm, room_width_cm
    )