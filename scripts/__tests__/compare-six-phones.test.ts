import assert from 'node:assert/strict';
import { MAX_COMPARE_PHONES, MIN_COMPARE_PHONES, canAddComparePhone, normalizeCompareValues } from '../../src/lib/compare';

assert.equal(MIN_COMPARE_PHONES, 2);
assert.equal(MAX_COMPARE_PHONES, 6);
assert.deepEqual(normalizeCompareValues('a,b,c,d,e,f,g'), ['a','b','c','d','e','f']);
assert.deepEqual(normalizeCompareValues(' a, b,a, ,c '), ['a','b','c']);
assert.equal(canAddComparePhone(5), true);
assert.equal(canAddComparePhone(6), false);
console.log('Compare six-phone behavior: 6/6 checks passed');
