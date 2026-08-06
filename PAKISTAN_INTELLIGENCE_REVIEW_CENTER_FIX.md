# SpecsDekh v31.12.24 — Pakistan Intelligence Review Center

- Bounded scan selector: 25, 50, 100 or 150 phones; default 25.
- Signal upserts and auto-resolution updates use two bounded bulkWrite operations instead of per-signal writes.
- Retailer coverage now reports covered phones and percentage of active catalog, not only listing count.
- Open-signal cards include critical/warning split.
- Added severity filtering.
- Added expandable evidence panel with source, last detected time, current state, recommendation and evidence facts.
- Added Open phone, Source page, Link retailer, Resolve and Dismiss workflows.
- Apply remains limited to trusted price/PTA evidence with an actual source URL and recommendation.
- No automatic publishing was introduced.
