import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { absoluteUrl, buildPageMetadata, compactText } from '../../src/lib/seo';

process.env.NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk';

assert.equal(compactText('  hello   world  '), 'hello world');
assert.equal(compactText('1234567890', 6), '12345…');
assert.equal(absoluteUrl('/phones'), 'https://phonedock.pk/phones');

const meta = buildPageMetadata({
  title: 'Test Phone Price in Pakistan',
  description: 'A useful description for a phone page.',
  path: '/phones/test-phone',
});
assert.equal(meta.alternates?.canonical, 'https://phonedock.pk/phones/test-phone');
assert.equal(meta.openGraph?.url, 'https://phonedock.pk/phones/test-phone');
assert.equal(meta.twitter?.card, 'summary_large_image');

const root = path.resolve(process.cwd());
const nextConfig = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8');
assert.match(nextConfig, /poweredByHeader:\s*false/);
assert.match(nextConfig, /optimizePackageImports/);
assert.match(nextConfig, /stale-while-revalidate/);

for (const file of ['src/app/opengraph-image.tsx', 'src/app/twitter-image.tsx', 'src/app/sitemap.ts', 'src/app/robots.ts']) {
  assert.ok(fs.existsSync(path.join(root, file)), `${file} must exist`);
}

console.log('v6 SEO/performance tests passed');
