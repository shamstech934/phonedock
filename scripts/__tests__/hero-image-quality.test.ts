import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const showcase = readFileSync('src/components/shared/HeroPhoneShowcase.tsx', 'utf8');
const homeData = readFileSync('src/lib/fetch-home-data.ts', 'utf8');

assert.match(showcase, /heroImage\?: string/);
assert.match(showcase, /phone\.heroImage \|\| phone\.thumbnail/);
assert.match(showcase, /naturalWidth < 600 \|\| probe\.naturalHeight < 600/);
assert.match(showcase, /isLowResolution \? 'w-\[78%\] max-w-\[210px\]'/);
assert.match(showcase, /bg-\[radial-gradient\(circle_at_50%_38%/);
assert.match(showcase, /rounded-\[1\.75rem\]/);
assert.doesNotMatch(showcase, /mix-blend-multiply/);

assert.match(homeData, /PhoneImage\.find\(/);
assert.match(homeData, /heroImageMap/);
assert.match(homeData, /heroImage: \(phone\.id \? heroImageMap\.get\(phone\.id\) : undefined\) \|\| phone\.thumbnail/);

console.log('hero image quality regression checks passed');
