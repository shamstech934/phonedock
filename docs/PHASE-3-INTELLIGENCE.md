# Phase 3 intelligence methodology

## Systems reused

The implementation reads published `Phone` and `PhoneSpecs` records, existing technical scores, PTA state, verification metadata and PriceHistory-compatible points. It does not introduce a second phone, ranking, collector, price or review model.

## Recommendation formula (`recommendation-v1`)

The assistant parses an intent into hard filters and preferences. Budget and PTA requirements are hard filters. Requested technical dimensions use their existing 0–100 PhoneDock score with equal weight. If no explicit dimension exists, value and performance are used. An explicitly requested AMOLED display contributes 95 when verified and 35 when absent or not confirmed. Each missing requested field carries a six-point penalty, capped at 25 points. Results are clamped to 1–99, then ordered by match, value score and stable slug order.

Every result returns source fields, reasons, compromises, missing fields, verification age and confidence. Technical scores remain separate from user reviews and editorial content. Duplicate IDs/slugs, inactive records, drafts, over-budget phones and non-PTA phones for PTA-required queries are excluded.

## Roman Urdu and search intent

Mappings include `acha camera`, `gaming mobile`, `battery timing`, `PTA wala`, `paisa vasool`, `budget phone`, `fast charging`, `used mobile`, `box pack`, `hazar` and `lakh`. Input is restricted to 300 characters and control/HTML delimiters are removed. Mapping augments English intent; it does not replace English search.

## Price prediction (`linear-trend-v1`)

Prediction requires at least 12 valid positive points spanning 30 days. Tukey IQR removes price outliers. A least-squares trend projects four sampling intervals. Changes below 2.5% are labelled stable; other outputs are likely decrease/increase. The confidence range is the projection plus/minus 1.96 residual standard deviations. Confidence depends on sample size and normalized residual error. Outputs are estimates, never guarantees. Insufficient data produces no precise prediction.

## AI provider and safety

The current provider is the local rule engine. No external API key is required and `externalAIUsed` is always false. Imported descriptions are never inserted into prompts or treated as instructions. Queries use allowlisted fields and projections. Responses link only to retrieved PhoneDock slugs. Private preference data must remain `private, no-store`; personalized recommendation caching is not public.

## Analytics and retention

Use the existing `trackEvent` abstraction for category-only assistant queries, recommendation impressions/clicks, alternatives, comparisons, wishlist additions, alerts and affiliate clicks. Do not retain full free-text prompts by default. Recommended event retention is 90 days, with aggregate counts retained longer and user identifiers excluded unless consent and a documented purpose exist.

## Deployment

No migration is required for the rule engine. Existing score and query indexes must be present through the standard migration process. Run the assistant against production-like staging and verify score freshness before enabling a navigation link. External generative AI, if added later, must be environment-controlled, cost-limited and unable to override retrieved facts.
