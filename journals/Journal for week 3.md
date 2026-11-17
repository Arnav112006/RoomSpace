# Journal for Week 3

**Week:** 7–13 September 2026

**Goal:** Make the project flow demonstrable and start connecting room understanding with recommendations.

**What I worked on:** Added the initial Vite, React, TypeScript, and Tailwind frontend. Implemented room analysis and furniture detection using pretrained YOLOv8, added layout and placement schemas and room-management/validation features, and started zero-shot product-to-style matching with pretrained CLIP. The frontend uses local fallback data where backend integration is not yet reliable.

**What was unclear / what I tried:** Frontend integration and product-data preparation were not ready to support every part of the demo. I used local fallback data to keep the user flow moving, while identifying useful product attributes such as category, style, dimensions, and price.

**What worked / result:** The initial frontend and backend capabilities can be demonstrated while the product data pipeline is still being prepared. Pretrained models provide a starting point without requiring custom training immediately.

**Takeaway / next step:** Keep interfaces usable while integrations mature, and defer fine-tuning until the core workflow shows where it is needed. Next, improve analysis and connect detected objects to practical room placements.
