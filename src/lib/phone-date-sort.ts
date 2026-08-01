/**
 * Canonical phone chronology used across public and admin listings.
 *
 * Phone dates are stored as ISO-like strings for backward compatibility with
 * older imports. ISO dates (YYYY-MM-DD) and year-only values sort correctly as
 * strings. Every later field acts as a fallback when the earlier field is
 * blank, while createdAt/_id provide deterministic ordering for legacy rows.
 */
export const PHONE_NEWEST_SORT: Record<string, 1 | -1> = {
  releaseDate: -1,
  availableFrom: -1,
  pakistanLaunchAt: -1,
  announcedAt: -1,
  expectedLaunchAt: -1,
  createdAt: -1,
  _id: -1,
};

export const PHONE_OLDEST_SORT: Record<string, 1 | -1> = {
  releaseDate: 1,
  availableFrom: 1,
  pakistanLaunchAt: 1,
  announcedAt: 1,
  expectedLaunchAt: 1,
  createdAt: 1,
  _id: 1,
};

/** Add chronology as a deterministic tie-breaker after a ranking field. */
export function rankedPhoneSort(field: string, order: 1 | -1 = -1): Record<string, 1 | -1> {
  return { [field]: order, ...PHONE_NEWEST_SORT };
}
