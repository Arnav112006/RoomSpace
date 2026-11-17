import re
from io import BytesIO
from pathlib import Path

from PIL import Image

from app.schemas.concept import ConceptProduct
from app.schemas.opening import Opening
from app.services import concept_renderer
from app.services.constraint_engine import validate_layout
from app.services.layout_renderer import opening_shape, render_layout_svg
from tests.conftest import DEMO_LENGTH_CM, DEMO_WIDTH_CM
from tests.conftest import make_placement as P

REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG_TS = REPO_ROOT / "frontend" / "src" / "shared" / "lib" / "catalog.ts"


# --- SVG floor plan ------------------------------------------------------

def test_svg_shows_items_and_feasible_status(demo_dims):
    svg = render_layout_svg(demo_dims, [P("Bed", x=10, y=10, w=150, d=200)], [])
    assert svg.startswith("<svg") and svg.endswith("</svg>")
    assert ">Bed<" in svg
    assert "Feasible" in svg


def test_svg_lists_violations_and_marks_items_red(demo_dims):
    layout = [P("Bed", x=10, y=10, w=150, d=200), P("Desk", x=100, y=100, w=120, d=60)]
    _, violations = validate_layout(demo_dims, layout)
    svg = render_layout_svg(demo_dims, layout, violations)
    assert "Violations:" in svg
    assert "Bed overlaps with Desk" in svg
    assert svg.count('stroke="#c0392b"') == 2


# --- PNG concept sheet ---------------------------------------------------

def _product(image_url: str, price: float = 10000) -> ConceptProduct:
    return ConceptProduct(id="p", name="Thing", image_url=image_url, price=price, width_cm=150, depth_cm=200)


def test_concept_image_is_a_png(demo_dims):
    png = concept_renderer.render_concept_image(
        demo_dims,
        [P("Bed", x=10, y=10, w=150, d=200, item_id="bed")],
        {"bed": _product("bed-scandi")},
        theme="scandinavian",
        budget=50000,
    )
    image = Image.open(BytesIO(png))
    assert image.format == "PNG"
    assert image.width > 0 and image.height > 0


def test_concept_image_survives_missing_photo_and_out_of_room_item(demo_dims):
    png = concept_renderer.render_concept_image(
        demo_dims,
        [P("Bed", x=10, y=10, w=150, d=200, item_id="bed"), P("Ghost", x=2000, y=2000)],
        {"bed": _product("no-such-photo")},
        violations=["Ghost extends outside the room boundary"],
    )
    assert png.startswith(b"\x89PNG")


def test_photo_lookup_rejects_path_traversal():
    assert concept_renderer._photo_for("../../main", 100, 100) is None
    assert concept_renderer._photo_for("bed-scandi/../x", 100, 100) is None


def test_photo_lookup_finds_bundled_photo():
    photo = concept_renderer._photo_for("bed-scandi", 120, 80)
    assert photo is not None and photo.size == (120, 80)


def test_every_frontend_catalog_product_has_a_bundled_photo():
    # The concept renderer resolves catalog image_url keys against
    # app/static/products. Keep the two in sync.
    keys = re.findall(r'image_url:\s*"([^"]+)"', CATALOG_TS.read_text())
    assert keys, "no image_url entries found in catalog.ts"
    missing = [k for k in keys if not (concept_renderer._PRODUCT_DIR / f"{k}.jpg").is_file()]
    assert missing == []


# --- doors and windows ---------------------------------------------------

DEMO_DOOR = Opening(id="d", kind="door", wall="south", offset_cm=60, width_cm=90)
DEMO_WINDOW = Opening(id="w", kind="window", wall="east", offset_cm=80, width_cm=120)


def test_door_shape_on_south_wall():
    shape = opening_shape(DEMO_DOOR, DEMO_LENGTH_CM, DEMO_WIDTH_CM)
    assert shape.hinge == (60, DEMO_WIDTH_CM)
    assert shape.free_end == (150, DEMO_WIDTH_CM)
    # Inward from the south wall means up the page (smaller y).
    assert shape.leaf_end == (60, DEMO_WIDTH_CM - 90)


def test_outward_door_leaf_points_out_of_the_room():
    shape = opening_shape(DEMO_DOOR.model_copy(update={"swing": "outward"}), DEMO_LENGTH_CM, DEMO_WIDTH_CM)
    assert shape.leaf_end[1] > DEMO_WIDTH_CM


def test_window_shape_on_east_wall():
    shape = opening_shape(DEMO_WINDOW, DEMO_LENGTH_CM, DEMO_WIDTH_CM)
    assert (shape.start, shape.end) == ((DEMO_LENGTH_CM, 80), (DEMO_LENGTH_CM, 200))
    assert shape.hinge is None


def test_svg_draws_doors_and_windows(demo_dims):
    svg = render_layout_svg(demo_dims, [], [], [DEMO_DOOR, DEMO_WINDOW])
    assert svg.count('data-opening="door"') == 1
    assert svg.count('data-opening="window"') == 1


def test_concept_image_with_openings_is_a_png(demo_dims):
    png = concept_renderer.render_concept_image(demo_dims, [], {}, openings=[DEMO_DOOR, DEMO_WINDOW])
    assert png.startswith(b"\x89PNG")
