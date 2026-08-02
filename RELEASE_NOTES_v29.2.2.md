# SpecsDekh v29.2.2 — Intelligence API Type Safety Consolidation

This release fixes the shared typed API-response regression across the admin automation and intelligence pages.

## Fixed pages

- Automation Control Center
- Image Intelligence
- Intelligence Center
- Launch Intelligence
- Pakistan Intelligence
- Price Intelligence V2
- Specs Intelligence
- YouTube Intelligence
- Continuous Monitoring
- AI Research fallback/review requests

## Reliability changes

- Every typed React state now receives a matching generic response type from `readApiResponse<T>()`.
- HTML, malformed JSON, 401/404/500 responses continue to surface as readable errors instead of JSON parser crashes.
- Action responses use separate response contracts instead of being assigned to list/dashboard state.
- Existing no-auto-publish and review-first automation behavior is unchanged.
- No paid AI dependency was introduced.

## Validation

- All ten changed TSX files passed TypeScript syntax/transpile validation.
- Full dependency-based build could not run in the container because the internal package mirror does not contain `zod-validation-error@4.0.2`; GitHub/Vercel will run the full typecheck and production build.
