import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const showcase = readFileSync('src/components/shared/HeroPhoneShowcase.tsx', 'utf8');
const home = readFileSync('src/app/HomeContent.tsx', 'utf8');

assert.match(showcase, /\[perspective:900px\]/, 'hero product stage should preserve perspective depth');
assert.match(showcase, /h-\[176px\][\s\S]*sm:h-\[226px\][\s\S]*lg:h-\[250px\]/, 'hero image must use bounded responsive heights');
assert.match(showcase, /fill[\s\S]*object-contain/, 'source images must remain contained without destructive cropping');
assert.match(showcase, /inline-flex shrink-0[\s\S]*PTA/, 'PTA badge must never shrink outside its card');
assert.match(showcase, /block truncate[\s\S]*title=\{spec\}/, 'long specs need a safe truncation path');
assert.doesNotMatch(showcase, /height=\{430\}|width=\{351\}/, 'legacy oversized image dimensions must stay removed');
assert.match(home, /h-\[190px\][\s\S]*sm:h-\[240px\][\s\S]*lg:h-\[270px\]/, 'homepage hero showcase should use the compact height scale');

console.log('Hero showcase polish tests passed');
