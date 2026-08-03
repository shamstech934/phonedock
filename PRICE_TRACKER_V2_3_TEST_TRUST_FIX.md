# PhoneDock Price Tracker v2.3 — Test & Trust Workflow Fix

## Fixed
- Replaced blocked/silent browser prompt with a first-class Test & Trust modal.
- Added persistent Verification Product URL to PriceSource database, API, edit form, and source payload.
- Shows loading state, reachability, page title, detected PKR price, availability, extraction method, confidence, and exact error.
- Successful verification now persists the URL and automatically marks the source trusted, active, and enabled.
- Failed verification updates source health, failure count, last error, and retry time.
- Verification URLs must use HTTPS and match the source allowed domains.
- Homepage/category URLs remain unsupported unless they expose a reliable product price.

## Production test
1. Open Admin > Price Tracker > Sources.
2. Click Test & trust.
3. Paste one real phone product URL.
4. Confirm detected title, PKR price, method, and confidence.
5. On success, the source row should show Trusted = Yes and Last Checked = current time.
