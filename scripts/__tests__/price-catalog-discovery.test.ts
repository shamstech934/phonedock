import assert from 'node:assert/strict';
import { extractLinksFromHtml, extractLocsFromXml, isProbableProductUrl, matchProductUrlToPhone } from '../../src/lib/price-catalog-discovery';

assert.deepEqual(extractLocsFromXml('<urlset><url><loc>https://shop.test/p/samsung-galaxy-a55</loc></url></urlset>'), [
  'https://shop.test/p/samsung-galaxy-a55',
]);

assert.deepEqual(extractLinksFromHtml('<a href="/mobiles/samsung-galaxy-a55">A55</a><a href="javascript:void(0)">No</a>', 'https://shop.test/catalog'), [
  'https://shop.test/mobiles/samsung-galaxy-a55',
]);

assert.equal(isProbableProductUrl('https://shop.test/mobiles'), false);
assert.equal(isProbableProductUrl('https://shop.test/mobiles/samsung-galaxy-a55'), true);

assert.equal(isProbableProductUrl('https://www.whatmobile.com.pk/Samsung_Galaxy-A37'), true);
assert.equal(isProbableProductUrl('https://www.whatmobile.com.pk/Infinix_GT-50-Pro'), true);
assert.equal(isProbableProductUrl('https://www.whatmobile.com.pk/Vivo_X300-FE'), true);
assert.equal(isProbableProductUrl('https://www.whatmobile.com.pk/Apple_iPhone-16-Pro-Max'), true);
assert.equal(isProbableProductUrl('https://www.whatmobile.com.pk/Samsung_Mobiles_Prices'), false);
assert.equal(isProbableProductUrl('https://www.whatmobile.com.pk/Apple_Mobiles_Prices'), false);

const whatMobileLinks = extractLinksFromHtml('<a href="/Samsung_Galaxy-A37">A37</a><a href="/Samsung_Mobiles_Prices">Catalog</a>', 'https://www.whatmobile.com.pk/Samsung_Mobiles_Prices').filter(isProbableProductUrl);
assert.deepEqual(whatMobileLinks, ['https://www.whatmobile.com.pk/Samsung_Galaxy-A37']);

const phones = [
  { slug: 'samsung-galaxy-a55', modelName: 'Galaxy A55' },
  { slug: 'samsung-galaxy-a35', modelName: 'Galaxy A35' },
];
assert.equal(matchProductUrlToPhone('https://shop.test/mobiles/samsung-galaxy-a55-5g', phones)?.modelName, 'Galaxy A55');
assert.equal(matchProductUrlToPhone('https://shop.test/mobiles/samsung-galaxy', phones), null);
assert.equal(matchProductUrlToPhone('https://www.whatmobile.com.pk/Samsung_Galaxy-A37', [{ slug: 'samsung-galaxy-a37', modelName: 'Galaxy A37' }])?.modelName, 'Galaxy A37');
assert.equal(matchProductUrlToPhone('https://www.whatmobile.com.pk/Infinix_GT-50-Pro', [{ slug: 'infinix-gt-50-pro', modelName: 'GT 50 Pro' }])?.modelName, 'GT 50 Pro');
assert.equal(matchProductUrlToPhone('https://www.whatmobile.com.pk/Vivo_X300-FE', [{ slug: 'vivo-x300-fe', modelName: 'X300 FE' }])?.modelName, 'X300 FE');

console.log('Price catalog discovery tests passed');

// Numeric-only model names must still require their brand in the URL; a
// generic 14-inch laptop page must never auto-link to a phone model "14".
const numericPhone = [{ slug: 'xiaomi-14', modelName: '14', brandName: 'Xiaomi' }];
assert.equal(matchProductUrlToPhone('https://shop.test/laptops/14-inch-display-laptop', numericPhone), null);
assert.equal(matchProductUrlToPhone('https://shop.test/mobiles/xiaomi-14-5g', numericPhone)?.modelName, '14');
