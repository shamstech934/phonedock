# SpecsDekh v31.12.35 — WhatMobile Catalog Discovery Fix

- Supports WhatMobile one-segment product URLs such as `/Samsung_Galaxy-A37`.
- Rejects WhatMobile catalog/category URLs such as `/Samsung_Mobiles_Prices`.
- Keeps generic two-segment product URL safety rules for other providers.
- Uses the shared retailer fetch layer for catalog discovery (browser headers, 25s timeout, SSRF and response-size protection).
- Adds bounded discovery diagnostics: HTTP status, total anchors, allowed-domain links, accepted product candidates, and rejected URL samples.
- Aligns source verification and auto-link URL validation with the same provider-aware product URL rules.
- Adds regression cases for Samsung Galaxy A37, Infinix GT 50 Pro, Vivo X300 FE and Apple iPhone 16 Pro Max.
