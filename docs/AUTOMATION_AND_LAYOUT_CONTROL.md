# PhoneDock Automation & Layout Control

## Unified daily pipeline

The Vercel schedule calls `/api/cron/automation-pipeline` once per day. The
pipeline runs staged work instead of rewriting the whole catalogue:

1. Check verified retailer listings and apply safe price changes.
2. Reconcile lifecycle dates (`coming soon`, `available`, `discontinued`).
3. Import approved rumour-feed candidates for editorial review.
4. Refresh affected public caches.

Large price changes remain pending. Rumours are never automatically published.
The same flow can be run from **Admin → Automation Pipeline**.

`CRON_SECRET` must be configured in Vercel.

## Phone-card layout controls

Open **Admin → Card Layout Control**. Every surface has separate Desktop,
Tablet and Mobile column counts:

- Homepage
- All Phones
- Brand pages
- Search results
- Rankings
- Related/Smart Alternatives
- Buying guides

Desktop supports 1–10 columns. At narrow card widths, secondary actions and
spec chips collapse automatically so buttons never overflow. Use Compact
density when showing many cards.

## Links / href management

Open **Admin → Homepage Builder → Header & links**. It opens the navigation controls on the homepage
Builder. Internal links must begin with `/`; external links must use HTTPS.
Unsafe protocols are rejected on the server.

## Card status and discounts

- Coming Soon: violet badge
- Rumoured: amber badge
- Discontinued: slate badge and no live-price claim
- Discount: previous price is struck through and a green percentage badge is
  shown only when `originalPricePKR > pricePKR > 0`

No fallback discount or lifecycle state is fabricated.
