import fs from 'node:fs';
const price = fs.readFileSync('src/app/api/[[...path]]/handlers/price-tracker.ts','utf8');
const collector = fs.readFileSync('src/app/api/[[...path]]/handlers/collector.ts','utf8');
const checks = [
  ['price product-page guard', price.includes('isLikelyProductPageUrl')],
  ['price shared extractor', price.includes('extractRetailPrice(html,')],
  ['price readiness diagnostics', price.includes('missingProductUrls') && price.includes('rejectedHomepageUrls')],
  ['collector deterministic mode', collector.includes('deterministicOnly: true')],
  ['collector provider-free mode', !/openai|openrouter|tavily|ai-enrichment/i.test(collector)],
  ['collector configured-source guard', collector.includes('No configured enabled sources to run')],
];
let failed=0;
for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
if(failed) process.exit(1);
console.log(`Automation runtime readiness: ${checks.length}/${checks.length} passed`);
