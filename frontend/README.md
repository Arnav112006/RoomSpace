# RoomSpace — Frontend

A Vite + React + TypeScript + Tailwind frontend for RoomSpace, built against
the FastAPI backend in `backend/app`. Visual identity is a dark "drafting
studio at night" theme — a glowing blueprint grid, layered near-black
panels, and warm brass accents — rather than a generic SaaS look. See
`tailwind.config.js` and `src/index.css` for the tokens.

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
Studio" module rather than as separate pages:

| Screen | Diagram stages | Module |
|---|---|---|
| Room Input | 1 | `modules/room-input` |
| Analysis & Verification | 2 | `modules/analysis` |
| Room Model | 3 | `modules/room-model` |
| Design Studio | 4–11 | `modules/studio` |
| Recommendations | 12 | `modules/recommendations` |

The left-hand `StageRail` (in `shared/layout`) still shows all 12 numbered
stages, matching the diagram, and highlights which screen/stage you're
currently on.

## Project layout — module-wise

Code is organized by feature module, not by file type, with a `shared/`
layer underneath for anything more than one module needs. Imports use the
`@/` path alias (`@/shared/...`, `@/modules/...`) instead of long relative
paths — configured in `vite.config.ts` and `tsconfig.app.json`.

```
src/
  shared/
    types.ts              # mirrors backend/app/schemas/*.py
    lib/
      api.ts               # typed fetch client for the FastAPI backend
      units.ts              # mirrors backend/app/services/units.py
      constraintEngine.ts    # mirrors backend/app/services/constraint_engine.py
      layoutEngine.ts         # stage 4 generation + stage 6/7 scoring/ranking
      commandParser.ts         # stage 9 rule-based NLP
      catalog.ts                # stage 12 mock catalog + style scoring
    store/roomStore.ts     # single Zustand store for the whole workflow
    layout/                # Header, StageRail (used on every screen)
    ui/Primitives.tsx     # Card, Field, Badge, EmptyState, Spinner
  modules/
    room-input/RoomInputStage.tsx       # stage 1
    analysis/AnalysisStage.tsx           # stage 2
    room-model/RoomModelStage.tsx         # stage 3
    studio/                                # stages 4-11
      StudioLayout.tsx
      CandidatePanel.tsx
      FloorPlanCanvas.tsx
      CommandBar.tsx
      VersionHistory.tsx
    recommendations/RecommendationsStage.tsx  # stage 12
  App.tsx
  main.tsx
  index.css
```

A module only imports from `shared/` or from itself — never reaches into
another module's folder — so each one could be lifted into its own package
later without much untangling.

## What talks to the real backend vs. what's a client-side stand-in

The backend currently implements room creation, photo-based furniture
detection, and layout constraint validation. Everything else in the 12-stage
design (candidate generation, scoring/ranking, the command parser, product
recommendation) doesn't have an API route yet, so the frontend runs a
client-side equivalent that's written to be swapped for a real endpoint
later without changing any UI code.

**Real API calls** (`shared/lib/api.ts`):
- `POST /api/rooms` — create a room
- `POST /api/rooms/{id}/photo` — YOLO furniture detection
- `POST /api/rooms/{id}/validate-layout` — hard constraint validation (stages 5 & 10)

**Client-side stand-ins** (same shapes as the backend schemas, so swapping
later is a data-source change, not a UI change):
- `shared/lib/layoutEngine.ts` — stage 4 candidate generation (four named
  placement strategies: wall-hug, zoned, symmetric, corner-focused) and
  stage 6/7 aesthetic scoring + ranking
- `shared/lib/commandParser.ts` — stage 9 rule-based command parser (verb +
  synonym + pattern matching, no external LLM call, matching the project's
  own design goal)
- `shared/lib/catalog.ts` — stage 12 mock product catalog and a CLIP-style
  compatibility score stand-in for `ml/clip_matching/zero_shot.py`
- Stage 11 versioning lives in the Zustand store (`shared/store/roomStore.ts`)
  and isn't persisted to a backend yet

If the backend is unreachable, the header shows "api offline — using local
fallback" and layout validation falls back to
`shared/lib/constraintEngine.ts`, a JS port of
`backend/app/services/constraint_engine.py`, so the app still works end to
end for demos without the FastAPI process running.

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

