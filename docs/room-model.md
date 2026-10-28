# RoomSpace Room Model — Coordinate System & Vocabulary

**Status:** agreed v1 (Step 1) · **schema_version:** 1
**Last updated:** 2026-10-28

This is the one-page agreement for how a room is described inside RoomSpace.
Tests, schemas, the constraint engine and the UI all point at this document.
If code and this document disagree, the document wins until we consciously
change it here first.

Covers Stage 3 of the workflow ("Room Model Creation"): turning room
dimensions plus verified objects into a structured representation the layout
engine can work from.

---

## 1. Units

**Centimetres, everywhere, internally.** Every stored length — room
dimensions, item footprints, opening widths, offsets, clearance thresholds —
is in centimetres.

Feet and metres exist only at the edges:

| Unit | Conversion |
|---|---|
| `cm` | × 1 |
| `m`  | × 100 |
| `ft` | × 30.48 |

Conversion happens when a value enters the system (user input) and when it is
displayed. Nothing downstream ever converts again. This matches
`backend/app/services/units.py` and `frontend/src/lib/units.ts`.

---

## 2. Coordinate system

- **Origin** is the **top-left (north-west) corner** of the room.
- **`+x`** runs **east** along the room's **length**.
- **`+y`** runs **south** along the room's **width**.
- Units are centimetres (section 1).

```
              north  (y = 0)
        (0,0) +--------------------------+ (length, 0)
              |                          |
     west     |          room            |     east
   (x = 0)    |                          |   (x = length)
              |                          |
              +--------------------------+ (length, width)
              south  (y = width)
```

| Wall     | Condition                  | Runs from → to            |
|----------|----------------------------|---------------------------|
| `north`  | `y = 0`                    | west → east               |
| `south`  | `y = width`                | west → east               |
| `west`   | `x = 0`                    | north → south             |
| `east`   | `x = length`               | north → south             |

**Why top-left and `+y` downward:** the SVG renderer and both existing
bounding-box implementations (`_bbox` in `constraint_engine.py`,
`bbox` in `constraintEngine.ts`) already assume a y-down, origin-at-top-left
space. Choosing anything else would force y-axis flips in three places.

### Rotation

A placement rotates around its **`(x_cm, y_cm)` corner**. Width and depth swap
at 90° and 270°. Only `0`, `90`, `180`, `270` are valid.

> **Known inconsistency:** `frontend/src/lib/layoutEngine.ts` currently swaps
> the footprint in the `symmetric` strategy without setting
> `rotation_deg: 90`. The rule above is the intended behaviour; the generator
> is to be fixed in Step 5, and covered by a test in Step 3.

---

## 3. Vocabulary

| Term | Meaning |
|---|---|
| **Room** | A rectangle defined by `length` × `width`, plus its openings and items. |
| **Wall** | One of the four sides of the room rectangle. Identified by `north`, `south`, `east`, `west`. |
| **Opening** | A fixed hole in a wall. Either a `door` or a `window`. Never moves. |
| **Item** | Furniture. Movable unless marked `is_fixed`. |
| **Fixed item** | Furniture the generator must not move (e.g. a built-in wardrobe). |
| **Placement** | An item's resolved position in one specific layout candidate. |
| **Violation** | A human-readable reason a layout is not physically feasible. |

**Openings are not items.** A door is not a chair. It is never moved by the
layout engine, never scored, and never recommended as a product. `openings[]`
and `items[]` are separate collections in the room model.

---

## 4. Openings

An opening is stored as **wall + offset + width**, never as a raw `(x, y)`
pair. Its position on the floor plan is derived from those three values.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable identifier |
| `kind` | `"door"` \| `"window"` | |
| `wall` | `"north"` \| `"south"` \| `"east"` \| `"west"` | |
| `offset_cm` | float ≥ 0 | Distance from the wall's anchor end (see below) |
| `width_cm` | float > 0 | The opening's own width |
| `hinge` | `"start"` \| `"end"` \| null | Doors only |
| `swing` | `"inward"` \| `"outward"` \| null | Doors only; v1 is `inward` |

### Offset convention

Offsets are always measured **in the wall's own direction of travel**:

- **North / south walls** travel west → east, so `offset_cm` is measured
  **from the west end**.
- **East / west walls** travel north → south, so `offset_cm` is measured
  **from the north end**.

```
north / south wall:

  west ├──────── offset_cm ────────┤[ opening ]────────────┤ east

east / west wall:

  north
        ├──────── offset_cm ────────┤
        │      [ opening ]
        │
  south
```

This is the single most common source of disagreement. Do not measure from
the nearest corner, and do not measure clockwise — use the rule above.

---

## 5. Door swing

A door's swing area is a **quarter-disc** of radius equal to the door's
`width_cm`, anchored at the hinge.

- `hinge: "start"` — hinge at the lower-coordinate end of the opening
  (west end on north/south walls, north end on east/west walls).
- `hinge: "end"` — hinge at the opposite end.
- `swing: "inward"` — the door opens into the room, so the quarter-disc is
  inside the room and furniture must stay out of it.
- `swing: "outward"` — opens away from the room; it does not intrude, so it
  creates no clearance rule.

**v1 supports inward-swinging hinged doors only.**

---

## 6. Window obstruction rule

Windows do not swing, so "unobstructed" has to be defined as a number rather
than a judgement call. **Every threshold is a named constant, not an inline
value.**

> A window counts as blocked when an item's back edge is within
> `WINDOW_BACK_GAP_CM` (30 cm) of the wall **and** the item covers at least
> `WINDOW_BLOCK_RATIO` (80%) of the window's width.

Partial coverage below that ratio is allowed — furniture can sit under a
window, it just can't wall it off.

---

## 7. Constants

| Constant | Value | Where it belongs |
|---|---|---|
| `MIN_CLEARANCE_CM` | 75 | Walkway gap between two items |
| `WALL_MARGIN_CM` | 10 | Gap between an item and a wall |
| `WINDOW_BACK_GAP_CM` | 30 | See section 6 |
| `WINDOW_BLOCK_RATIO` | 0.80 | See section 6 |
| `EPSILON_CM` | 1e-6 | Float comparison tolerance for all geometry |

Rule: **one rule, one function, one test.** Each of these gets its own
assertion in `backend/tests/`.

---

## 8. The demo room

Every test fixture and every demo uses this room until Step 7. Do not change
it partway through.

| Property | Value |
|---|---|
| Dimensions | 12 ft × 10 ft (365.76 cm × 304.80 cm) |
| Wall | interior rectangle, origin at north-west |
| Door | `south` wall, `offset_cm` = 60, `width_cm` = 90, hinge `start`, swing `inward` |
| Window | `east` wall, `offset_cm` = 80, `width_cm` = 120 |

The canonical failing scenario: a wardrobe placed in the door's swing area.
The canonical passing scenario: the same wardrobe moved clear.

---

## 9. Schema sketch

```python
class OpeningKind(str, Enum):
    DOOR = "door"
    WINDOW = "window"

class WallSide(str, Enum):
    NORTH = "north"
    SOUTH = "south"
    EAST = "east"
    WEST = "west"

class Opening(BaseModel):
    id: str
    kind: OpeningKind
    wall: WallSide
    offset_cm: float          # >= 0, measured per section 4
    width_cm: float           # > 0
    hinge: Literal["start", "end"] | None = None   # doors only
    swing: Literal["inward", "outward"] | None = None  # doors only

class RoomModel(BaseModel):
    schema_version: int = 1
    dimensions: RoomDimensions
    openings: list[Opening] = []
    items: list[FurnitureItem] = []
```

This is a sketch for agreement, not final code. The concrete schema lands in
Step 2/3. `schema_version` exists so fixtures can be regenerated deliberately
if the model changes.

---

## 10. Out of scope for v1

Deliberately excluded, so nobody assumes they are covered:

- L-shaped and non-rectangular rooms
- Outward-swinging doors (modelled, but no clearance rule)
- Sliding doors, bi-fold doors, archways
- Detecting doors/windows from photos (YOLO's COCO classes have none — users
  add them by hand)
- Ceiling height, window sills, and any 3D/vertical reasoning
- Furniture heights and stacking

---

## 11. Decisions (confirmed 2026-10-28)

Both were settled before any code depended on them.

1. **`door` and `window` are removed from `FurnitureType`.** An opening is not
   furniture: it never moves, is never scored, and is never recommended. This
   closes the old failure mode where a detected object could be retyped as a
   door and then placed and moved like a chair.
   Files touched: `backend/app/schemas/furniture.py`,
   `frontend/src/types.ts`,
   `frontend/src/components/stages/AnalysisStage.tsx`,
   `frontend/src/lib/commandParser.ts`.
   Step 4 adds a first-class openings editor in their place.

2. **Window thresholds confirmed: `WINDOW_BACK_GAP_CM = 30` and
   `WINDOW_BLOCK_RATIO = 0.80`.** Both are single constants, so they can be
   tuned cheaply once the Step 3 tests exist.

---

## 12. Changelog

| schema_version | Date | Change |
|---|---|---|
| 1 | 2026-10-28 | Initial agreement: units, coordinate system, openings, constants, demo room |
| 1 | 2026-10-28 | Section 11 decisions confirmed: openings removed from `FurnitureType`; window thresholds approved |
