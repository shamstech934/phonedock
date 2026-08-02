# SpecsDekh v29.2.1 — Automation Status Type Fix

- Fixed the TypeScript build failure in `src/app/admin/automation/page.tsx`.
- The automation status endpoint is now parsed as `AutomationStatus`.
- The pipeline run endpoint is now parsed as `AutomationRunResult`.
- Removed unsafe assignment of a generic API payload to React state.
- Existing safe non-JSON API error handling remains enabled.
