import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildMonitoringPhoneMetricsPipeline,
  NON_PTA_PATTERN,
  PTA_APPROVED_PATTERN,
} from '../../src/lib/continuous-monitoring-query';

type PhoneFixture = {
  id: string;
  status?: string;
  pricePKR?: unknown;
  originalPricePKR?: unknown;
  ptaApproved?: boolean;
  ptaStatus?: unknown;
  upcoming?: boolean;
  availabilityStatus?: string;
  discontinuedAt?: unknown;
  thumbnail?: unknown;
};

type SpecFixture = {
  phoneId: string;
  updatedAt?: Date;
  chipset?: unknown;
  ram?: unknown;
  storage?: unknown;
  display?: unknown;
  battery?: unknown;
  mainCamera?: unknown;
};

type ImageFixture = { phoneId: string; verified?: boolean; status?: string };

function isPositive(value: unknown): boolean {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0;
}

function legacyMetrics(phones: PhoneFixture[], specs: SpecFixture[], images: ImageFixture[], staleCutoff: Date) {
  const specMap = new Map(specs.map((spec) => [spec.phoneId, spec]));
  const imageGroups = new Map<string, ImageFixture[]>();
  for (const image of images.filter((item) => item.status !== 'rejected')) {
    imageGroups.set(image.phoneId, [...(imageGroups.get(image.phoneId) || []), image]);
  }
  return {
    totalPhones: phones.length,
    publishedPhones: phones.filter((phone) => phone.status === 'published').length,
    missingSpecs: phones.filter((phone) => !specMap.has(phone.id)).length,
    incompleteSpecs: phones.filter((phone) => {
      const spec = specMap.get(phone.id);
      return Boolean(spec) && ![spec?.chipset, spec?.ram, spec?.storage, spec?.display, spec?.battery, spec?.mainCamera]
        .every((value) => String(value || '').trim());
    }).length,
    staleSpecs: phones.filter((phone) => {
      const updatedAt = specMap.get(phone.id)?.updatedAt;
      return Boolean(updatedAt && updatedAt < staleCutoff);
    }).length,
    missingImages: phones.filter((phone) => !String(phone.thumbnail || '').trim() && !(imageGroups.get(phone.id) || []).length).length,
    unverifiedImages: phones.filter((phone) => {
      const rows = imageGroups.get(phone.id) || [];
      return rows.length > 0 && !rows.some((image) => image.verified === true);
    }).length,
    missingPrices: phones.filter((phone) => !isPositive(phone.pricePKR)).length,
    discountedPhones: phones.filter((phone) => isPositive(phone.pricePKR) && Number(phone.originalPricePKR || 0) > Number(phone.pricePKR || 0)).length,
    upcomingPhones: phones.filter((phone) => phone.upcoming === true || ['rumored', 'announced', 'coming_soon'].includes(String(phone.availabilityStatus || ''))).length,
    discontinuedPhones: phones.filter((phone) => phone.availabilityStatus === 'discontinued' || Boolean(String(phone.discontinuedAt || '').trim())).length,
    ptaApprovedPhones: phones.filter((phone) => phone.ptaApproved === true || PTA_APPROVED_PATTERN.test(String(phone.ptaStatus || ''))).length,
    nonPtaPhones: phones.filter((phone) => NON_PTA_PATTERN.test(String(phone.ptaStatus || ''))).length,
  };
}

const staleCutoff = new Date('2026-04-01T00:00:00.000Z');
const phones: PhoneFixture[] = [
  { id: '1', status: 'published', pricePKR: null, ptaStatus: 'Approved' },
  { id: '2', status: 'published', pricePKR: 0, ptaStatus: 'Non-PTA', availabilityStatus: 'available' },
  { id: '3', status: 'published', pricePKR: -1, ptaStatus: 'not approved', availabilityStatus: 'announced' },
  { id: '4', status: 'published', pricePKR: 100, originalPricePKR: 150, ptaStatus: 'unapproved', discontinuedAt: new Date('2025-01-01'), thumbnail: 'phone.jpg' },
  { id: '5', status: 'published', pricePKR: 200, originalPricePKR: 100, ptaApproved: true, ptaStatus: null, availabilityStatus: 'discontinued', thumbnail: 'phone.jpg' },
  { id: '6', status: 'draft', pricePKR: 50, upcoming: true, ptaStatus: '' },
];
const completeSpec = { chipset: 'chip', ram: '8 GB', storage: '128 GB', display: 'AMOLED', battery: '5000 mAh', mainCamera: '50 MP' };
const specs: SpecFixture[] = [
  { phoneId: '2', updatedAt: new Date('2025-01-01'), ...completeSpec },
  { phoneId: '3', updatedAt: new Date('2026-07-01'), ...completeSpec, chipset: '' },
  { phoneId: '5', updatedAt: new Date('2026-07-01'), ...completeSpec },
  { phoneId: '6', updatedAt: new Date('2026-07-01'), ...completeSpec },
];
const images: ImageFixture[] = [
  { phoneId: '2', verified: false, status: 'active' },
  { phoneId: '3', verified: true, status: 'active' },
  { phoneId: '6', verified: true, status: 'rejected' },
];

assert.deepEqual(legacyMetrics(phones, specs, images, staleCutoff), {
  totalPhones: 6,
  publishedPhones: 5,
  missingSpecs: 2,
  incompleteSpecs: 1,
  staleSpecs: 1,
  missingImages: 2,
  unverifiedImages: 1,
  missingPrices: 3,
  discountedPhones: 1,
  upcomingPhones: 2,
  discontinuedPhones: 2,
  ptaApprovedPhones: 4,
  nonPtaPhones: 3,
});

// Preserve the legacy regex overlap: these values count in both buckets.
for (const value of ['not approved', 'unapproved']) {
  assert.equal(PTA_APPROVED_PATTERN.test(value), true);
  assert.equal(NON_PTA_PATTERN.test(value), true);
}

const pipeline = buildMonitoringPhoneMetricsPipeline({
  phoneSpecsCollection: 'phonespecs',
  phoneImagesCollection: 'phoneimages',
  staleSpecsCutoff: staleCutoff,
});
assert.deepEqual(pipeline[0], { $match: { deletedAt: null } });
const group = pipeline.find((stage) => '$group' in stage) as { $group: Record<string, unknown> };
for (const key of Object.keys(legacyMetrics(phones, specs, images, staleCutoff))) {
  assert.ok(key in group.$group, `aggregation must calculate ${key}`);
}

const monitoringSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/continuous-monitoring.ts'), 'utf8');
assert.equal(monitoringSource.includes('phoneRows.filter('), false, 'full phoneRows filter scans must not return');
assert.equal(monitoringSource.includes('Phone.find(phoneFilter)'), false, 'full Phone documents must not be loaded');
assert.match(monitoringSource, /Phone\.aggregate<MonitoringPhoneMetrics>/);
assert.match(monitoringSource, /acquireMonitoringLock/);
assert.match(monitoringSource, /'metadata\.token': token/);

const revalidationSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/revalidate.ts'), 'utf8');
const priceCronSource = fs.readFileSync(path.join(process.cwd(), 'src/app/api/[[...path]]/handlers/cron-update-prices.ts'), 'utf8');
assert.match(revalidationSource, /export function revalidatePriceBatch/);
assert.match(priceCronSource, /revalidatePriceBatch\(uniqueSlugs\)/);
assert.equal(priceCronSource.includes('for (const slug of uniqueSlugs)'), false, 'shared price paths must not be invalidated once per updated phone');

console.log('continuous-monitoring performance regression tests passed');
