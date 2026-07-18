export const dynamic = 'force-dynamic';
export const revalidate = 300;
import { Star, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

export const metadata: Metadata = {
  title: 'User Reviews | PhoneDock Pakistan',
  description: 'Read real user reviews for smartphones in Pakistan',
  alternates: { canonical: `${BASE_URL}/reviews` },
  openGraph: {
    title: 'User Reviews | PhoneDock Pakistan',
    description: 'Read real user reviews for smartphones in Pakistan',
    url: `${BASE_URL}/reviews`,
    type: 'website',
  },
};

interface Review {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  phoneName: string;
  phoneSlug: string;
  createdAt: string;
}

async function getReviews(): Promise<Review[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/reviews?page=1&limit=20`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.reviews || data || [];
  } catch {
    return [];
  }
}

export default async function ReviewsPage() {
  const reviews = await getReviews();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">User Reviews</h1>
            <p className="text-sm text-muted-foreground mt-1">Read real user reviews for smartphones in Pakistan</p>
          </div>

          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="card-premium p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {review.userName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-gray-900">{review.userName || 'Anonymous'}</span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed mb-2">{review.comment}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {review.phoneSlug ? (
                          <span>
                            Reviewed:{' '}
                            <Link href={`/phones/${review.phoneSlug}`} className="text-blue-500 hover:text-blue-600 font-medium">
                              {review.phoneName || 'Unknown Phone'}
                            </Link>
                          </span>
                        ) : (
                          <span>Reviewed: {review.phoneName || 'Unknown Phone'}</span>
                        )}
                        {review.createdAt && (
                          <span>
                            {new Date(review.createdAt).toLocaleDateString('en-PK', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <MessageSquare className="w-14 h-14 mx-auto mb-4 opacity-15" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">No reviews yet</h3>
              <p className="text-sm">Check back later for user reviews</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}