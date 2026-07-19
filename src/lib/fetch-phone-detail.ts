/**
 * Server-side phone detail data fetcher for SSR metadata generation.
 * Minimal version — fetches only the fields needed for metadata.
 */

import { Phone } from '@/lib/models';
import { connectDB } from '@/app/api/[[...path]]/handlers/helpers';

export async function fetchPhoneDetailForMetadata(slug: string) {
  await connectDB();

  const phone = await Phone.findOne({ slug, active: true, status: 'published' })
    .select('modelName slug pricePKR thumbnail description brandId overallRating releaseDate ptaApproved updatedAt')
    .populate('brand', 'name slug')
    .lean();

  return phone;
}