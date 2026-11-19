# Journal for Week 3

**Primary Objective:** Make the initial room-planning workflow demonstrable and connect room understanding to product recommendations.

**Problems Faced:** The frontend, backend, and machine-learning components were being developed together, so integration was not yet reliable. Furniture detection and product-style matching also depended on model outputs that needed to be translated into data the application could use.

**Methodology and Execution:** Added layout and placement schemas, room management and validation, furniture detection with pretrained YOLOv8, a React/TypeScript/Tailwind frontend. The frontend included fallback data so its workflow could be explored while API integration developed.

**Observations and Artifacts:** The commits add `backend/app/services/room_analysis.py`, `ml/clip_matching/zero_shot.py`, and the initial frontend.

**Synthesis and Decisions:** Pretrained models made it possible to build a first pass without custom training.

**Code Snippet:** Product images and style text are embedded and ranked by cosine similarity.

~~~python
text_embeds = outputs.text_embeds
image_embeds = outputs.image_embeds
text_embeds = text_embeds / text_embeds.norm(dim=-1, keepdim=True)
image_embeds = image_embeds / image_embeds.norm(dim=-1, keepdim=True)
similarities = (image_embeds @ text_embeds.T).squeeze(-1)
~~~

**Next Steps:** Connect detections to a usable floor plan and refine the frontend flow as the backend integration matures.
