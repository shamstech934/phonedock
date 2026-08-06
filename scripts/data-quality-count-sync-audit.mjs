import fs from 'node:fs';

const ui = fs.readFileSync('src/app/admin/data-quality/page.tsx', 'utf8');
const api = fs.readFileSync('src/app/api/[[...path]]/handlers/data-quality.ts', 'utf8');

const checks = [
  ['UI uses explicit getTabCount', ui.includes('function getTabCount')],
  ['UI no longer maps multi-type tabs through getQueueCountKey', !ui.includes('function getQueueCountKey')],
  ['UI reports issue API failures', ui.includes('Issue list could not be loaded')],
  ['UI supports count/list mismatch warning', ui.includes('issue records are expected')],
  ['API returns persisted issueCounts', api.includes('issueCounts: {')],
  ['API counts low-confidence issues directly', api.includes('lowConfidenceIssues')],
  ['API counts price issues directly', api.includes('priceIssues')],
  ['API counts brand issues directly', api.includes('brandIssues')],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
