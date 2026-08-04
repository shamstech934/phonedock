export const revalidate = 900;

import { Star, MessageSquare, Smartphone, PenLine, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

export const metadata: Metadata = {
  title: 'User Reviews',
  description: 'Read real user reviews for smartphones in Pakistan',
  alternates: { canonical: `${BASE_URL}/reviews` },
  openGraph: {
    title: 'User Reviews',
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
      <main className="flex-1 bg-slate-50/70">
        <div className="site-shell py-8 sm:py-12 animate-fade-in space-y-8">
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
            <section className="grid min-h-[430px] items-center gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
              <div className="max-w-2xl">
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-950 sm:text-3xl">Be the first to help Pakistan’s phone buyers</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Reviews appear here after they are submitted on a phone page and approved. Browse a phone you have used, then share a useful and honest experience.</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link href="/phones" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">
                    Browse phones <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/rankings" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                    Explore rankings
                  </Link>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl bg-slate-50 p-5">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                  <h3 className="mt-3 font-bold text-slate-900">Choose the exact phone</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-600">Open its detail page so your review is attached to the correct model.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-5">
                  <PenLine className="h-5 w-5 text-emerald-600" />
                  <h3 className="mt-3 font-bold text-slate-900">Write a genuine review</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-600">Mention performance, battery, camera and value instead of a one-word rating.</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
