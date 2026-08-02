# SpecsDekh v29.1 — GA4 Analytics Runtime

## Implemented

- Reads the Google Analytics Measurement ID saved in Admin Settings.
- Falls back to `NEXT_PUBLIC_GA_MEASUREMENT_ID` when the database setting is unavailable.
- Validates the `G-...` Measurement ID before injecting Google scripts.
- Respects the existing cookie-consent decision.
- Does not load analytics on `/admin` routes.
- Tracks Next.js client-side navigation as GA4 `page_view` events.
- Includes query parameters in page paths for search/filter analysis.
- Disables GA's initial automatic page view to prevent duplicate events.
- Sends Core Web Vitals to GA4 as non-interaction `web_vitals` events.
- Preserves SpecsDekh's database-backed internal analytics and affiliate events.

## Measurement ID

Configured through Admin Settings as `G-38KG1QVEFE` by the site owner. The value is stored in the database and is not hard-coded in this package.

Optional environment fallback:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-38KG1QVEFE
```

## Verification

After deployment and accepting cookies:

1. Open SpecsDekh in a normal browser window.
2. Visit two or three public pages.
3. Open Google Analytics → Reports → Realtime.
4. Use Google Tag setup → Test installation if required.

## Audit

Run:

```bash
npm run audit:ga4
```
