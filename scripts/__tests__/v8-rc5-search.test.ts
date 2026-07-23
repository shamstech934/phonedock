import assert from 'node:assert/strict';
import { parseSmartSearch, smartSearchToPhonesUrl } from '../../src/lib/search/parse-smart-search';

const gaming = parseSmartSearch('80k ke andar best gaming phone 8GB RAM 5G PTA approved');
assert.equal(gaming.maxPrice, 80000);
assert.equal(gaming.ram, 8);
assert.equal(gaming.fiveG, 'yes');
assert.equal(gaming.pta, 'approved');
assert.equal(gaming.sort, 'performance');
assert.match(smartSearchToPhonesUrl(gaming), /priceMax=80000/);

const camera = parseSmartSearch('1 lakh se kam AMOLED camera phone');
assert.equal(camera.maxPrice, 100000);
assert.equal(camera.display, 'AMOLED');
assert.equal(camera.sort, 'camera');

const range = parseSmartSearch('50k to 80k Snapdragon 120Hz');
assert.equal(range.minPrice, 50000);
assert.equal(range.maxPrice, 80000);
assert.equal(range.refresh, 120);
assert.equal(range.chipset, 'Snapdragon');

console.log('PhoneDock v8 RC5 smart-search checks passed');
