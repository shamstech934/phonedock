import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [
  ['phone metadata template', read('src/app/phones/[slug]/page.tsx').includes('phoneTitleTemplate')],
  ['phone noindex safety', read('src/app/phones/[slug]/page.tsx').includes('isIndexablePhone')],
  ['product schema', read('src/app/phones/[slug]/page.tsx').includes("'@type': 'Product'")],
  ['brand item list schema', read('src/app/brands/[slug]/page.tsx').includes("'@type': 'ItemList'")],
  ['brand empty-page noindex', read('src/app/brands/[slug]/layout.tsx').includes('indexEmptyBrands')],
  ['published-only phone sitemap', read('src/app/phones-sitemap.xml/route.ts').includes('getIndexReadyPhoneFilter')],
  ['empty brands excluded from sitemap', read('src/app/brands-sitemap.xml/route.ts').includes("Phone.distinct('brandId'")],
  ['admin private robots', read('src/app/robots.ts').includes("'/admin/'")],
  ['search noindex/disallow', read('src/app/robots.ts').includes("'/search'")],
  ['search console admin setting', read('src/app/admin/settings/page.tsx').includes('googleSiteVerification')],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${name}`);
if (failed.length) { console.error(`SEO audit failed: ${failed.length} checks`); process.exit(1); }
console.log(`SEO enterprise audit passed: ${checks.length} checks`);
