import assert from 'node:assert/strict';
import { buildPriceVariantKey, normalizeMemoryLabel, normalizeColorLabel, normalizeCondition, variantMatchesSelection } from '../../src/lib/price-variant';

assert.equal(normalizeMemoryLabel('12 gb'), '12GB');
assert.equal(normalizeMemoryLabel('1 tb'), '1TB');
assert.equal(normalizeColorLabel('Titanium Black'), 'titanium-black');
assert.equal(normalizeCondition('Open Box'), 'open-box');
const key = buildPriceVariantKey({ ram: '12 GB', storage: '512GB', color: 'Titanium Black', ptaStatus: 'PTA Approved', condition: 'new', warrantyType: 'official' });
assert.equal(key, 'ram:12GB|storage:512GB|color:titanium-black|pta:pta-approved|condition:new|warranty:official');
assert.equal(variantMatchesSelection({ ram:'12GB', storage:'512GB', color:'Titanium Black', ptaStatus:'PTA Approved' }, { ram:'12 gb', storage:'512GB', color:'titanium black', priceClass:'pta-approved' }), true);
assert.equal(variantMatchesSelection({ ram:'12GB', storage:'512GB', color:'Black', ptaStatus:'Non-PTA' }, { ram:'12GB', storage:'512GB', color:'Black', priceClass:'pta-approved' }), false);
console.log('price variant engine tests passed');
