'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

interface VideoItem {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  phone: { modelName: string; slug: string; brand: string; thumbnail: string } | null;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  const closeModal = useCallback(() => setActiveVideo(null), []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/videos?page=${page}&limit=12`)
      .then(r => r.json())
      .then(d => {
        setVideos(d.videos || []);
        setTotalPages(d.totalPages || 1);
        setTotal(d.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (activeVideo) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [activeVideo, closeModal]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in">
          <div className="mb-6">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">Video Reviews</h1>
            <p className="text-sm text-muted-foreground mt-1">{total} video{total !== 1 ? 's' : ''} in our database</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array(8).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer aspect-video rounded-2xl" />)}
            </div>
          ) : videos.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {videos.map(v => (
                  <div key={v.id} onClick={() => setActiveVideo(v)} className="card-premium overflow-hidden group cursor-pointer hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 block">
                    <div className="relative aspect-video bg-gray-100">
                      {v.thumbnailUrl && <Image src={v.thumbnailUrl} alt={v.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          <Play className="w-5 h-5 text-gray-900 ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                    </div>
                    <div className="p-3.5">
                      <h3 className="font-semibold text-sm line-clamp-2 text-gray-900 leading-snug mb-1.5">{v.title}</h3>
                      {v.phone && (
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          {v.phone.thumbnail && <Image src={v.phone.thumbnail} alt={v.phone.modelName} width={20} height={20} className="rounded object-contain" unoptimized />}
                          <Link href={`/phones/${v.phone.slug}`} className="text-xs text-blue-500 font-medium hover:underline" onClick={e => e.stopPropagation()}>{v.phone.brand} {v.phone.modelName}</Link>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1.5">{new Date(v.publishedAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-8">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Play className="w-14 h-14 mx-auto mb-4 opacity-15" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">No videos yet</h3>
              <p className="text-sm">Video reviews will appear here once they are synced from YouTube.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Video Player Modal */}
      {activeVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={closeModal}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-4xl" onClick={e => e.stopPropagation()}>
            {/* Close button */}
            <button onClick={closeModal} className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors p-2">
              <X className="w-6 h-6" />
            </button>
            {/* Video iframe */}
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?autoplay=1&rel=0`}
                title={activeVideo.title}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            {/* Video title */}
            <h2 className="text-white font-semibold text-sm sm:text-base mt-3 px-1 line-clamp-2">{activeVideo.title}</h2>
            {activeVideo.phone && (
              <Link href={`/phones/${activeVideo.phone.slug}`} onClick={closeModal} className="inline-flex items-center gap-2 mt-2 px-1 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors">
                {activeVideo.phone.thumbnail && <Image src={activeVideo.phone.thumbnail} alt={activeVideo.phone.modelName} width={16} height={16} className="rounded object-contain" unoptimized />}
                {activeVideo.phone.brand} {activeVideo.phone.modelName}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}