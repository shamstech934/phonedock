import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const rootLayout = read('src/app/layout.tsx');
const home = read('src/app/page.tsx');
const phonesSitemap = read('src/app/phones-sitemap.xml/route.ts');
const staticSitemap = read('src/app/static-sitemap.xml/route.ts');
const sitemapIndex = read('src/app/sitemap.xml/route.ts');
const publication = read('src/lib/phone-publication.ts');
const listings = read('src/lib/fetch-public-listings.ts');
const detail = read('src/app/phones/[slug]/page.tsx');
const proxy = read('src/proxy.ts');
const nextConfig = read('next.config.ts');
const robots = read('src/app/robots.ts');

assert.doesNotMatch(rootLayout, /alternates:\s*\{\s*canonical:\s*canonicalBase/, 'root layout must not canonicalize every route to the homepage');
assert.match(rootLayout, /const canonicalBase = BASE_URL;/, 'metadataBase must use the single canonical production origin');
assert.match(home, /alternates:\s*\{\s*canonical:\s*['"]\/['"]\s*\}/, 'homepage needs an explicit self canonical');
assert.equal(fs.existsSync('src/app/sitemap.ts'), false, 'duplicate metadata sitemap route must not exist');
assert.match(phonesSitemap, /Phone\.find\(getIndexReadyPhoneFilter\(\)\)/, 'phone sitemap must include only index-ready phone pages');
assert.match(sitemapIndex, /static.*phones.*brands.*news.*reviews.*image.*video/s, 'sitemap index must own all child sitemaps');
assert.ok(staticSitemap.includes("{ path: '/',"), 'static sitemap must contain the homepage');
assert.match(staticSitemap, /SEO_SPEC_LANDINGS\.map/, 'static sitemap must own stable spec landing URLs');
assert.doesNotMatch(phonesSitemap, /SEO_SPEC_LANDINGS|const staticUrls/, 'phone sitemap must contain phone detail URLs only');
assert.match(publication, /getIndexReadyPhoneFilter/, 'shared index-ready publication filter must exist');
assert.match(publication, /thumbnail/, 'index-ready phones must require a thumbnail');
assert.match(publication, /pricePKR:\s*\{\s*\$gt:\s*0\s*\}/, 'released index-ready phones must require a positive price');
assert.match(listings, /getIndexReadyPhoneFilter/, 'public catalogue and brand surfaces must prefer index-ready phones');
assert.match(detail, /const baseUrl = getBaseUrl\(\)/, 'phone JSON-LD must use the same canonical host as metadata/sitemap');
assert.match(proxy, /X-Robots-Tag/, 'private/internal UI routes need X-Robots-Tag noindex headers');
assert.match(robots, /sitemap:\s*`\$\{getBaseUrl\(\)\}\/sitemap\.xml`/, 'robots.txt must advertise the canonical sitemap');

const publicSeoFiles = [
  'src/app/phones/layout.tsx','src/app/brands/layout.tsx','src/app/news/layout.tsx',
  'src/app/compare/layout.tsx','src/app/videos/layout.tsx','src/app/phones/[slug]/page.tsx',
];
for (const file of publicSeoFiles) {
  assert.doesNotMatch(read(file), /NEXT_PUBLIC_BASE_URL/, `${file} must not emit canonical URLs from environment drift`);
}

console.log('google-indexing-recovery-audit: PASS');
