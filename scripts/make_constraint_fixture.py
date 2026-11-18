"""Regenerates fixtures/constraint-cases.json.

The fixture holds random rooms, openings and layouts together with what the
Python constraint engine says about them. Both test suites check against it:

- backend/tests/test_constraint_fixture.py  (Python engine)
- frontend/src/shared/lib/constraintEngine.test.ts  (TypeScript engine)

so the two engines can't drift apart without CI failing. Only rerun this
when a rule changes on purpose, and commit the new fixture with that change:

    cd backend && python ../scripts/make_constraint_fixture.py
"""

import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.schemas.layout import Placement  # noqa: E402
from app.schemas.opening import Opening  # noqa: E402
from app.schemas.room import RoomDimensions  # noqa: E402
from app.services.constraint_engine import opening_fit_errors, validate_layout  # noqa: E402
from app.services.units import room_dimensions_cm  # noqa: E402

CASES = 400
OUT = ROOT / "fixtures" / "constraint-cases.json"


def random_case(rng: random.Random) -> dict:
    unit = rng.choice(["ft", "ft", "m", "cm"])
    if unit == "ft":
        length, width = rng.choice([10, 12, 15]), rng.choice([9, 10, 12])
    elif unit == "m":
        length, width = rng.choice([3, 3.5, 4.2]), rng.choice([2.8, 3, 3.6])
    else:
        length, width = rng.choice([300, 365.76, 420]), rng.choice([280, 304.8, 330])
    dims = {"length": length, "width": width, "unit": unit}
    length_cm, width_cm = room_dimensions_cm(RoomDimensions(**dims))

    openings = []
    for i in range(rng.randint(0, 3)):
        wall = rng.choice(["north", "south", "east", "west"])
        span = length_cm if wall in ("north", "south") else width_cm
        w = rng.choice([60, 80, 90, 120, 150])
        opening = {
            "id": f"o{i}",
            "kind": rng.choice(["door", "window"]),
            "wall": wall,
            "offset_cm": round(rng.uniform(0, max(0, span - w)), 1),
            "width_cm": w,
        }
        if opening["kind"] == "door":
            opening["hinge"] = rng.choice(["start", "end"])
            opening["swing"] = rng.choice(["inward", "inward", "outward"])
        openings.append(opening)

    placements = [
        {
            "item_id": f"p{i}",
            "label": f"Item{i}",
            "x_cm": round(rng.uniform(-20, length_cm), 1),
            "y_cm": round(rng.uniform(-20, width_cm), 1),
            "width_cm": rng.choice([30, 45, 60, 90, 120, 150, 200]),
            "depth_cm": rng.choice([30, 45, 60, 90, 200]),
            "rotation_deg": rng.choice([0, 90, 180, 270]),
        }
        for i in range(rng.randint(0, 5))
    ]

    parsed_openings = [Opening(**o) for o in openings]
    feasible, violations = validate_layout(
        RoomDimensions(**dims), [Placement(**p) for p in placements], openings=parsed_openings
    )
    return {
        "dims": dims,
        "openings": openings,
        "placements": placements,
        "expected": {
            "feasible": feasible,
            "violations": violations,
            "opening_errors": opening_fit_errors(parsed_openings, length_cm, width_cm),
        },
    }


def main() -> None:
    rng = random.Random(20261118)
    cases = [random_case(rng) for _ in range(CASES)]
    OUT.parent.mkdir(exist_ok=True)
    # One case per line: compact, and diffs stay readable when a rule changes.
    lines = ",\n".join(json.dumps(c, separators=(",", ":")) for c in cases)
    OUT.write_text(f"[\n{lines}\n]\n")
    door = sum("door" in v for c in cases for v in c["expected"]["violations"])
    window = sum("window" in v for c in cases for v in c["expected"]["violations"])
    print(f"wrote {len(cases)} cases to {OUT.relative_to(ROOT)} ({door} door, {window} window violations)")


if __name__ == "__main__":
    main()
