"""The Python engine against fixtures/constraint-cases.json.

The TypeScript engine is checked against the same file
(frontend/src/shared/lib/constraintEngine.test.ts), so the two can't drift
apart. If a rule changes on purpose, regenerate the fixture with
scripts/make_constraint_fixture.py and commit it alongside the change.
"""

import json
from pathlib import Path

import pytest

from app.schemas.layout import Placement
from app.schemas.opening import Opening
from app.schemas.room import RoomDimensions
from app.services.constraint_engine import opening_fit_errors, validate_layout
from app.services.units import room_dimensions_cm

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "constraint-cases.json"
CASES = json.loads(FIXTURE.read_text())


@pytest.mark.parametrize("case", CASES, ids=[f"case{i}" for i in range(len(CASES))])
def test_engine_matches_fixture(case):
    dims = RoomDimensions(**case["dims"])
    openings = [Opening(**o) for o in case["openings"]]
    feasible, violations = validate_layout(dims, [Placement(**p) for p in case["placements"]], openings=openings)
    length_cm, width_cm = room_dimensions_cm(dims)
    assert {
        "feasible": feasible,
        "violations": violations,
        "opening_errors": opening_fit_errors(openings, length_cm, width_cm),
    } == case["expected"]
