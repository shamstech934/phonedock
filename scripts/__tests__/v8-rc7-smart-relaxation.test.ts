import assert from 'node:assert/strict';
import { buildSmartSearchPlans, parseSmartSearch } from '../../src/lib/search/parse-smart-search';

const intent = parseSmartSearch('80k ke andar best gaming phone 8GB RAM 5G');
const plans = buildSmartSearchPlans(intent);

assert.equal(intent.maxPrice, 80000);
assert.equal(intent.ram, 8);
assert.equal(intent.fiveG, 'yes');
assert.equal(intent.sort, 'performance');
assert.ok(plans.length >= 3, 'expected progressive fallback plans');
assert.equal(plans[0].isExact, true);
assert.match(plans[0].url, /priceMax=80000/);
assert.match(plans[0].url, /ram=8/);
assert.match(plans[0].url, /5g=yes/);
assert.ok(plans.some(plan => !plan.url.includes('5g=yes')), '5G should be relaxed');
assert.ok(plans.some(plan => !plan.url.includes('ram=8')), 'RAM should be relaxed');
assert.ok(plans.every(plan => plan.url.includes('priceMax=80000')), 'budget must be preserved');
assert.ok(plans.every(plan => plan.url.includes('sort=performance')), 'primary intent must be preserved');

console.log('v8 RC7 smart relaxation tests passed');
