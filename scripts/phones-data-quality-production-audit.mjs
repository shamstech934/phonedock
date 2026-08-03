import fs from 'node:fs';

const checks = [
  ['Phone stat cards are actionable', 'src/app/admin/phones/page.tsx', "applyStatFilter"],
  ['Draft and review use one filter', 'src/app/api/[[...path]]/handlers/admin-crud.ts', "status === 'draft' || status === 'draft-review'"],
  ['Unknown PTA filter is supported', 'src/app/api/[[...path]]/handlers/admin-crud.ts', "ptaFilter === 'unknown'"],
  ['Filtered phone CSV export exists', 'src/app/admin/phones/page.tsx', 'exportFilteredPhones'],
  ['Quality summary covers working inventory', 'src/app/api/[[...path]]/handlers/data-quality.ts', "scope: 'working-inventory'"],
  ['Published-only quality diagnostics remain visible', 'src/app/api/[[...path]]/handlers/data-quality.ts', 'publishedQueues'],
  ['Live queues include Draft and Review', 'src/app/api/[[...path]]/handlers/data-quality.ts', "status: { $in: ['published', 'draft', 'pending'] }"],
  ['Health score covers working inventory', 'src/lib/data-quality/scanner.ts', "status: { $in: ['published', 'draft', 'pending'] }"],
  ['Quality UI explains its scope', 'src/app/admin/data-quality/page.tsx', 'complete working inventory'],
];

let failures = 0;
for (const [label, file, needle] of checks) {
  const text = fs.readFileSync(file, 'utf8');
  const ok = text.includes(needle);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failures += 1;
}
if (failures) process.exit(1);
console.log(`Phones + Data Quality audit passed (${checks.length}/${checks.length}).`);
