import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Star, ChevronRight, MessageSquare, ArrowLeft, Camera, Cpu,
  Battery, Monitor, DollarSign, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { formatPrice } from '@/components/shared/formatPrice';
import type { Phone } from '@/components/shared/types';
export const revalidate = 900;

import { connectDB } from '@/lib/mongodb';
import { Phone as PhoneModel, PhoneSpecs, UserReview, Brand } from '@/lib/models';
import { phoneToJSON, buildSpecsMap, attachSpecsToRawPhones } from '@/app/api/[[...path]]/handlers/helpers';
import { serializeJsonLd } from '@/lib/json-ld';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk';

/* ── Types ─────────────────────────────────────────────────────────── */
interface PhoneData {
  _id: string;
  modelName: string;
  slug: string;
  thumbnail: string;
  pricePKR: number;
  originalPricePKR: number;
  brand?: { name: string; slug: string };
  overallRating: number;
  cameraScore: number;
  performanceScore: number;
  batteryScore: number;
  displayScore: number;
  valueScore: number;
  reviewSummary: string;
  reviewVerdict: string;
  pros: string;
  cons: string;
}

interface ReviewData {
  _id: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
}

/* ── Data fetchers ─────────────────────────────────────────────────── */
async function getPhoneWithReviews(slug: string): Promise<{ phone: PhoneData | null; reviews: ReviewData[] }> {
  try {
    await connectDB();

    const phoneDoc = await PhoneModel.findOne({
      slug,
      active: true,
      status: 'published',
    })
      .populate('brand', 'name slug')
      .select(
        'modelName slug thumbnail pricePKR originalPricePKR overallRating cameraScore performanceScore batteryScore displayScore valueScore reviewSummary reviewVerdict pros cons'
      )
      .lean();

    if (!phoneDoc) return { phone: null, reviews: [] };

    const reviews = await UserReview.find({
      phoneId: phoneDoc._id,
      status: 'approved',
    })
      .sort({ createdAt: -1 })
      .select('name rating comment createdAt')
      .lean();

    const phone: PhoneData = {
      _id: String(phoneDoc._id),
      modelName: phoneDoc.modelName,
      slug: phoneDoc.slug,
      thumbnail: phoneDoc.thumbnail || '',
      pricePKR: phoneDoc.pricePKR || 0,
      originalPricePKR: phoneDoc.originalPricePKR || 0,
      brand: phoneDoc.brand
        ? { name: String((phoneDoc.brand as { name?: string; slug?: string }).name), slug: String((phoneDoc.brand as { name?: string; slug?: string }).slug) }
        : undefined,
      overallRating: phoneDoc.overallRating || 0,
      cameraScore: phoneDoc.cameraScore || 0,
      performanceScore: phoneDoc.performanceScore || 0,
      batteryScore: phoneDoc.batteryScore || 0,
      displayScore: phoneDoc.displayScore || 0,
      valueScore: phoneDoc.valueScore || 0,
      reviewSummary: phoneDoc.reviewSummary || '',
      reviewVerdict: phoneDoc.reviewVerdict || '',
      pros: phoneDoc.pros || '',
      cons: phoneDoc.cons || '',
    };

    const reviewList: ReviewData[] = reviews.map((r) => ({
      _id: String(r._id),
      name: String(r.name),
      rating: Number(r.rating),
      comment: String(r.comment),
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
    }));

    return { phone, reviews: reviewList };
  } catch {
    return { phone: null, reviews: [] };
  }
}

async function getRelatedPhones(currentSlug: string, brandSlug?: string, limit = 4): Promise<Phone[]> {
  try {
    await connectDB();
    const query: Record<string, unknown> = {
      slug: { $ne: currentSlug },
      active: true,
      status: 'published',
    };
    if (brandSlug) {
      const brand = await Brand.findOne({ slug: brandSlug }).select('_id').lean();
      if (brand) query.brandId = brand._id;
    }

    const phones = await PhoneModel.find(query)
      .populate('brand', 'name slug logo')
      .select(
        'modelName slug thumbnail pricePKR originalPricePKR overallRating cameraScore performanceScore batteryScore displayScore valueScore ptaApproved ptaStatus releaseDate trending featured brand'
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Attach specs so Quick View works without extra fetches
    if (phones.length > 0) {
      const ids = phones.map((p) => p._id);
      const specsArr = await PhoneSpecs.find({ phoneId: { $in: ids } }).lean();
      const specsMap = buildSpecsMap(specsArr);
      return attachSpecsToRawPhones(phones, specsMap) as unknown as Phone[];
    }
    return phones.map((p) => phoneToJSON(p)) as Phone[];
  } catch {
    return [];
  }
}

/* ── generateMetadata (dynamic, no static params) ─────────────────── */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { phone, reviews } = await getPhoneWithReviews(slug);

  if (!phone) {
    return { title: 'Reviews Not Found' };
  }

  const title = `${phone.modelName} User Reviews & Ratings`;
  const reviewCount = reviews.length;
  const avgRating =
    reviewCount > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1)
      : phone.overallRating?.toFixed(1) || 'N/A';
  const description = `Read ${reviewCount} real user reviews for ${phone.modelName} in Pakistan. Average rating: ${avgRating}/5. Pros, cons, and detailed feedback.`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/reviews/${phone.slug}` },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/reviews/${phone.slug}`,
      type: 'article',
      images: phone.thumbnail
        ? [{ url: phone.thumbnail, width: 1200, height: 630, alt: phone.modelName }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: phone.thumbnail ? [phone.thumbnail] : undefined,
    },
  };
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`${sizeClass} ${i < Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
        />
      ))}
    </div>
  );
}

function ScoreBar({ label, score, icon: Icon }: { label: string; score: number; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-24 flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(score, 10)}0%`,
            backgroundColor:
              score >= 8
                ? '#22c55e'
                : score >= 6
                  ? '#3b82f6'
                  : score >= 4
                    ? '#f59e0b'
                    : '#ef4444',
          }}
        />
      </div>
      <span className="text-xs font-bold text-gray-700 w-6 text-right">{score}</span>
    </div>
  );
}

/* ── Page Component ────────────────────────────────────────────────── */
export default async function PhoneReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ phone, reviews }] = await Promise.all([
    getPhoneWithReviews(slug),
  ]);

  if (!phone) {
    notFound();
  }

  const relatedPhones = await getRelatedPhones(slug, phone.brand?.slug);

  const avgUserRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: reviews.length > 0 ? ((reviews.filter((r) => r.rating === star).length / reviews.length) * 100) : 0,
  }));

  const prosList = phone.pros ? phone.pros.split('\n').filter(Boolean) : [];
  const consList = phone.cons ? phone.cons.split('\n').filter(Boolean) : [];

  /* JSON-LD structured data */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: phone.modelName,
    image: phone.thumbnail || undefined,
    brand: phone.brand ? { '@type': 'Brand', name: phone.brand.name } : undefined,
    url: `${BASE_URL}/reviews/${phone.slug}`,
    offers: phone.pricePKR > 0 ? {
      '@type': 'Offer',
      price: phone.pricePKR,
      priceCurrency: 'PKR',
      availability: 'https://schema.org/InStock',
      url: `${BASE_URL}/phones/${phone.slug}`,
    } : undefined,
    aggregateRating: reviews.length > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: avgUserRating.toFixed(1),
      bestRating: 5,
      worstRating: 1,
      reviewCount: reviews.length,
    } : undefined,
    review: reviews.slice(0, 20).map((review) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: review.name },
      datePublished: review.createdAt || undefined,
      reviewBody: review.comment,
      reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 5, worstRating: 1 },
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Reviews', item: `${BASE_URL}/reviews` },
      { '@type': 'ListItem', position: 3, name: phone.modelName, item: `${BASE_URL}/reviews/${phone.slug}` },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />

        <div className="max-w-5xl mx-auto px-4 py-4 sm:py-6 animate-fade-in">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
            <Link href="/" className="hover:text-blue-500 transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/reviews" className="hover:text-blue-500 transition-colors">Reviews</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700 font-medium truncate max-w-[200px] sm:max-w-[300px]">{phone.modelName}</span>
          </nav>

          {/* Back link */}
          <Link
            href="/reviews"
            className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Reviews
          </Link>

          {/* Phone Header */}
          <div className="card-premium p-5 sm:p-8 mb-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Phone Image */}
              <div className="bg-[#F8FAFC] rounded-2xl p-4 sm:p-6 flex items-center justify-center w-full sm:w-48 h-48 sm:h-48 flex-shrink-0">
                {phone.thumbnail ? (
                  <Image
                    src={phone.thumbnail}
                    alt={phone.modelName}
                    width={200}
                    height={200}
                    className="object-contain max-h-40 w-auto"
                    unoptimized
                    priority
                  />
                ) : (
                  <div className="text-muted-foreground/30">
                    <MessageSquare className="w-16 h-16" />
                  </div>
                )}
              </div>

              {/* Phone Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {phone.brand && (
                    <Link
                      href={`/brands/${phone.brand.slug}`}
                      className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                    >
                      {phone.brand.name}
                    </Link>
                  )}
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight mb-2">
                  {phone.modelName} Reviews
                </h1>
                <p className="text-sm text-muted-foreground mb-4">
                  Real user reviews and ratings from Pakistan
                </p>

                {/* Price */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-2xl font-bold text-gray-900">
                    {formatPrice(phone.pricePKR)}
                  </span>
                  {phone.originalPricePKR > phone.pricePKR && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(phone.originalPricePKR)}
                    </span>
                  )}
                </div>

                {/* Quick link to phone page */}
                <Link
                  href={`/phones/${phone.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors"
                >
                  View Full Specifications &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* Rating Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Overall Score Card */}
            <div className="card-premium p-6 text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2">Overall Rating</p>
              <div className="text-5xl font-extrabold text-gray-900 mb-2">
                {(avgUserRating > 0 ? avgUserRating : phone.overallRating || 0).toFixed(1)}
              </div>
              <div className="flex justify-center mb-3">
                <StarRating rating={avgUserRating > 0 ? avgUserRating : phone.overallRating || 0} size="lg" />
              </div>
              <p className="text-sm text-muted-foreground">
                Based on {reviews.length} user review{reviews.length !== 1 ? 's' : ''}
              </p>
              {avgUserRating > 0 && phone.overallRating > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-muted-foreground">
                    Expert rating: <span className="font-bold text-gray-700">{phone.overallRating.toFixed(1)}/10</span>
                  </p>
                </div>
              )}
            </div>

            {/* Rating Distribution */}
            <div className="card-premium p-6">
              <p className="text-sm font-medium text-gray-700 mb-4">Rating Distribution</p>
              <div className="space-y-2.5">
                {ratingDistribution.map(({ star, count, pct }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 w-6">{star}</span>
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
              {reviews.length === 0 && (
                <p className="text-sm text-muted-foreground text-center mt-4">No user ratings yet</p>
              )}
            </div>

            {/* Expert Scores */}
            <div className="card-premium p-6">
              <p className="text-sm font-medium text-gray-700 mb-4">Expert Scores</p>
              <div className="space-y-3">
                <ScoreBar label="Camera" score={phone.cameraScore} icon={Camera} />
                <ScoreBar label="Performance" score={phone.performanceScore} icon={Cpu} />
                <ScoreBar label="Battery" score={phone.batteryScore} icon={Battery} />
                <ScoreBar label="Display" score={phone.displayScore} icon={Monitor} />
                <ScoreBar label="Value" score={phone.valueScore} icon={DollarSign} />
              </div>
            </div>
          </div>

          {/* Pros & Cons */}
          {(prosList.length > 0 || consList.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {prosList.length > 0 && (
                <div className="card-premium p-5">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-green-600 mb-3">
                    <ThumbsUp className="w-4 h-4" />
                    Pros
                  </h3>
                  <ul className="space-y-2">
                    {prosList.map((pro, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-green-500 mt-0.5 flex-shrink-0">+</span>
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {consList.length > 0 && (
                <div className="card-premium p-5">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-red-500 mb-3">
                    <ThumbsDown className="w-4 h-4" />
                    Cons
                  </h3>
                  <ul className="space-y-2">
                    {consList.map((con, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5 flex-shrink-0">&minus;</span>
                        {con}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Expert Review Summary */}
          {phone.reviewSummary && (
            <div className="card-premium p-5 sm:p-6 mb-6">
              <h2 className="font-display text-lg font-bold text-gray-900 mb-3">Expert Review</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{phone.reviewSummary}</p>
              {phone.reviewVerdict && (
                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs font-bold text-blue-600 mb-1">VERDICT</p>
                  <p className="text-sm text-blue-800 font-medium">{phone.reviewVerdict}</p>
                </div>
              )}
            </div>
          )}

          {/* User Reviews */}
          <div className="mb-6">
            <h2 className="font-display text-xl font-extrabold text-gray-900 mb-4">
              User Reviews ({reviews.length})
            </h2>

            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review._id} className="card-premium p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {review.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-gray-900">
                            {review.name || 'Anonymous'}
                          </span>
                          <StarRating rating={review.rating} size="sm" />
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed mb-2">
                          {review.comment}
                        </p>
                        {review.createdAt && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString('en-PK', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card-premium p-8 text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground/15" />
                <h3 className="text-base font-bold text-gray-900 mb-1">No user reviews yet</h3>
                <p className="text-sm text-muted-foreground">
                  Be the first to review the {phone.modelName}
                </p>
                <Link
                  href={`/phones/${phone.slug}`}
                  className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 shadow-sm shadow-blue-500/25 transition-colors"
                >
                  Write a Review
                </Link>
              </div>
            )}
          </div>

          {/* Related Phones */}
          {relatedPhones.length > 0 && (
            <section className="mt-10 pt-8 border-t border-gray-200/60">
              <h2 className="font-display text-xl font-extrabold text-gray-900 mb-6">
                Explore More Phones
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {relatedPhones.map((phone) => (
                  <div key={phone.id} className="group">
                    <PhoneCard phone={phone} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
