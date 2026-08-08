import fs from 'node:fs';

const checks = [
  ['SEO landing definitions', fs.existsSync('src/lib/seo-growth.ts')],
  ['SEO landing route', fs.existsSync('src/app/phones-by-spec/[type]/[value]/page.tsx')],
  ['Phone FAQ schema', fs.readFileSync('src/app/phones/[slug]/page.tsx', 'utf8').includes("'@type': 'FAQPage'")],
  ['Spec landing sitemap entries', fs.readFileSync('src/app/static-sitemap.xml/route.ts', 'utf8').includes('SEO_SPEC_LANDINGS.map')],
  ['ItemList schema', fs.readFileSync('src/app/phones-by-spec/[type]/[value]/page.tsx', 'utf8').includes("'@type': 'ItemList'")],
  ['Breadcrumb schema', fs.readFileSync('src/app/phones-by-spec/[type]/[value]/page.tsx', 'utf8').includes("'@type': 'BreadcrumbList'")],
  ['Canonical metadata', fs.readFileSync('src/app/phones-by-spec/[type]/[value]/page.tsx', 'utf8').includes('alternates: { canonical:')],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) process.exit(1);
console.log(`SEO growth audit passed (${checks.length}/${checks.length}).`);
