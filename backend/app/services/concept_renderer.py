"""Draws the final concept sheet: the chosen layout with the chosen products.

This is presentation only. Positions come from the layout, product details
from the request, and feasibility from the Constraint Engine. The renderer
never changes a placement and never decides which product to use.

Output is a PNG so the UI can show and download one self-contained image.
Product photos are served from app/static/products (see ATTRIBUTION.md), so
rendering is deterministic and needs no network at runtime.
"""

import math
import re
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from app.schemas.concept import ConceptProduct
from app.schemas.layout import Placement
from app.schemas.opening import Opening, OpeningKind
from app.schemas.room import RoomDimensions
from app.services.layout_renderer import INWARD_NORMAL, opening_shape
from app.services.units import room_dimensions_cm

_PRODUCT_DIR = Path(__file__).resolve().parents[1] / "static" / "products"
_SAFE_KEY = re.compile(r"^[A-Za-z0-9_-]+$")

_PAPER = "#faf8f2"
_INK = "#101820"
_MUTED = "#8b98a5"
_BRASS = "#c8a45d"
_RED = "#e2725b"
_GRID = "#e4ded0"
_WINDOW = "#4a90c2"
_DOOR = "#8b6b3d"
_MAX_PLAN_PX = 900
_MARGIN = 68
_HEADER = 116
_FOOTER = 88


def _font(size: int) -> ImageFont.ImageFont:
    # load_default ships with Pillow; no system font path to get wrong.
    return ImageFont.load_default(size=size)


def _ellipsis(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> str:
    if draw.textlength(text, font=font) <= max_width:
        return text
    shortened = text
    while shortened and draw.textlength(shortened + "...", font=font) > max_width:
        shortened = shortened[:-1]
    return shortened + "..."


def _rupees(amount: float) -> str:
    # Pillow's bundled font has no ₹ glyph; "Rs" renders everywhere.
    return f"Rs {amount:,.0f}"


def _photo_for(key: str, width: int, height: int) -> Image.Image | None:
    """Return a photo cropped to the footprint, or None if unavailable.

    The key comes from the catalog's image_url field. It is validated so a
    malformed value can never escape the products directory.
    """
    if width < 4 or height < 4 or not _SAFE_KEY.fullmatch(key):
        return None
    path = _PRODUCT_DIR / f"{key}.jpg"
    if not path.is_file():
        return None
    with Image.open(path) as image:
        return ImageOps.fit(image.convert("RGB"), (width, height), method=Image.Resampling.LANCZOS)


def render_concept_image(
    dimensions: RoomDimensions,
    placements: list[Placement],
    selections: dict[str, ConceptProduct],
    *,
    theme: str = "",
    budget: float | None = None,
    violations: list[str] | None = None,
    openings: list[Opening] | None = None,
) -> bytes:
    """Return a PNG showing the room, placements and selected product photos.

    Coordinates follow docs/room-model.md: origin at the north-west corner,
    +x east, +y south, everything in centimetres.
    """
    violations = violations or []
    length_cm, width_cm = room_dimensions_cm(dimensions)
    scale = min(1.9, _MAX_PLAN_PX / length_cm)
    plan_w, plan_h = int(length_cm * scale), int(width_cm * scale)

    canvas_w = plan_w + 2 * _MARGIN
    footer_y = _HEADER + plan_h + 26
    canvas_h = footer_y + _FOOTER
    image = Image.new("RGB", (canvas_w, canvas_h), _INK)
    draw = ImageDraw.Draw(image)

    title_font = _font(30)
    small_font = _font(15)
    label_font = _font(14)
    meta_font = _font(17)
    tiny_font = _font(12)

    draw.text((_MARGIN, 26), "ROOMSPACE  /  FINAL CONCEPT", font=small_font, fill=_BRASS)
    draw.text((_MARGIN, 52), f"{length_cm / 30.48:.0f} ft x {width_cm / 30.48:.0f} ft room", font=title_font, fill=_PAPER)
    if theme:
        draw.text((canvas_w - _MARGIN, 64), theme.upper(), font=meta_font, fill=_BRASS, anchor="ra")

    # Paper with a subtle offset "shadow", then a 50 cm grid.
    draw.rounded_rectangle(
        (_MARGIN + 7, _HEADER + 7, _MARGIN + plan_w + 7, _HEADER + plan_h + 7),
        radius=4, fill="#06111b",
    )
    draw.rectangle((_MARGIN, _HEADER, _MARGIN + plan_w, _HEADER + plan_h), fill=_PAPER)
    step = 50 * scale
    x = step
    while x < plan_w:
        draw.line((_MARGIN + x, _HEADER, _MARGIN + x, _HEADER + plan_h), fill=_GRID, width=1)
        x += step
    y = step
    while y < plan_h:
        draw.line((_MARGIN, _HEADER + y, _MARGIN + plan_w, _HEADER + y), fill=_GRID, width=1)
        y += step
    draw.rectangle((_MARGIN, _HEADER, _MARGIN + plan_w, _HEADER + plan_h), outline=_INK, width=5)

    plan_x, plan_y = _MARGIN, _HEADER

    def px(point: tuple[float, float]) -> tuple[float, float]:
        return plan_x + point[0] * scale, plan_y + point[1] * scale

    for opening in openings or []:
        shape = opening_shape(opening, length_cm, width_cm)
        # The room outline is 5px drawn inward from the edge; sit on it.
        nx, ny = INWARD_NORMAL[opening.wall]
        start = (px(shape.start)[0] + nx * 2.5, px(shape.start)[1] + ny * 2.5)
        end = (px(shape.end)[0] + nx * 2.5, px(shape.end)[1] + ny * 2.5)
        draw.line((start, end), fill=_PAPER, width=6)
        if shape.kind is OpeningKind.WINDOW:
            draw.line((start, end), fill=_WINDOW, width=4)
            continue
        hinge, leaf, free = px(shape.hinge), px(shape.leaf_end), px(shape.free_end)
        r = opening.width_cm * scale
        draw.line((hinge, leaf), fill=_DOOR, width=2)
        a_leaf = math.degrees(math.atan2(leaf[1] - hinge[1], leaf[0] - hinge[0]))
        a_free = math.degrees(math.atan2(free[1] - hinge[1], free[0] - hinge[0]))
        a0, a1 = (a_leaf, a_free) if shape.sweep_clockwise else (a_free, a_leaf)
        draw.arc((hinge[0] - r, hinge[1] - r, hinge[0] + r, hinge[1] + r), a0, a1, fill=_DOOR, width=2)

    for placement in placements:
        swapped = placement.rotation_deg in (90, 270)
        fw_cm, fd_cm = (placement.depth_cm, placement.width_cm) if swapped else (placement.width_cm, placement.depth_cm)
        x0 = plan_x + int(placement.x_cm * scale)
        y0 = plan_y + int(placement.y_cm * scale)
        w, h = int(fw_cm * scale), int(fd_cm * scale)

        # Clip to the room so an out-of-bounds item cannot paint over the header.
        clipped = (
            max(x0, plan_x), max(y0, plan_y),
            min(x0 + w, plan_x + plan_w), min(y0 + h, plan_y + plan_h),
        )
        if clipped[2] <= clipped[0] or clipped[3] <= clipped[1]:
            continue

        product = selections.get(placement.item_id)
        photo = _photo_for(product.image_url, clipped[2] - clipped[0], clipped[3] - clipped[1]) if product else None
        if photo is not None:
            washed = Image.new("RGBA", photo.size, (255, 255, 255, 55))
            photo = Image.alpha_composite(photo.convert("RGBA"), washed)
            image.paste(photo.convert("RGB"), (clipped[0], clipped[1]))
        else:
            draw.rectangle(clipped, fill="#d9d3c5")

        offending = any(placement.label in violation for violation in violations)
        draw.rectangle(clipped, outline=_RED if offending else _BRASS, width=3)

        strip_h = 25
        if clipped[3] - clipped[1] >= strip_h + 6:
            strip = (clipped[0], clipped[3] - strip_h, clipped[2], clipped[3])
            draw.rectangle(strip, fill=_INK)
            caption = f"{placement.label}"
            if product:
                caption += f"  ·  {_rupees(product.price)}"
            draw.text(
                (clipped[0] + 5, strip[1] + 5),
                _ellipsis(draw, caption, label_font, strip[2] - strip[0] - 10),
                font=label_font, fill=_PAPER,
            )

    total = sum(p.price for p in selections.values())
    chosen = len(selections)
    status = "Feasible layout" if not violations else f"{len(violations)} issue(s)"
    status_colour = _BRASS if not violations else _RED
    draw.text((_MARGIN, footer_y), f"{len(placements)} placements  ·  {chosen} products selected", font=meta_font, fill=_PAPER)
    draw.text((_MARGIN, footer_y + 28), status, font=small_font, fill=status_colour)
    disclaimer = "Photos show selected products, not a photoreal render"
    if violations:
        # Stop short of the right-aligned disclaimer on the same line.
        room_for_text = canvas_w - _MARGIN * 2 - 190 - int(draw.textlength(disclaimer, font=tiny_font)) - 24
        draw.text(
            (_MARGIN + 190, footer_y + 28),
            _ellipsis(draw, violations[0], small_font, max(room_for_text, 40)),
            font=small_font, fill=_MUTED,
        )
    budget_text = f"Total  {_rupees(total)}"
    if budget is not None:
        budget_text += f"  /  budget {_rupees(budget)}"
    draw.text((canvas_w - _MARGIN, footer_y + 4), budget_text, font=meta_font, fill=_BRASS, anchor="ra")
    draw.text(
        (canvas_w - _MARGIN, footer_y + 30),
        disclaimer,
        font=tiny_font, fill=_MUTED, anchor="ra",
    )

    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
