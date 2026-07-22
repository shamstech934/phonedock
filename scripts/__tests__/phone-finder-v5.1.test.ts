import assert from 'node:assert/strict';
import { parsePhoneFinderQuery } from '../../src/lib/phone-finder/parse-query';

const cases = [
  ['50k ke andar gaming phone with 8GB RAM and 5G', { price:'40k-60k', ram:'8', fiveG:'yes', sort:'trending' }],
  ['1 lakh tak best camera phone 108MP', { price:'60k-100k', camera:'108', sort:'rating' }],
  ['PTA approved Samsung AMOLED phone', { brand:'samsung', pta:'approved', display:'amoled' }],
  ['cheap techno phone under 30000', { brand:'tecno', price:'20k-40k', sort:'price-low' }],
  ['One Plus Snapdragon phone 256GB storage', { brand:'oneplus', chipset:'Snapdragon', storage:'256' }],
] as const;
for (const [query, expected] of cases) {
  const result = parsePhoneFinderQuery(query);
  for (const [key,value] of Object.entries(expected)) assert.equal(result.params.get(key), value, `${query}: ${key}`);
  assert.ok(result.confidence >= 45);
}
console.log('phone-finder-v5.1: all tests passed');
