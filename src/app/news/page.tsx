'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Newspaper, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import type { NewsItem } from '@/components/shared/types';

const PER_PAGE = 12;

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch('/api/news').then(r => r.json()).then(d => { setNews(d.news || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(news.map(n => n.category).filter(Boolean));
    return ['all', ...Array.from(cats).sort()];
  }, [news]);

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return news;
    return news.filter(n => n.category === categoryFilter);
  }, [news, categoryFilter]);

  useEffect(() => { setPage(1); }, [categoryFilter]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="skeleton-shimmer h-8 w-48 rounded-lg mb-2" />
            <div className="skeleton-shimmer h-5 w-64 rounded-md mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-56 rounded-2xl" />)}</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">News & Updates</h1>
            <p className="text-sm text-muted-foreground mt-1">Latest smartphone news, leaks, and reviews</p>
          </div>

          {/* Category Filters */}
          {categories.length > 2 && (
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    categoryFilter === cat
                      ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                      : 'bg-white/60 border border-gray-200/60 text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                  }`}
                >
                  {cat === 'all' ? 'All Categories' : cat}
                  {cat !== 'all' && (
                    <span className="ml-1.5 text-xs opacity-70">
                      {news.filter(n => n.category === cat).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {paginated.length > 0 ? (
            <>
              {/* Featured first article */}
              {page === 1 && paginated[0] && (
                <article className="card-premium overflow-hidden hover:shadow-lg hover:shadow-black/5 transition-all duration-300 cursor-pointer">
                  <div className="grid grid-cols-1 sm:grid-cols-2">
                    {paginated[0].imageUrl && (
                      <div className="bg-[#F8FAFC] aspect-video sm:aspect-auto flex items-center justify-center p-6">
                        <Image src={paginated[0].imageUrl} alt={paginated[0].title} width={400} height={300} className="object-contain rounded-xl max-h-64" unoptimized />
                      </div>
                    )}
                    <div className="p-5 sm:p-6 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-600 font-medium">{paginated[0].category}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(paginated[0].createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      </div>
                      <h2 className="font-bold text-lg sm:text-xl text-gray-900 leading-snug mb-2">{paginated[0].title}</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">{paginated[0].excerpt || paginated[0].content}</p>
                      {paginated[0].author && <p className="text-xs text-muted-foreground/70 flex items-center gap-1"><Users className="w-3 h-3" /> {paginated[0].author}</p>}
                    </div>
                  </div>
                </article>
              )}

              {/* Grid of remaining articles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(page === 1 ? paginated.slice(1) : paginated).map(n => (
                  <article key={n.id} className="card-premium p-5 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">
                    {n.imageUrl && (
                      <div className="bg-[#F8FAFC] rounded-xl mb-4 flex items-center justify-center p-4 aspect-video">
                        <Image src={n.imageUrl} alt={n.title} width={300} height={200} className="object-contain rounded-lg max-h-40" unoptimized />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-600 font-medium">{n.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <h2 className="font-bold text-base text-gray-900 leading-snug mb-2 line-clamp-2">{n.title}</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">{n.excerpt || n.content}</p>
                    {n.author && <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1"><Users className="w-3 h-3" /> {n.author}</p>}
                  </article>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button variant="outline" size="sm" className="rounded-xl" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <button key={pageNum} onClick={() => setPage(pageNum)} className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors ${pageNum === page ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25' : 'text-gray-600 hover:bg-gray-100'}`}>
                        {pageNum}
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="rounded-xl" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Newspaper className="w-14 h-14 mx-auto mb-4 opacity-15" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {categoryFilter !== 'all' ? `No news in "${categoryFilter}"` : 'No news yet'}
              </h3>
              <p className="text-sm mb-4">Check back later for updates</p>
              {categoryFilter !== 'all' && (
                <button onClick={() => setCategoryFilter('all')} className="text-sm text-blue-500 hover:text-blue-600 font-medium">View all categories</button>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}