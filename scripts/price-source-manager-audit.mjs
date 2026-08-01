import fs from 'node:fs';

const uiPath = 'src/app/admin/price-tracker/page.tsx';
const apiPath = 'src/app/api/[[...path]]/handlers/price-tracker.ts';
const ui = fs.readFileSync(uiPath, 'utf8');
const api = fs.readFileSync(apiPath, 'utf8');

const checks = [
  ['visible Edit action', ui.includes('> Edit')],
  ['visible Delete action', ui.includes('> Delete')],
  ['edit modal', ui.includes('Save source') && ui.includes('handleUpdateSource')],
  ['delete confirmation', ui.includes('Delete permanently') && ui.includes('handleDeleteSource')],
  ['cron configuration status', ui.includes('CRON_SECRET configured') && ui.includes('cronConfigured')],
  ['admin Run now action', ui.includes('runPriceSync') && ui.includes("'Run now'")],
  ['source PUT endpoint', api.includes('export async function handlePriceTrackerPut') && api.includes('updates.allowedDomains')],
  ['source DELETE endpoint', api.includes('export async function handlePriceTrackerDelete') && api.includes('PriceSource.findByIdAndDelete')],
  ['secret-safe cron status', api.includes('cronConfigured: Boolean(process.env.CRON_SECRET)')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${name}`);
if (failed.length) {
  console.error(`Price source manager audit failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log('Price source manager audit passed.');
