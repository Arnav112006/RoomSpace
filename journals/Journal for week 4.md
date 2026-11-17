# Journal for Week 4

**Week:** 14–20 September 2026

**Goal:** Consolidate the initial architecture and decide how ML work fits the room-planning workflow.

**What I worked on:** Finalized the project workflow and backend foundation, and restructured the frontend by module while adding a dark-theme redesign. Continued room-analysis and layout-detection work. The chosen approach is pretrained YOLO for room-object detection, with fine-tuning only if needed, and CLIP for product recommendation.

**What was unclear / what I tried:** Starting custom training before the room-planning flow was stable risked spending effort on a model before its role was clear. I prioritized the core room model, layout engine, constraints, and visualization first.

**What worked / result:** The project has a clearer implementation order: build and validate the room-planning path, then evaluate whether model customization is necessary.

**Takeaway / next step:** ML choices should support a defined product workflow. Next, improve room analysis and translate detected furniture into usable placements.
