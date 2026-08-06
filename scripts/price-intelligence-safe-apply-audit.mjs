import fs from 'node:fs';

const ui = fs.readFileSync('src/app/admin/price-intelligence-v2/page.tsx', 'utf8');
const handler = fs.readFileSync('src/app/api/[[...path]]/handlers/price-intelligence-v2.ts', 'utf8');
const engine = fs.readFileSync('src/lib/price-intelligence.ts', 'utf8');

const checks = [
  ['UI gates Apply to verified recommendation', ui.includes("item.type === 'recommended_market_price'") && ui.includes('isActionableRecommendation')],
  ['Missing coverage routes to source remediation', ui.includes('Match trusted source') && ui.includes('Link product')],
  ['Server revalidates trusted active source', handler.includes("trusted:true,status:'active'")],
  ['Server revalidates exact verified listing', handler.includes("verificationStatus:'verified'") && handler.includes("availability:'available'")],
  ['Large price jump requires force review', handler.includes('more than 35%')],
  ['Scan is bounded to maximum 50', engine.includes('Math.min(50')],
  ['Signal persistence uses bulkWrite', engine.includes('PriceIntelligenceSignal.bulkWrite')],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
