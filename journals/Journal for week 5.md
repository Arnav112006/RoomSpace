# Journal for Week 5

**Week:** 5–11 October 2026

**Goal:** Make detected furniture useful for planning by estimating its size in the room.

**What I worked on:** Improved room analysis to estimate furniture dimensions relative to the known room size and added a local YOLOv8 model for detecting objects in room images.

**What was unclear / what I tried:** Detection identifies objects but does not provide enough information to plan around them. Using the known room size gives the analysis a reference for estimating furniture dimensions.

**What worked / result:** The analysis now provides object detections and estimated dimensions that can feed later layout work.

**Takeaway / next step:** Detection needs room-scale context to support placement. Next, connect the analysis output to a generated room layout.
