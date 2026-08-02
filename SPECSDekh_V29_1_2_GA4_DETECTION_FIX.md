# SpecsDekh v29.1.2 — GA4 Detection & Consent Mode Fix

- Google tag is emitted in the document head so Google installation testing can detect it.
- Consent Mode defaults analytics and advertising storage to denied.
- Accepting cookies updates consent to granted and enables SPA page-view events.
- Choosing essential-only keeps analytics and advertising storage denied.
- The GA4 ID is read from Admin Settings first, with `NEXT_PUBLIC_GA_MEASUREMENT_ID` as fallback.
- Duplicate Google tag loading was removed from the client runtime.
