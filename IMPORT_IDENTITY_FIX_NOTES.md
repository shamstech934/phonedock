# Import Identity Fix

This release makes Import V2 conservative and variant-aware.

- Existing phones are updated only when brand and normalized model match.
- When RAM/storage is present in the CSV, the existing PhoneSpecs variant must match too.
- A missing or different existing variant no longer counts as an update match.
- New variants receive a unique slug instead of overwriting the base model.
- Without variant data, an update is allowed only when exactly one brand/model candidate exists.
- Ambiguous candidates are not silently overwritten.

Focused check: `node scripts/audit-import-identity.mjs`
