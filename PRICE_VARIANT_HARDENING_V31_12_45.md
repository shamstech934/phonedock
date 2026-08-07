# SpecsDekh v31.12.45 — Variant Price Hardening

Final safety pass for RAM/storage/color + PTA/Non-PTA price tracking.

## Fixed
- Used, refurbished, open-box and pre-owned listings cannot become canonical public prices.
- Phone-level best PTA/Non-PTA prices use only generic NEW offers; storage/color-specific offers cannot overwrite the main phone price.
- Exact RAM/storage/color selection never falls back to another variant. Missing exact combinations return Price unavailable.
- No-selection API considers only generic offers for the canonical price.
- Public UI tells the user to select a variant when only variant-specific offers exist.
- Scheduled retailer history now stores PTA class, RAM, storage, color, condition, warranty and variantKey.
- Manual price history stores the same variant identity.
- Generic history and variant history are isolated in public price history queries.
- Regression tests cover unknown PTA blocking, used inventory exclusion and cross-storage canonical-price protection.

## Safety principle
No uncertain or different variant price may silently substitute for the user's selected variant or overwrite another variant's canonical price.
