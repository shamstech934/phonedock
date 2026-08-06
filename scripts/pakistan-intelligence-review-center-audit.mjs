import fs from 'node:fs';
const page = fs.readFileSync('src/app/admin/pakistan-intelligence/page.tsx', 'utf8');
const handler = fs.readFileSync('src/app/api/[[...path]]/handlers/pakistan-intelligence.ts', 'utf8');
const lib = fs.readFileSync('src/lib/pakistan-intelligence.ts', 'utf8');
const checks = [
  ['bounded default scan', /options\?\.limit \|\| 25/.test(lib)],
  ['hard max 150', /Math\.min\(150/.test(lib)],
  ['bulk signal writes', /PakistanMarketSignal\.bulkWrite/.test(lib)],
  ['coverage metric', /retailerCoveragePercent/.test(handler) && /Retailer coverage/.test(page)],
  ['severity filter', /severity=/.test(page) && /filter\.severity/.test(handler)],
  ['evidence panel', /function EvidencePanel/.test(page)],
  ['manual resolve action', /action === 'resolve'/.test(handler) && /runAction\('resolve'/.test(page)],
  ['scan size control', /25 phones/.test(page) && /150 phones/.test(page)],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
if (failed) process.exit(1);
