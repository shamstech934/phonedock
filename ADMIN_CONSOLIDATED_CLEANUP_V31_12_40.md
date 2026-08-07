# SpecsDekh v31.12.40 — Consolidated Admin Cleanup

Implemented in this pass:
- PTA status is now the single editable source of truth in Phone Editor; duplicate PTA Approved checkbox removed and boolean is derived on save.
- Specs Intelligence no longer offers an actionable Apply button when there is no trusted recommendation.
- Specs Intelligence adds Select Page, Clear and bounded Bulk Dismiss (max 100) with confirmation and ActivityLog.
- Intelligence Center no longer relies only on stale DataQualityIssue signal counts for missing specs/images; it computes current Phone/PhoneSpecs/PhoneImage coverage and prevents misleading zero-health summaries.
- Existing v31.12.39 sidebar consolidation and Brands/Sponsors bulk management are preserved.
- Duplicate legacy routes remain available for backward compatibility but are not re-added to the primary sidebar.

Safety:
- No automatic destructive delete was introduced.
- Bulk intelligence dismiss is bounded to 100 IDs.
- Existing collector/product guards and price-tracker challenge protections remain intact.
