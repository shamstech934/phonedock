import fs from 'node:fs';
const checks = [
  ['phones clickable stats', 'src/app/admin/phones/page.tsx', 'applyStatsFilter'],
  ['phones csv export', 'src/app/admin/phones/page.tsx', 'exportPhonesCsv'],
  ['draft includes pending', 'src/app/api/[[...path]]/handlers/admin-crud.ts', "['draft', 'pending']"],
  ['unknown PTA filter', 'src/app/api/[[...path]]/handlers/admin-crud.ts', "ptaFilter === 'unknown'"],
  ['data quality inventory query', 'src/app/api/[[...path]]/handlers/data-quality.ts', 'inventoryPhoneIds'],
  ['data quality draft queues', 'src/app/api/[[...path]]/handlers/data-quality.ts', "status: { $in: ['published', 'draft', 'pending'] }"],
  ['data quality status badge', 'src/app/admin/data-quality/page.tsx', 'Draft / Review'],
];
let failed = 0;
for (const [name, file, needle] of checks) {
  const ok = fs.readFileSync(file, 'utf8').includes(needle);
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`Phones + Data Quality audit: ${checks.length}/${checks.length} passed`);
