import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const assert = (ok, message) => { if (!ok) failures.push(message); };

assert(!fs.existsSync(path.join(root, 'src/app/sitemap.ts')), 'duplicate metadata sitemap route src/app/sitemap.ts must not exist');
assert(fs.existsSync(path.join(root, 'src/app/sitemap.xml/route.ts')), 'canonical sitemap index route is missing');

const urls = read('src/lib/urls.ts');
assert(urls.includes("return 'https://specsdekh.com'"), 'canonical production base URL must be https://specsdekh.com');

const xml = read('src/lib/seo-sitemaps/xml.ts');
assert(!xml.includes("X-Robots-Tag': 'noindex"), 'XML responses must not add an unnecessary noindex header');
assert(xml.includes("status: 200"), 'XML responses must explicitly return HTTP 200');
assert(xml.includes("application/xml; charset=utf-8"), 'XML responses must use application/xml');

const nextConfig = read('next.config.ts');
assert(!nextConfig.includes("X-Robots-Tag', value: 'noindex'"), 'Next config must not inject noindex on sitemap responses');

const proxy = read('src/proxy.ts');
assert(!proxy.includes("hostname.toLowerCase() === 'www.specsdekh.com'"), 'application proxy must not duplicate Vercel host redirects');
assert(proxy.includes("sitemap\\.xml|.*-sitemap\\.xml"), 'proxy matcher must exclude sitemap endpoints');

const image = read('src/app/image-sitemap.xml/route.ts');
assert(image.includes('toAbsoluteImageUrl'), 'image sitemap must normalize image URLs');
assert(image.includes("url.protocol !== 'http:' && url.protocol !== 'https:'"), 'image sitemap must reject non-HTTP image URLs');

const index = read('src/app/sitemap.xml/route.ts');
for (const name of ['phones', 'brands', 'news', 'reviews', 'image', 'video']) {
  assert(index.includes(`'${name}'`) || index.includes(`\"${name}\"`), `sitemap index is missing ${name}-sitemap.xml`);
}

if (failures.length) {
  console.error('GSC sitemap audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('GSC sitemap audit passed: single owner, canonical origin, direct XML 200, no duplicate redirect/noindex.');
