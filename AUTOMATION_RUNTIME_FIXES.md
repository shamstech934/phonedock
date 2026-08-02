# SpecsDekh Automation Runtime Reliability

This release removes paid-AI dependency from the price-intelligence scan path and makes the admin automation pages failure-safe.

## Price Intelligence V2

- Replaced N+1 price scan queries with bulk listing/history loading.
- Scans up to 1,000 published phones per run without one database round-trip per listing/history check.
- Reports the real reason no price was detected:
  - no exact retailer product URL linked;
  - retailer link not verified;
  - no trusted available positive price;
  - stale listing;
  - missing history;
  - market-price recommendation.
- No public price changes happen automatically. Recommendations remain admin-reviewed.

## API reliability

Admin automation pages now inspect response content before parsing it. Vercel HTML/plain-text errors no longer appear as `Unexpected token ... is not valid JSON`; the actual server error is displayed.

Covered areas include Price Tracker, Price Intelligence V2, Collector, Launch Intelligence, Pakistan Intelligence, Specs Intelligence, Image Intelligence, YouTube Intelligence, Continuous Monitoring, Release Readiness and SEO Monitoring.

## Important operational requirement

Price detection requires exact phone-level retailer product URLs in `PhoneRetailListing`. Adding only a retailer homepage cannot identify which listing belongs to which phone. The scanner now creates a clear `No retailer product URL linked` signal instead of reporting a misleading empty result.
