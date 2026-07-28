import assert from 'node:assert/strict';
import { HOMEPAGE_SECTION_ORDER, normalizeHomepageSectionOrder } from '../../src/lib/homepage-builder.ts';

assert.deepEqual(normalizeHomepageSectionOrder(undefined), [...HOMEPAGE_SECTION_ORDER]);
assert.deepEqual(
  normalizeHomepageSectionOrder(['videos', 'latest', 'videos', 'invalid']),
  ['videos', 'latest', ...HOMEPAGE_SECTION_ORDER.filter(key => !['videos', 'latest'].includes(key))],
);
assert.equal(normalizeHomepageSectionOrder([]).length, HOMEPAGE_SECTION_ORDER.length);

console.log('Homepage builder tests passed');
