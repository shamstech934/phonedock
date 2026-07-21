# PhoneDock 2.0 Setup

## New in 2.0

- Admin Launch Center at `/admin/launch-center`
- Live status for MongoDB, security, AdSense, GA4, Clarity, Search Console, SMTP, Cloudinary, Turnstile and affiliate partners
- Automatic `/ads.txt` generation from `NEXT_PUBLIC_ADSENSE_CLIENT`
- Safe affiliate redirect endpoint: `/api/affiliate?partner=daraz&phone=phone-slug`
- Reusable `AffiliateButton` component with GA4/Clarity click tracking and sponsored link attributes

## Vercel setup

1. Open Vercel project.
2. Open **Settings → Environment Variables**.
3. Copy names from `.env.example` and paste your account values.
4. Select Production, Preview and Development where appropriate.
5. Redeploy.
6. Open `/admin/launch-center` and confirm configured services.
7. Open `/ads.txt` and confirm the AdSense publisher record.

## Important

Code integration does not approve AdSense or create third-party accounts. Google, Microsoft, Cloudinary and affiliate accounts must be owned and approved by the site owner.
