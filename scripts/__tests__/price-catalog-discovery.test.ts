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

const phones = [
  { slug: 'samsung-galaxy-a55', modelName: 'Galaxy A55' },
  { slug: 'samsung-galaxy-a35', modelName: 'Galaxy A35' },
];
assert.equal(matchProductUrlToPhone('https://shop.test/mobiles/samsung-galaxy-a55-5g', phones)?.modelName, 'Galaxy A55');
assert.equal(matchProductUrlToPhone('https://shop.test/mobiles/samsung-galaxy', phones), null);

console.log('Price catalog discovery tests passed');
