import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const showcase = readFileSync('src/components/shared/HeroPhoneShowcase.tsx', 'utf8');
const home = readFileSync('src/app/HomeContent.tsx', 'utf8');
const settings = readFileSync('src/app/admin/settings/page.tsx', 'utf8');
const homePage = readFileSync('src/app/page.tsx', 'utf8');

assert.match(showcase, /\[perspective:1100px\]/, 'floating stage should preserve perspective depth');
assert.match(showcase, /rotateX\(66deg\)/, 'floating stage must include its perspective platform');
assert.match(showcase, /h-\[205px\][\s\S]*sm:h-\[245px\][\s\S]*lg:h-\[270px\]/, 'hero image must use bounded responsive heights');
assert.match(showcase, /fill[\s\S]*object-contain/, 'source images must remain contained without destructive cropping');
assert.match(showcase, /PTA Approved/, 'PTA state must be shown in the horizontal caption');
assert.doesNotMatch(showcase, /specItems/, 'legacy narrow specs card must stay removed');
assert.doesNotMatch(showcase, /height=\{430\}|width=\{351\}/, 'legacy oversized image dimensions must stay removed');
assert.match(home, /h-\[190px\][\s\S]*sm:h-\[240px\][\s\S]*lg:h-\[270px\]/, 'homepage hero showcase should use the compact height scale');
assert.match(settings, /Floating 3D Stage Phones/, 'admin settings must expose hero phone selection');
assert.match(settings, /heroPhoneSlugs/, 'admin settings must persist ordered hero phone slugs');
assert.match(homePage, /fetchHeroPhones\(selectedSlugs\)/, 'homepage must load admin-selected phones');

console.log('Hero showcase polish tests passed');
