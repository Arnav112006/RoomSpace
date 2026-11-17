# Journal for Week 7

**Week:** 19–25 October 2026

**Goal:** Represent furniture placements in a way the layout workflow can use.

**What I worked on:** Introduced a zone-placement service that maps detected furniture to placements within room zones.

**What was unclear / what I tried:** Raw detections needed to become structured placements before they could be used by layout generation. The placement service provides that translation.

**What worked / result:** Detected furniture can now be represented as placements associated with room zones.

**Takeaway / next step:** Separating detection from placement keeps the workflow easier to reason about. Next, make the backend flow easier to explore in a demonstration.
