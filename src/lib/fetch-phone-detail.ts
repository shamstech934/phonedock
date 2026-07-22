/**
 * Shared server-side phone detail fetcher.
 * React cache deduplicates generateMetadata() and page rendering within a request,
 * so the main phone payload is loaded only once.
 */

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import {
  Phone,
  PhoneSpecs,
  PhoneBenchmark,
  PhoneImage,
  PhonePrice,
  Video,
  CollectedPhone,
  UserReview,
} from '@/lib/models';
import {
  connectDB,
  phoneToJSON,
  buildSpecsMap,
  attachSpecsToRawPhones,
  type PhoneDocOrJson,
} from '@/app/api/[[...path]]/handlers/helpers';
import { normalizePhoneSpecs, normalizedToSerialized } from '@/lib/normalize-specs';
import type { Phone as PhoneJson } from '@/components/shared/types';

export interface PhoneDetailData {
  phone: PhoneJson;
  related: PhoneJson[];
}

const loadPhoneDetail = cache(async (slug: string): Promise<PhoneDetailData | null> => {
  await connectDB();

  const phone = await Phone.findOne({ slug, active: true, status: 'published' })
    .populate('brand')
    .lean();

  if (!phone) return null;

  const [specsDoc, benchmarks, images, prices, related, phoneVideos, collectedDoc, reviewStats] = await Promise.all([
    PhoneSpecs.findOne({ phoneId: phone._id }).lean(),
    PhoneBenchmark.findOne({ phoneId: phone._id }).lean(),
    PhoneImage.find({ phoneId: phone._id }).sort({ sortOrder: 1 }).lean(),
    PhonePrice.find({ phoneId: phone._id }).limit(10).lean(),
    Phone.find({
      active: true,
      status: 'published',
      _id: { $ne: phone._id },
      modelName: { $not: /\b(tablet|tab|pad)\b/i },
      ...(Number(phone.pricePKR) > 0
        ? {
            pricePKR: {
              $gt: 0,
              $gte: Math.max(1, Number(phone.pricePKR) * 0.72),
              $lte: Number(phone.pricePKR) * 1.28,
            },
          }
        : { brandId: phone.brandId }),
    })
      .select('-description -pros -cons -reviewSummary -reviewVerdict -seoTitle -seoDescription -keywords -sourceName -sourceUrl')
      .sort({ overallRating: -1, valueScore: -1, createdAt: -1 })
      .limit(12)
      .populate('brand')
      .lean(),
    Video.find({ phoneId: phone._id, active: true }).sort({ publishedAt: -1 }).lean(),
    CollectedPhone.findOne({ approvedPhoneId: phone._id, status: { $in: ['approved', 'imported'] } }).lean(),
    UserReview.aggregate([
      { $match: { phoneId: phone._id, status: 'approved' } },
      { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } },
    ]),
  ]);

  const normalizedSpecs = normalizePhoneSpecs(
    specsDoc as Record<string, unknown> | null,
    phone as unknown as Record<string, unknown>,
    collectedDoc as Record<string, unknown> | null,
  );
  const serializedSpecs = normalizedSpecs ? normalizedToSerialized(normalizedSpecs) : undefined;
  const phoneJSON = phoneToJSON(
    phone as unknown as PhoneDocOrJson,
    serializedSpecs,
    benchmarks as unknown as Record<string, unknown> | undefined,
    images as unknown as Record<string, unknown>[],
    prices as unknown as Record<string, unknown>[],
  ) as unknown as PhoneJson;

  const approvedReviewStats = reviewStats[0] as { count?: number; average?: number } | undefined;
  (phoneJSON as unknown as Record<string, unknown>).userReviewCount = approvedReviewStats?.count || 0;
  (phoneJSON as unknown as Record<string, unknown>).userReviewAverage = approvedReviewStats?.average
    ? Math.round(approvedReviewStats.average * 10) / 10
    : 0;

  (phoneJSON as unknown as Record<string, unknown>).videos = phoneVideos.map((video) => ({
    id: video._id?.toString(),
    youtubeId: video.youtubeId,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
  }));

  const relatedIds = related.map((item) => item._id?.toString()).filter(Boolean);
  const relatedSpecs = relatedIds.length
    ? await PhoneSpecs.find({ phoneId: { $in: relatedIds } }).lean()
    : [];
  const relatedJSON = attachSpecsToRawPhones(
    related as unknown as PhoneDocOrJson[],
    buildSpecsMap(relatedSpecs as unknown as Record<string, unknown>[]),
  ) as unknown as PhoneJson[];

  return { phone: phoneJSON, related: relatedJSON };
});
export const fetchPhoneDetail = unstable_cache(loadPhoneDetail, ['public-phone-detail-v1'], { revalidate: 300, tags: ['phones', 'reviews', 'prices'] });

/** Backwards-compatible metadata helper. */
export async function fetchPhoneDetailForMetadata(slug: string) {
  const data = await fetchPhoneDetail(slug);
  return data?.phone ?? null;
}
