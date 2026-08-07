import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const model = read('src/lib/models/PhoneSub.ts');
const handler = read('src/app/api/[[...path]]/handlers/price-tracker.ts');
const publicApi = read('src/app/api/[[...path]]/handlers/public.ts');
const adminCrud = read('src/app/api/[[...path]]/handlers/admin-crud.ts');
const ui = read('src/app/admin/price-tracker/page.tsx');
const offer = read('src/lib/price-offer-service.ts');

const checks = [
  ['schema manual override', model.includes('manualOverride: { type: Boolean')],
  ['schema per-variant lock', model.includes('overrideLocked: { type: Boolean')],
  ['override upsert', handler.includes("storeName: 'Admin Override'") && handler.includes('findOneAndUpdate')],
  ['reset exact override', handler.includes('/api/admin/price-tracker/reset-override') && handler.includes('findOneAndDelete')],
  ['price control read endpoint', handler.includes('/api/admin/price-tracker/price-control/:phoneId')],
  ['public locked override priority', publicApi.includes('[...lockedManual, ...retailerVariants, ...unlockedManual, ...historyVariants]')],
  ['phone editor preserves overrides', adminCrud.includes("deleteMany({ phoneId: phone._id, manualOverride: { $ne: true } })")],
  ['canonical recompute uses overrides', offer.includes('canonicalOverride') && offer.includes('overridePta')],
  ['admin UI Price Control', ui.includes('Price Control') && ui.includes('Reset to Auto') && ui.includes('Save & Lock')],
  ['existing identities shown', ui.includes('Existing price controls') && ui.includes('locked override')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`PASS ${checks.length}/${checks.length} critical price-control checks`);
