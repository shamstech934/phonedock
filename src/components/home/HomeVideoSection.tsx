'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, X } from 'lucide-react';
import { SectionHeader } from '@/components/shared/SectionHeader';
import type { HomeVideo } from '@/components/shared/types';

export function HomeVideoSection({ videos }: { videos: HomeVideo[] }) {
  const [activeVideo, setActiveVideo] = useState<HomeVideo | null>(null);
  const closeModal = useCallback(() => setActiveVideo(null), []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal();
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

  if (!videos.length) return null;

  return (
    <section className="space-y-5">
      <SectionHeader title="Latest Video Reviews" icon={Play} link="/videos" linkText="All Videos" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {videos.map(video => (
          <button
            key={video.id}
            type="button"
            onClick={() => setActiveVideo(video)}
            className="card-premium overflow-hidden group cursor-pointer hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 text-left"
          >
            <div className="relative aspect-video bg-gray-100">
              {video.thumbnailUrl && (
                <Image src={video.thumbnailUrl} alt={video.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <Play className="w-4 h-4 text-gray-900 ml-0.5" fill="currentColor" />
                </div>
              </div>
            </div>
            <div className="p-3">
              <h3 className="font-semibold text-sm line-clamp-2 text-gray-900 leading-snug mb-1">{video.title}</h3>
              {video.phone && <span className="text-[11px] text-blue-500 font-medium">{video.phone.brand} {video.phone.modelName}</span>}
            </div>
          </button>
        ))}
      </div>

      {activeVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={closeModal} role="dialog" aria-modal="true" aria-label="Video player">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-4xl" onClick={event => event.stopPropagation()}>
            <button onClick={closeModal} className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors p-2" aria-label="Close video">
              <X className="w-6 h-6" />
            </button>
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?autoplay=1&rel=0`}
                title={activeVideo.title}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
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
    </section>
  );
}
