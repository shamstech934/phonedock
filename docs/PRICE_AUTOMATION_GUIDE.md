# PhoneDock automatic price tracking

PhoneDock does not guess prices. It checks verified product pages from sources
that the administrator explicitly trusts.

## One-time production setup

1. In Vercel, create a strong `CRON_SECRET` environment variable for Production
   and Preview, then redeploy.
2. Open **Admin → Price Tracker → Sources**.
3. Add an official store, authorised retailer, or licensed feed:
   - Name: the public retailer name.
   - Base URL: HTTPS origin, for example `https://shop.example.pk`.
   - Allowed domains: hostnames only, for example `shop.example.pk`.
   - Priority: official sources should have a higher priority.
4. Test a real phone product page. Only mark a source trusted after price
   extraction and availability detection both succeed.
5. Ensure imported phone records contain the genuine retailer product URL in
   `sourceUrl`, or add a listing from the Phones tab.
6. Click **Auto-link catalog**. PhoneDock links only URLs whose hostname matches
   a trusted source allowlist.
7. Click **Run sync now** for the first check.

Vercel then calls `/api/cron/update-prices` daily according to `vercel.json`.

## What happens when a discount appears

- The product page is fetched with SSRF protection and a timeout.
- Structured JSON-LD price data is preferred over meta tags and visible text.
- The retailer listing keeps the previous and current source price.
- Small/normal changes are applied automatically.
- Suspiciously large changes are held in **Pending Review**.
- Confirmed changes update the phone price, lowest/highest price, price history,
  price-drop UI, and relevant page caches.
- A manual price lock prevents automated overwrite while still recording the
  detected change.

Default thresholds are 2% for quiet auto-approval and 15% for mandatory review.
They can be changed under **Price Tracker → Settings**.

## Source guidance

Use, in order of preference:

1. Official retailer/brand API or CSV/JSON feed supplied to PhoneDock.
2. Authorised Pakistani retailer product pages with permission for automated
   checks.
3. Marketplace pages only when seller identity, PTA status, warranty and
   variant are unambiguous.

Do not use Google search results, copied competitor data, affiliate redirects,
login-protected pages, CAPTCHA-protected pages, or sites that prohibit
automation. A source may change its HTML at any time; monitor source failures
and pause it when extraction becomes unreliable.

## Daily admin routine

- Check **Overview** for tracking coverage and failed sources.
- Review **Pending Review** before approving large price changes.
- Check **Price Changes** for unexpected spikes.
- Do not unlock manually protected prices until the underlying source is fixed.
# Price automation operating flow

1. Open **Admin → Price Tracker → Sources**.
2. Add a retailer using its HTTPS homepage and allowed hostname.
3. Use **Test & trust**. A source is not eligible for automatic checks until it is trusted.
4. Run **Auto-link catalog** from the Price Tracker overview.
5. Open **Source Gaps**. This queue contains imported phone URLs whose retailer hostname is not covered.
6. Configure the missing retailer, test it, then run Auto-link again. Matching queue entries resolve automatically.
7. Run **Run sync now** for a controlled test. Normal changes are applied; changes above the review threshold go to **Pending Review**.

The Sources table reports verified/total listing coverage. `Ready` means the source is active, trusted and has at least one verified listing. `No verified links` means the source exists but the cron has nothing eligible to check.

