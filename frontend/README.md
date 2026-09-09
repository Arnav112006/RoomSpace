# RoomSpace — Frontend

A Vite + React + TypeScript + Tailwind frontend for RoomSpace, built against
the FastAPI backend in `backend/app`. Visual identity is a "drafting studio"
theme (blueprint grid, ink/paper/brass palette) rather than a generic SaaS
look — see `tailwind.config.js` and `src/index.css` for the tokens.

## Setup

```bash
npm install
cp .env.example .env      # point at your backend if it's not on :8000
npm run dev
```

In another terminal, run the backend:

```bash
cd ../backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Build for production with `npm run build` (runs `tsc -b && vite build`,
output in `dist/`).

## How the 12 stages map to screens

The workflow diagram's 12 stages become 5 screens. Stages 4–11 are one
continuous loop in practice (generate → validate → score → rank → visualize →
command → re-validate → version), so they live together in one "Design
Studio" view rather than as separate pages:

| Screen | Diagram stages | Component |
|---|---|---|
| Room Input | 1 | `components/stages/RoomInputStage.tsx` |
| Analysis & Verification | 2 | `components/stages/AnalysisStage.tsx` |
| Room Model | 3 | `components/stages/RoomModelStage.tsx` |
| Design Studio | 4–11 | `components/studio/*` |
| Recommendations | 12 | `components/stages/RecommendationsStage.tsx` |

The left-hand `StageRail` still shows all 12 numbered stages, matching the
diagram, and highlights which screen/stage you're currently on.

## What talks to the real backend vs. what's a client-side stand-in

The backend currently implements room creation, photo-based furniture
detection, and layout constraint validation. Everything else in the 12-stage
design (candidate generation, scoring/ranking, the command parser, product
recommendation) doesn't have an API route yet, so the frontend runs a
client-side equivalent that's written to be swapped for a real endpoint
later without changing any UI code.

**Real API calls** (`src/lib/api.ts`):
- `POST /api/rooms` — create a room
- `POST /api/rooms/{id}/photo` — YOLO furniture detection
- `POST /api/rooms/{id}/validate-layout` — hard constraint validation (stages 5 & 10)

**Client-side stand-ins** (same shapes as the backend schemas, so swapping
later is a data-source change, not a UI change):
- `src/lib/layoutEngine.ts` — stage 4 candidate generation (four named
  placement strategies: wall-hug, zoned, symmetric, corner-focused) and
  stage 6/7 aesthetic scoring + ranking
- `src/lib/commandParser.ts` — stage 9 rule-based command parser (verb +
  synonym + pattern matching, no external LLM call, matching the project's
  own design goal)
- `src/lib/catalog.ts` — stage 12 mock product catalog and a CLIP-style
  compatibility score stand-in for `ml/clip_matching/zero_shot.py`
- Stage 11 versioning lives in the Zustand store (`src/store/roomStore.ts`)
  and isn't persisted to a backend yet

If the backend is unreachable, the header shows "api offline — using local
fallback" and layout validation falls back to
`src/lib/constraintEngine.ts`, a JS port of
`backend/app/services/constraint_engine.py`, so the app still works end to
end for demos without the FastAPI process running.

## Project layout

```
src/
  types.ts              # mirrors backend/app/schemas/*.py
  lib/
    api.ts               # typed fetch client for the FastAPI backend
    units.ts              # mirrors backend/app/services/units.py
    constraintEngine.ts    # mirrors backend/app/services/constraint_engine.py
    layoutEngine.ts         # stage 4 generation + stage 6/7 scoring/ranking
    commandParser.ts         # stage 9 rule-based NLP
    catalog.ts                # stage 12 mock catalog + style scoring
  store/roomStore.ts     # single Zustand store for the whole workflow
  components/
    layout/              # Header, StageRail
    stages/               # Stage 1, 2, 3, 12 screens
    studio/                # Stages 4-11: CandidatePanel, FloorPlanCanvas,
                            # CommandBar, VersionHistory, StudioLayout
    ui/Primitives.tsx     # Card, Field, Badge, etc.
```

## Known gaps / next steps

- No `PUT /api/rooms/{id}` yet to persist verified furniture back to the
  backend — the verified list currently only lives in frontend state for
  the rest of the session.
- No backend route for candidate generation, scoring, commands, versions,
  or recommendations — see "client-side stand-ins" above.
- Door/window swing clearance isn't modeled (matches a documented gap in
  `constraint_engine.py`).
- `FloorPlanCanvas.tsx` renders its own interactive SVG rather than the
  backend's static SVG string, so drag-to-move and pan/zoom work; it
  mirrors the backend's violation-highlighting color logic by convention,
  not by parsing the returned SVG.
