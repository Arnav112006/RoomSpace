# Journal for Week 2

**Week:** 31 August–6 September 2026

**Goal:** Turn the proposal into an initial architecture and backend foundation.

**What I worked on:** Organized the repository into frontend, backend, ML, documentation, and supporting areas. Started the FastAPI backend and defined validated Room schemas for dimensions, room type, theme, occasion, and budget. Added room creation with UUIDs, a health check, and Swagger documentation.

**What was unclear / what I tried:** Persistence and spatial planning depend on a consistent room representation. I established and validated that representation first, so later services can build on a stable API contract.

**What worked / result:** The backend can accept a valid room request, create a uniquely identified room, and expose endpoints for inspection.

**Takeaway / next step:** Define data contracts before layering on planning logic. Next, make the planned user flow visible and investigate product data.
