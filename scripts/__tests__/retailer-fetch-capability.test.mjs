import fs from 'node:fs';

const fetcher = fs.readFileSync('src/lib/retailer-fetch.ts', 'utf8');
const handler = fs.readFileSync('src/app/api/[[...path]]/handlers/price-tracker.ts', 'utf8');
const ui = fs.readFileSync('src/app/admin/price-tracker/page.tsx', 'utf8');
const model = fs.readFileSync('src/lib/models/PriceTracker.ts', 'utf8');
const cron = fs.readFileSync('src/app/api/[[...path]]/handlers/cron-update-prices.ts', 'utf8');

const checks = [
  ['browser user agent', /Mozilla\/5\.0/.test(fetcher)],
  ['bounded 25 second timeout', /DEFAULT_TIMEOUT_MS = 25_000/.test(fetcher)],
  ['challenge classification', /failureType: 'challenge'|return 'challenge'/.test(fetcher)],
  ['diagnostic response preview', /preview/.test(fetcher) && /lastResponsePreview/.test(handler)],
  ['source capability state', /challenge_blocked/.test(model) && /automaticFetchEnabled/.test(model)],
  ['challenge does not mark source failed', /challengeBlocked[\s\S]+status: 'active'/.test(handler)],
  ['cron excludes blocked sources', /automaticFetchEnabled: \{ \$ne: false \}/.test(cron) && /accessMode: \{ \$ne: 'challenge_blocked' \}/.test(cron)],
  ['UI explains server block', /Retailer blocks server-side automation/.test(ui) && /Server blocked/.test(ui)],
  ['modal shows HTTP diagnostics', /HTTP status/.test(ui) && /Failure type/.test(ui) && /Response preview/.test(ui)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) process.exit(1);
