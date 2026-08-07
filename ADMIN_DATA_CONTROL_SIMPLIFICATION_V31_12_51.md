# SpecsDekh v31.12.51 — Admin Data Control Simplification

This pass reduces admin complexity without deleting specialist intelligence capabilities.

## What changed
- Simple navigation calls Price Tracker **Price Control** and keeps Collector Workspace directly available.
- Data Quality becomes the central command center and routes each issue type to the correct specialist workspace.
- Added Fix by data area cards for Prices, Specifications, Images, Lifecycle and Incoming Data.
- Missing price/spec/image queues now open the relevant specialist tool instead of duplicating repair workflows inside Data Quality.
- Phone admin view now includes a compact Data Health strip with one-click links to Price, Specs, Images, Ratings and Lifecycle workspaces.
- Existing intelligence pages remain available in Advanced mode; functionality is consolidated through routing rather than duplicated.

## Design principle
Scan and triage in Data Quality. Perform detailed fixes in one specialist workspace. Return to the phone view for a compact health summary.
