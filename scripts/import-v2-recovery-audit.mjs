import fs from 'node:fs';

const checks = [
  ['engine reconciliation', 'src/lib/import/import-v2-engine.ts', 'reconcileImportSystem'],
  ['strict variant identity', 'src/lib/import/import-v2-engine.ts', 'getVariantIdentity'],
  ['rollback implementation', 'src/lib/import/import-v2-engine.ts', 'rollbackJob'],
  ['reconcile endpoint', 'src/app/api/[[...path]]/handlers/import-v2.ts', 'handleImportV2Reconcile'],
  ['route wiring', 'src/app/api/[[...path]]/route.ts', 'handleImportV2Reconcile'],
  ['admin repair action', 'src/app/admin/import-v2/page.tsx', 'Repair & Reconcile'],
];
let failed = false;
for (const [name, file, needle] of checks) {
  const text = fs.readFileSync(file, 'utf8');
  const ok = text.includes(needle);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
