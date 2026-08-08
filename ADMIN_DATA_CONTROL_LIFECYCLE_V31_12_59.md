# SpecsDekh v31.12.59 — Admin Data Control + Lifecycle Consolidation

## Completed in this pass

- Data Quality remains the central command center and now routes Price, Specs, Images, Ratings/Benchmarks, Lifecycle and Incoming Data to the correct specialist workspace.
- Live Data Quality summary now reports lifecycle-review and rating/score coverage instead of placeholder lifecycle counts.
- Data Quality issue rows include a direct specialist-workspace action when the issue type can be routed safely.
- Launch Center was converted from a duplicate deployment/setup page into Launch & Lifecycle Intelligence. Release Readiness remains the deployment-oriented workspace.
- Lifecycle workspace supports Rumored, Announced, Coming Soon, Available, Limited, Discontinued and Cancelled states.
- Admin can move one phone or up to 100 selected phones between key lifecycle states.
- Manual lifecycle updates are locked so automation cannot overwrite an admin decision.
- Admin can unlock a phone and return it to date-driven lifecycle automation.
- Lifecycle automation normalizes upcoming flags, launches due phones and discontinues due phones while preserving locked records.
- Incoming launch candidates remain reviewable in the same lifecycle workspace and can be approved as drafts or rejected.
- Phone Data Health now evaluates lifecycle readiness from the actual availability state and relevant dates instead of only the legacy upcoming flag.
- Ratings / Benchmark Intelligence now shows catalog coverage, missing ratings, missing reviews and benchmark coverage before running deterministic editorial review generation.
- Public Upcoming Phones endpoint now exposes only published phones in genuine upcoming lifecycle states, preventing draft/review records from leaking publicly.
- Upcoming page year updated to 2026.
- Simple admin navigation exposes Lifecycle under Data & Quality; duplicate Launch Center entry was removed from the advanced Intelligence group.
- Existing Price Control, Specs Intelligence, Image Intelligence, Collector and Mobile Control functionality from previous versions is preserved.

## Safety rules

- `availabilityStatus` is the lifecycle source of truth; `upcoming` is derived for compatibility.
- Manual lifecycle locks always beat automation.
- Publication status remains separate from lifecycle status: moving a phone to Available does not auto-publish a draft.
- Incoming launch signals never publish directly; approval creates/links a draft for review.
- Data Quality detects/routes issues; specialist workspaces perform the actual domain-specific edits.

## Verification

- Targeted TypeScript/TSX transpile: PASS for 13 modified critical files.
- Static lifecycle/data-control assertions: PASS 6/6.
- Full `npm ci` / Next.js production build could not run in the ChatGPT container because its internal npm mirror returns 404 for `zod-validation-error@4.0.2`. This is an environment dependency-fetch failure, not a discovered project-code failure. Final production build must still be confirmed by Vercel/GitHub CI.
