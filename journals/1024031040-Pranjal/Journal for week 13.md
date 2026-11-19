# Journal for Week 13

**Primary Objective:** Make room layouts respect doors and windows, improve the room-input experience, and extend RoomSpace with feasible layout generation, themed 3D views, photo-based style suggestions, and more flexible commands.

**Problems Faced:** The layout generator had to fit furniture while respecting room boundaries, clearances, doors, and windows. Multiple room photos could also produce duplicate detections, while theme suggestions and free-form commands could be uncertain. The system therefore needed to validate generated and modified layouts and add shared test cases for its constraints.

**Methodology and Execution:** Added opening schemas and constraints, renderers for room plans and concept images, a door/window editor, and continuous integration. Redesigned the application flow, added multi-photo upload and preview, merged repeated detections across photos, and improved product imagery. Added four constraint-aware layout strategies, three.js room views with theme-specific furniture and decor, zero-shot CLIP style suggestions with room-colour analysis, and rule-based plus semantic command interpretation. Semantic matches are re-parsed by the rule system before they are applied.

**Observations and Artifacts:** Key artifacts include `frontend/src/shared/lib/layoutEngine.ts`, `frontend/src/shared/lib/room3d/`, `backend/app/services/style_suggestion.py`, `backend/app/services/command_matching.py`, `backend/app/api/commands.py`, and `fixtures/constraint-cases.json`. It adds a shared 400-case constraint fixture, 509 frontend tests, and 546 backend tests. Its commit message reports 32/32 feasible demo layouts and a change from 48.8% to 84.8% valid layouts in its random-room benchmark.

**Synthesis and Decisions:** Candidate generation now checks placements against the same room constraints used by validation and passes room openings into the search. The 3D view decorates the checked layout while preserving furniture footprints. CLIP suggests themes from room photos, while rule-based commands remain the final authority for changes inferred from free-form text.

**Code Snippet:** Each generated style gets a candidate that is validated against clearances and openings before it is returned.

~~~typescript
const styles: LayoutStyle[] = ["wall-hug", "zoned", "symmetric", "corner-focused"];

return styles.map((style) => {
  const placements = bestCandidate(items, dimensions, style, openings);
  const { feasible, violations } = validateLayoutLocal(
    dimensions, placements, MIN_CLEARANCE_CM, openings
  );
  return {
    style,
    layout: { id: `${roomId}-${style}`, room_id: roomId, placements, feasible, violations },
  };
});
~~~

**Next Steps:** Run the configured backend and frontend checks, exercise layout generation with rooms that contain doors and windows, and inspect style suggestions and natural-language commands against representative room photos and user requests.
