# SpecsDekh v31.10.1 — Draft / Review Inventory Fix

## Fixed
- Draft / Review card and API now use the same inventory rule.
- Supports current statuses: `draft`, `pending`, `review`.
- Supports legacy unpublished phones that only have `published: false` or no status.
- Published filter supports both `status: published` and legacy `published: true`.
- Search and status filters can coexist without overwriting each other's MongoDB `$or` clauses.
- Phone status badges no longer label records with an undefined `published` field as Published.

## Expected result
Clicking **Draft / Review** should return the same count shown on the statistics card instead of an empty list.
