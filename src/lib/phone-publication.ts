export interface PhonePublicationCandidate {
  brandId?: unknown;
  modelName?: unknown;
  slug?: unknown;
  thumbnail?: unknown;
  pricePKR?: unknown;
  upcoming?: unknown;
}

export function getPhonePublicationIssues(phone: PhonePublicationCandidate): string[] {
  const issues: string[] = [];
  if (!phone.brandId) issues.push('Brand is required');
  if (typeof phone.modelName !== 'string' || !phone.modelName.trim()) issues.push('Model name is required');
  if (typeof phone.slug !== 'string' || !phone.slug.trim()) issues.push('Slug is required');
  if (typeof phone.thumbnail !== 'string' || !phone.thumbnail.trim()) issues.push('Thumbnail is required');

  const price = Number(phone.pricePKR);
  if (phone.upcoming !== true && (!Number.isFinite(price) || price <= 0)) {
    issues.push('A positive price is required unless the phone is marked upcoming');
  }
  return issues;
}

export function getPublicPhoneFilter(options: { cardReady?: boolean; upcoming?: boolean } = {}) {
  const filter: Record<string, unknown> = {
    active: true,
    status: 'published',
    deletedAt: null,
  };

  if (options.upcoming) filter.upcoming = true;
  if (options.cardReady) {
    filter.thumbnail = { $type: 'string', $nin: ['', null] };
    if (!options.upcoming) filter.pricePKR = { $gt: 0 };
  }
  return filter;
}
