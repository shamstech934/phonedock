import fs from 'node:fs';

const files = {
  model: fs.readFileSync('src/lib/models/PriceTracker.ts', 'utf8'),
  handler: fs.readFileSync('src/app/api/[[...path]]/handlers/price-tracker.ts', 'utf8'),
  cron: fs.readFileSync('src/app/api/[[...path]]/handlers/cron-update-prices.ts', 'utf8'),
  extraction: fs.readFileSync('src/lib/price-extraction.ts', 'utf8'),
};

const checks = [
  ['listing failure diagnostics', files.model.includes('lastError') && files.model.includes('failureCount')],
  ['extraction provenance', files.model.includes('extractionMethod') && files.model.includes('extractionConfidence')],
  ['verified listing on create', files.handler.includes("verificationStatus = 'verified'") && files.handler.includes('Product page verified and ready')],
  ['source test health persistence', files.handler.includes('[price-tracker:test-source:health]')],
  ['shared deterministic parser', files.handler.includes('extractRetailPrice(html)') && files.cron.includes('extractRetailPrice(html)')],
  ['duplicate updated counter removed', !files.cron.includes('summary.updated++;\n            summary.updated++;')],
  ['sync diagnostics', files.cron.includes('unchanged: 0') && files.cron.includes('unavailable: 0')],
  ['bounded product fetch', files.handler.includes('12_000') && files.cron.includes('15000')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`Price Tracker Phase 3 audit passed (${checks.length}/${checks.length}).`);
