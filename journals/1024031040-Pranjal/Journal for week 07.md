# Journal for Week 7

**Problems Faced:** The furniture-sizing approach relies on room dimensions and how much of the room is visible in a photo. As a result, estimated sizes are only starting points and may need user correction.

**Methodology and Execution:** The sizing code is present in `backend/app/services/room_analysis.py` and is included with the room-analysis change `dffe76f`.

**Observations and Artifacts:** The sizing approach uses known room dimensions and defaults when the estimate is implausibly small. The existing source supports the feature.
