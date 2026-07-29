import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const showcase = readFileSync('src/components/shared/HeroPhoneShowcase.tsx', 'utf8');
const homeData = readFileSync('src/lib/fetch-home-data.ts', 'utf8');

assert.match(showcase, /heroImage\?: string/);
assert.match(showcase, /phone\.heroImage \|\| phone\.thumbnail/);
assert.match(showcase, /naturalWidth < 600 \|\| probe\.naturalHeight < 600/);
assert.match(showcase, /isLowResolution \? 'w-\[58%\] max-w-\[225px\]'/);
assert.match(showcase, /from-white via-slate-50 to-sky-100/);
assert.match(showcase, /rounded-\[2rem\]/);
assert.doesNotMatch(showcase, /mix-blend-multiply/);

assert.match(homeData, /PhoneImage\.find\(/);
assert.match(homeData, /heroImageMap/);
assert.match(homeData, /heroImage: heroImageMap\.get\(phone\.id\) \|\| phone\.thumbnail/);

console.log('hero image quality regression checks passed');
