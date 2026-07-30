import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extractRetailPrice } from '../../src/lib/price-extraction';
import { parseRumourFeed } from '../../src/lib/rumour-sync';

const jsonLd = `<script type="application/ld+json">
{"@type":"Product","offers":{"@type":"Offer","priceCurrency":"PKR","price":"129,999"}}
</script><div>Installments from Rs. 10,000</div>`;
assert.deepEqual(extractRetailPrice(jsonLd), {
  price: 129999, currency: 'PKR', method: 'json-ld', confidence: 0.98,
});

const meta = `<meta property="product:price:amount" content="84999"><div>Rs. 99,999</div>`;
assert.equal(extractRetailPrice(meta)?.price, 84999);
assert.equal(extractRetailPrice('<div>Model number 123</div>'), null);
assert.equal(extractRetailPrice('<div>PKR 99</div>'), null);

const rss = `<?xml version="1.0"?><rss><channel><item>
  <title><![CDATA[Galaxy Z prototype reportedly leaks]]></title>
  <link>https://example.com/galaxy-z-leak</link>
  <description><![CDATA[An upcoming smartphone is expected soon.]]></description>
  <pubDate>Wed, 29 Jul 2026 10:00:00 GMT</pubDate>
</item></channel></rss>`;
const items = parseRumourFeed(rss);
assert.equal(items.length, 1);
assert.equal(items[0].title, 'Galaxy Z prototype reportedly leaks');
assert.equal(items[0].link, 'https://example.com/galaxy-z-leak');
assert.ok(items[0].publishedAt instanceof Date);
assert.throws(() => parseRumourFeed('<!DOCTYPE foo><rss/>'), /DTD/);

const root = path.resolve(import.meta.dirname, '../..');
const trackerHandler = fs.readFileSync(path.join(root, 'src/app/api/[[...path]]/handlers/price-tracker.ts'), 'utf8');
const cronHandler = fs.readFileSync(path.join(root, 'src/app/api/[[...path]]/handlers/cron-update-prices.ts'), 'utf8');
const trackerUi = fs.readFileSync(path.join(root, 'src/app/admin/price-tracker/page.tsx'), 'utf8');
assert.match(trackerHandler, /segments\[2\] === 'auto-link'/);
assert.match(trackerHandler, /verificationStatus: 'verified'/);
assert.match(trackerHandler, /trackingCoveragePct/);
assert.match(trackerHandler, /verifiedListings/);
assert.match(trackerHandler, /This retailer URL is already linked/);
assert.match(cronHandler, /handleAdminRunPriceSync/);
assert.match(cronHandler, /requirePermission\(authResult\.admin, 'prices:edit'\)/);
assert.match(trackerUi, /Run sync now/);
assert.match(trackerUi, /Auto-link catalog/);
assert.match(trackerUi, /Test & trust/);
assert.match(trackerUi, /No verified links/);

console.log('Price and rumour automation regression checks passed');
