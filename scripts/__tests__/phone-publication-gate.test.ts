import assert from 'node:assert/strict';
import { getPhonePublicationIssues, getPublicPhoneFilter } from '../../src/lib/phone-publication.ts';

const complete = {
  brandId: 'brand-id',
  modelName: 'PhoneDock One',
  slug: 'phonedock-one',
  thumbnail: '/images/phonedock-one.webp',
  pricePKR: 99_999,
  upcoming: false,
};

assert.deepEqual(getPhonePublicationIssues(complete), []);
assert.deepEqual(
  getPhonePublicationIssues({ ...complete, thumbnail: '', pricePKR: 0 }),
  ['Thumbnail is required', 'A positive price is required unless the phone is marked upcoming'],
);
assert.deepEqual(getPhonePublicationIssues({ ...complete, pricePKR: 0, upcoming: true }), []);
assert.match(getPhonePublicationIssues({})[0], /Brand/);

assert.deepEqual(getPublicPhoneFilter(), {
  active: true,
  status: 'published',
  deletedAt: null,
});
assert.deepEqual(getPublicPhoneFilter({ cardReady: true }), {
  active: true,
  status: 'published',
  deletedAt: null,
  thumbnail: { $type: 'string', $nin: ['', null] },
  pricePKR: { $gt: 0 },
});
assert.equal('pricePKR' in getPublicPhoneFilter({ cardReady: true, upcoming: true }), false);

console.log('Phone publication gate tests passed');
