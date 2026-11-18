# Journal for Week 13

**Primary Objective:** Make layouts account for doors and windows, improve the room-input experience, and reduce duplicated application logic.

**Methodology and Execution:** Added opening schemas and constraints, renderers for room plans and concept images, a door/window editor, backend tests, and GitHub Actions checks. Redesigned the application flow, added multi-photo upload and preview, merged detections across views, and improved product imagery. Follow-up cleanup removed redundant helpers and centralized furniture defaults and synonyms.

**Observations and Artifacts:** Relevant files include `backend/app/schemas/opening.py`, `backend/app/services/constraint_engine.py`, `backend/tests/`, `.github/workflows/ci.yml`, `frontend/src/modules/room-input/RoomInputStage.tsx`, and `frontend/src/shared/lib/furniture.ts`. The test suite and CI workflow were added.

**Synthesis and Decisions:** Openings are fixed room features, not furniture. They are represented by wall, offset, and width, then checked against placements. Multi-photo detection merges repeated furniture rather than concatenating every view. Shared footprint defaults reduce inconsistent sizing across the frontend.

**Code Snippet:** The API rejects openings that do not fit the room before saving them.

~~~python
errors = constraint_engine.opening_fit_errors(openings, length_cm, width_cm)
if errors:
    raise HTTPException(status_code=422, detail=errors)
~~~

**Next Steps:** Run the configured backend and frontend checks, exercise a room containing doors and windows end to end, and record any failures with their input.
