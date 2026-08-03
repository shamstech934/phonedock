# SpecsDekh v31.11.1 — PhoneJson Type Fix

Fixed the TypeScript build failure in `src/app/api/[[...path]]/handlers/helpers.ts`.

## Root cause
`phoneToJSON()` returned `brandName` and `model`, but the `PhoneJson` interface did not declare those properties.

## Fix
Added optional compatibility fields:

- `brandName?: string`
- `model?: string`

No runtime behavior was changed.
