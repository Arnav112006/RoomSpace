import { describe, expect, it } from "vitest";
import cases from "../../fixtures/constraint-cases.json";
import { openingFitErrors, validateLayoutLocal } from "@/shared/lib/constraintEngine";
import { roomDimensionsCm } from "@/shared/lib/units";
import type { Opening, Placement, RoomDimensions } from "@/shared/types";

// The Python engine is checked against the same fixture
// (backend/tests/test_constraint_fixture.py), so the two engines can't drift
// apart. Regenerate it with scripts/make_constraint_fixture.py when a rule
// changes on purpose.
interface Case {
  dims: RoomDimensions;
  openings: Opening[];
  placements: Placement[];
  expected: { feasible: boolean; violations: string[]; opening_errors: string[] };
}

describe("TypeScript constraint engine matches the Python engine", () => {
  it.each((cases as Case[]).map((c, i) => [i, c] as const))("fixture case %i", (_, c) => {
    const [lengthCm, widthCm] = roomDimensionsCm(c.dims);
    const { feasible, violations } = validateLayoutLocal(c.dims, c.placements, undefined, c.openings);
    expect({ feasible, violations, opening_errors: openingFitErrors(c.openings, lengthCm, widthCm) }).toEqual(
      c.expected
    );
  });
});
