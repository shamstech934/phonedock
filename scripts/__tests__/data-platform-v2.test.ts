import assert from 'node:assert/strict';
import { mapExternalRecord, getNestedValue } from '../../src/lib/collectors/field-mapper';
import { recordsFromXml } from '../../src/lib/collectors/providers/xml-provider';
import { createProvider } from '../../src/lib/collectors/providers';
import { scoreCollectedPhone, validateCollectedPhone } from '../../src/lib/collectors/services';

async function main() {
const config = { type: 'json_url' as const, enabled: true, mappingRules: { brand: 'device.brand.name', model: 'device.title', pakistanPrice: 'market.pk.price', ptaApproved: 'market.pk.pta' } };
const raw = { device: { brand: { name: ' Example ' }, title: 'Model X' }, market: { pk: { price: 'PKR 99,999', pta: 'yes' } }, specs: { ram: '8 GB' } };
assert.equal(getNestedValue(raw, 'device.brand.name'), ' Example ');
const phone = mapExternalRecord(raw, { ...config, mappingRules: { ...config.mappingRules, ram: 'specs.ram' } });
assert.equal(phone.brandName, 'Example'); assert.equal(phone.model, 'Model X'); assert.equal(phone.slug, 'example-model-x'); assert.equal(phone.pakistanPrice, 99999); assert.equal(phone.ptaApproved, true); assert.equal(phone.memory?.ram, '8 GB');

const xml = '<phones><phone><brand>Example</brand><model>Model Y</model><battery>5000 mAh</battery></phone></phones>';
assert.equal(recordsFromXml(xml, false).length, 1);
assert.throws(() => recordsFromXml('<!DOCTYPE x [<!ENTITY e "bad">]><phones/>', false), /not allowed/);
const rss = '<rss><channel><item><brand>Example</brand><model>Model Z</model></item></channel></rss>';
assert.equal(recordsFromXml(rss, true)[0].model, 'Model Z');

const issues = validateCollectedPhone(phone); const scores = scoreCollectedPhone(phone, issues, 0.8);
assert.ok(scores.completenessScore > 0 && scores.confidenceScore <= scores.qualityScore);
const manufacturer = createProvider({ type: 'manufacturer', enabled: false }, 'source', 'Vendor');
const result = await manufacturer.test(); assert.equal(result.success, false); assert.match(result.message, /approved adapter/i);

console.log('Data Platform v2 tests passed');
}

main().catch(error => { console.error(error); process.exit(1); });
