# Journal for Week 10

**Primary Objective:** Document a shared room model and make local frontend-to-backend requests work in the browser.

**Problems Faced:** The frontend and backend ran on different local origins, which could cause the browser to block API requests without CORS configuration. The system also needed a shared coordinate and unit convention so the frontend, backend, renderer, and constraint checks would agree.

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
