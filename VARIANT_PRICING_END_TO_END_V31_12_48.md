# SpecsDekh v31.12.48 — End-to-End Variant Pricing

This consolidated pass completes the variant pricing plumbing across the public detail UI, card serialization, admin phone editor, legacy phone-price records, Price Tracker manual updates, retailer listings, pending review and price history.

## Price identity
Every price can now retain PTA class, RAM, storage, color, condition and warranty metadata. `variantKey` prevents those combinations from being treated as the same offer.

## Safety
- PTA and Non-PTA stay separate.
- Exact selected variants never fall back to a different storage/color offer.
- Unknown PTA evidence remains review-only in the automatic tracker.
- Multi-offer cards show `From` instead of implying that one price applies to every configuration.

## Admin
The phone editor price rows and Price Tracker manual edit modal now accept exact variant metadata. Price-change, pending-review and history payloads/UI expose the exact variant being reviewed.
