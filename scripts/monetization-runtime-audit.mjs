import fs from 'node:fs';
const checks = [
  ['Affiliate manager page', 'src/app/admin/affiliate-links/page.tsx', 'Affiliate Link Manager'],
  ['Affiliate CRUD API', 'src/app/api/admin/affiliate-links/route.ts', 'export async function POST'],
  ['Safe destination allowlist', 'src/app/api/admin/affiliate-links/route.ts', 'allowedDestination'],
  ['Admin navigation', 'src/app/admin/layout.tsx', '/admin/affiliate-links'],
  ['Monetization center link', 'src/app/admin/monetization/page.tsx', '/admin/affiliate-links'],
  ['Sponsored redirect relationship', 'src/components/monetization/AffiliateButton.tsx', 'sponsored nofollow'],
];
let failed = 0;
for (const [label,file,needle] of checks) {
  const ok = fs.existsSync(file) && fs.readFileSync(file,'utf8').includes(needle);
  console.log(`${ok?'PASS':'FAIL'} ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`Monetization runtime audit passed: ${checks.length}/${checks.length}`);
