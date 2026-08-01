# SpecsDekh v24.0.3 — Durable Regression Test Fix

## Fixed

The release gate no longer depends on the old visible label `Links & Hrefs`.
The regression test now verifies the actual stable behavior:

- Admin navigation contains `/admin/homepage-builder`.
- Homepage Builder contains the `navigation` section.
- The section is presented as `Header & links`.

This prevents harmless wording changes from breaking CI while still detecting a removed route or missing navigation editor.

## Scope

No application runtime behavior, database schema, API, or production data was changed.
