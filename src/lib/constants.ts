/** Cache TTL in seconds */
export const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 600,
} as const;

/** Page size limits */
export const PAGE_SIZE = {
  DEFAULT: 20,
  MAX: 100,
  AUTOCOMPLETE: 20,
} as const;

/** Rate limit configs: [maxRequests, windowMs] */
export const RATE_LIMITS = {
  LOGIN: { max: 10, window: 60_000 },
  CONTACT: { max: 3, window: 3600_000 },
  NEWSLETTER: { max: 3, window: 3600_000 },
  PRICE_ALERT: { max: 5, window: 3600_000 },
  SEARCH: { max: 30, window: 60_000 },
} as const;