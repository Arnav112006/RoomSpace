# Journal for Week 4

**Primary Objective:** Turn room-photo detections into useful starting points for a floor plan.

**Methodology and Execution:** Restructured the frontend into modules and introduced a dark theme. Improved YOLO-based furniture analysis, estimated furniture dimensions from known room dimensions, added an endpoint that turns detections into a rough layout, introduced zone placement, and added a live backend demo.

**Observations and Artifacts:** The relevant code is in `backend/app/services/room_analysis.py`, `backend/app/services/zone_placement.py`, `backend/app/api/rooms.py`, and `backend/app/static/demo.html`. Zone placement maps detections to approximate coordinates; it does not optimize the layout.

**Synthesis and Decisions:** A detected object is not yet a usable plan. Bounding-box estimates need room dimensions as a scale reference, while implausibly small estimates need a type-based fallback. The resulting plan is passed to the constraint engine so conflicts can be reported rather than hidden.

**Code Snippet:**

~~~python
estimated_w = box_width_frac * room_length_cm
estimated_d = box_height_frac * room_width_cm

if estimated_w < _MIN_PLAUSIBLE_DIMENSION_CM or estimated_d < _MIN_PLAUSIBLE_DIMENSION_CM:
    return default_w, default_d
~~~

**Next Steps:** Define one room coordinate and unit convention, then make layout validation account for fixed room features such as openings.
