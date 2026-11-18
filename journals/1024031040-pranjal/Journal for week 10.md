# Journal for Week 10

**Date and Context:** October 25–31, 2026 · RoomSpace · branch `main` · commit `a490392`

**Primary Objective:** Document a shared room model and make local frontend-to-backend requests work in the browser.

**Methodology and Execution:** Added `docs/room-model.md` with the coordinate system, centimetre convention, vocabulary for rooms/items/openings, and geometric rules. Added CORS middleware to allow the local Vite origins to call the FastAPI backend.

**Observations and Artifacts:** The room-model guide states that internal lengths use centimetres. The middleware change is in `backend/app/main.py`.

**Synthesis and Decisions:** A written coordinate contract helps the frontend, backend, renderer, and constraints use the same geometry. The browser also needs explicit cross-origin permission during local development.

**Code Snippet:**

~~~python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
~~~

**Next Steps:** Extend the room model with opening rules and add tests that lock down the geometry described in the documentation.
