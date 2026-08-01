# SpecsDekh v27.2.5 — Smart Filter Engine Fix

## Production issue fixed

An exact `RAM: 4GB` filter could still show phones whose visible variant text was `6GB/8GB`. The legacy numeric helper (`ramGB`) could be stale or represent only an earlier imported value, while the human-readable variant field contained the authoritative set of variants.

## New matching rule

For RAM and storage filters:

1. If the human-readable field exists, its exact numeric tokens are authoritative.
2. The normalized numeric helper is used only when the text field is missing or blank.
3. Numeric token boundaries prevent `4GB` from matching `64GB`.

Examples for the `4GB` filter:

- `4GB` → included
- `3GB/4GB` → included
- `4GB/6GB` → included
- `6GB/8GB` → excluded
- `64GB` → excluded

## Additional safeguards

- Server-rendered listing and client API use the same shared query builder.
- Public listing cache key was bumped to prevent stale pre-fix results.
- Regression audit now verifies exact variant behavior and text-first fallback safety.
