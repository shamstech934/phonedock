# v31.12.43 PTA / Non-PTA Price Separation

- PTA and Non-PTA verified offers remain separate.
- Unknown PTA classification can never auto-overwrite a public price.
- `bestPtaPricePKR` and `bestNonPtaPricePKR` are maintained independently.
- Canonical `pricePKR/currentPrice` updates only from a verified offer matching the phone PTA class.
- Price Intelligence recommendations carry a price class and refuse unknown-class apply.
- Price history records now include `priceClass`.
- Public phone detail provides a PTA Approved / Non-PTA selector and class-specific tracker history.
