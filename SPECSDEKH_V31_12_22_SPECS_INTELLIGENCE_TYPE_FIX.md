# SpecsDekh v31.12.22 — Specs Intelligence TypeScript Build Fix

## Fixed

- Fixed the `ScanJob | undefined` state updater type error in `src/app/admin/specs-intelligence/page.tsx`.
- The optional API response value is now narrowed once into a local `scanJob` constant before it is used inside the React state updater callback and before continuation begins.
- Preserved the bounded 25-phone scan, resumable job flow, cancellation, progress UI, and timeout-safe backend behavior from v31.12.21.

## Root cause

TypeScript does not preserve an optional-property narrowing across a nested callback. Although `if (response.scanJob)` was present, the state-updater closure still treated `response.scanJob` as `ScanJob | undefined`, while `Data.scanJob` accepts only `ScanJob | null`.

## Correct pattern

```ts
const scanJob = response.scanJob;
if (scanJob) {
  setData(current => ({ ...current, scanJob }));
  await continueUntilDone(scanJob);
}
```
