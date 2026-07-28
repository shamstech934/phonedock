export const PHONE_AVAILABILITY_STATUSES = [
  'rumored',
  'announced',
  'coming_soon',
  'available',
  'limited',
  'discontinued',
  'cancelled',
] as const;

export type PhoneAvailabilityStatus = typeof PHONE_AVAILABILITY_STATUSES[number];

export const PHONE_AVAILABILITY_LABELS: Record<PhoneAvailabilityStatus, string> = {
  rumored: 'Rumored',
  announced: 'Announced',
  coming_soon: 'Coming Soon',
  available: 'Available',
  limited: 'Limited Availability',
  discontinued: 'Discontinued',
  cancelled: 'Cancelled',
};

export function isPhoneAvailabilityStatus(value: unknown): value is PhoneAvailabilityStatus {
  return typeof value === 'string' && PHONE_AVAILABILITY_STATUSES.includes(value as PhoneAvailabilityStatus);
}
