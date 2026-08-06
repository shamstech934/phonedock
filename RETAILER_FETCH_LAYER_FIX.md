# SpecsDekh v31.12.33 — Shared Retailer Fetch Layer Fix

## Fixed
- Replaced bot-identifying User-Agent with realistic browser request headers.
- Increased bounded retailer timeout to 25 seconds.
- Added one shared fetch utility for source testing, listing verification, scheduled price updates, and catalogue discovery.
- Captures HTTP status, final redirected URL, content type, duration, failure type, and first 500 response characters.
- Separates timeout, DNS/network, HTTP error, blocked/rate-limited, challenge page, invalid content type, and oversized response states.
- Keeps SSRF validation and 3 MB response protection.
- Prefers `product:price:amount` with `product:price:currency=PKR` and gives it high confidence.
- Price-source test modal now displays diagnostics instead of the generic “not reachable” result.

## Verification limitation
The build environment cannot resolve external DNS, so the live iShopping request could not be replayed here. Deploy and run Test & trust against the same product URL; the modal will now expose the exact Vercel-side response if the retailer still blocks serverless traffic.
