# RoomSpace

[![CI](https://github.com/Arnav112006/RoomSpace/actions/workflows/ci.yml/badge.svg)](https://github.com/Arnav112006/RoomSpace/actions/workflows/ci.yml)

Constraint-based room planning. Enter a room's dimensions (and optionally a
photo), get furniture layouts that are checked to fit — inside the walls, no
overlaps, enough walking space — refine them with text commands, and match the
chosen layout to products within budget.

- **Frontend:** React + Vite + Zustand + Tailwind (`frontend/`)
- **Backend:** FastAPI + Pydantic (`backend/`)
- **Vision / matching (optional, local):** YOLOv8 for furniture detection, CLIP for style matching

Room coordinates, units and constants are defined in
[`docs/room-model.md`](docs/room-model.md). The proposal is in
[`project-proposal/`](project-proposal/).

## Run it

Backend (core API only):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # add requirements-ml.txt for photo detection + CLIP
uvicorn app.main:app --reload            # http://localhost:8000, API docs at /docs
```

Frontend:

```bash
cd frontend
npm install
npm run dev                              # http://localhost:5173
```

Set `VITE_API_BASE_URL` in `frontend/.env` if the API is not on `localhost:8000`.

## Dependencies

| File | Contents |
|---|---|
| `backend/requirements.txt` | API server: FastAPI, Pydantic, Pillow |
| `backend/requirements-ml.txt` | + ultralytics (YOLO), torch, transformers (CLIP) |
| `backend/requirements-dev.txt` | + pytest, httpx, ruff — what CI installs |

## Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest                                   # geometry, units, renderers, API
ruff check app tests
```

The constraint-engine suite includes a set of known valid and invalid
layouts for the demo room; the proposal's primary metric (every layout shown
as feasible passes every hard constraint) is enforced there.

CI (`.github/workflows/ci.yml`) runs the backend tests and lint plus the
frontend lint and build on every push and pull request.
