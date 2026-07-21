# PhoneDock Monetization & Growth Setup

This release adds production-safe foundations for Google AdSense, Google Analytics 4, Microsoft Clarity, Search Console/Bing verification, affiliate click analytics, consent UI, and responsive ad placements.

## Vercel environment variables

Add the values listed in `.env.example` under **MONETIZATION & GROWTH** to Vercel > Project > Settings > Environment Variables, then redeploy.

## Google AdSense

1. Add and verify the PhoneDock domain in AdSense.
2. Create responsive display ad units.
3. Set `NEXT_PUBLIC_ADSENSE_CLIENT` and the slot variables.
4. Ad components render nothing until both client and slot are configured, so missing values never create broken boxes.
5. Keep ads away from navigation controls and misleading placements. Do not click your own ads.

## Analytics

- GA4 loads only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` exists.
- Clarity loads only when `NEXT_PUBLIC_CLARITY_PROJECT_ID` exists.
- `src/lib/analytics.ts` provides reusable event and affiliate-click tracking helpers.

## Search ownership

Paste the token only, not the complete meta tag, into the Google/Bing verification environment variables.

## Affiliate links

Use the exact tracked URL issued by each partner. Clearly label commerce buttons and keep `/affiliate-disclosure` linked in the footer. Call `trackAffiliateClick()` from client-side Buy/Shop buttons when retailer links are added.

## Consent and privacy

A consent banner now stores the visitor choice locally and links to the privacy policy. Before launch, update the legal pages with the final business name, contact email, analytics providers, ad partners, and retention policy.
