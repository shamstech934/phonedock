import assert from 'node:assert/strict';
import {
  PHONE_AVAILABILITY_LABELS,
  PHONE_AVAILABILITY_STATUSES,
  isPhoneAvailabilityStatus,
} from '../../src/lib/phone-lifecycle.ts';

assert.equal(PHONE_AVAILABILITY_STATUSES.length, 7);
assert.equal(PHONE_AVAILABILITY_LABELS.coming_soon, 'Coming Soon');
assert.equal(PHONE_AVAILABILITY_LABELS.discontinued, 'Discontinued');
assert.equal(isPhoneAvailabilityStatus('available'), true);
assert.equal(isPhoneAvailabilityStatus('latest'), false);
assert.equal(isPhoneAvailabilityStatus(''), false);

console.log('Phone lifecycle tests passed');
