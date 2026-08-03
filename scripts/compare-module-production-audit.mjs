import fs from 'node:fs';

const file = fs.readFileSync('src/app/compare/page.tsx', 'utf8');
const checks = [
  ['single RAM row', (file.match(/label: 'RAM'/g) || []).length === 1],
  ['keyboard navigation', file.includes("event.key === 'ArrowDown'") && file.includes("event.key === 'Enter'")],
  ['share action', file.includes('shareComparison') && file.includes('navigator.share')],
  ['copy link action', file.includes('copyComparisonLink') && file.includes('navigator.clipboard')],
  ['print action', file.includes('window.print()')],
  ['only differences persistence', file.includes('compare-only-differences')],
  ['sticky phone header', file.includes('<thead className="sticky top-0')],
  ['empty price safety', file.includes('validPrices.length ? Math.min')],
  ['duplicate URL update removed', !file.includes('updateURL(selected);\n                  updateURL(selected);')],
  ['neutral difference highlighting', file.includes('const isDifferent = !allSame')],
];

let passed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (ok) passed += 1;
}
console.log(`Compare module audit: ${passed}/${checks.length} passed`);
if (passed !== checks.length) process.exit(1);
