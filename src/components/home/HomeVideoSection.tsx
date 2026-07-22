'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Play, X } from 'lucide-react';
import type { HomeVideo } from '@/components/shared/types';

function formatPublishedDate(value: string) {
  if (!value) return 'Latest review';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Latest review';
  return new Intl.DateTimeFormat('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function VideoThumbnail({ video, priority = false }: { video: HomeVideo; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(video.thumbnailUrl) && !failed;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.36),transparent_40%),linear-gradient(135deg,#111827,#07152f_55%,#020617)]">
      {showImage ? (
        <Image
          src={video.thumbnailUrl}
          alt={`${video.title} video thumbnail`}
          fill
          priority={priority}
          sizes={priority ? '(max-width: 1024px) 100vw, 66vw' : '(max-width: 640px) 82vw, (max-width: 1024px) 45vw, 28vw'}
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          onError={() => setFailed(true)}
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-white/70">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-2xl backdrop-blur-md">
            <Play className="h-6 w-6 fill-current" aria-hidden="true" />
          </div>
          <span className="text-xs font-semibold tracking-[0.18em] text-white/60">PHONEDOCK VIDEO</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
    </div>
  );
}

function PlayButton({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`flex items-center justify-center rounded-full border border-white/30 bg-white/95 text-slate-950 shadow-2xl transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-400 group-hover:text-white ${large ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-12 w-12'}`}
      aria-hidden="true"
    >
      <Play className={`${large ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-5 w-5'} ml-0.5 fill-current`} />
    </span>
  );
}

export function HomeVideoSection({ videos }: { videos: HomeVideo[] }) {
  const [activeVideo, setActiveVideo] = useState<HomeVideo | null>(null);
  const closeModal = useCallback(() => setActiveVideo(null), []);
  const featuredVideo = videos[0];
  const compactVideos = useMemo(() => videos.slice(1, 4), [videos]);

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

  if (!featuredVideo) return null;

  return (
    <section id="video-reviews" className="scroll-mt-28 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-[#071b3d] to-[#083b72] p-4 shadow-2xl shadow-blue-950/20 sm:p-6 lg:p-8">
      <div className="mb-5 flex items-end justify-between gap-4 sm:mb-7">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200">
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> Media
          </div>
          <h2 className="font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl lg:text-3xl">Latest Video Reviews</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-300 sm:text-sm">Hands-on reviews, comparisons and Pakistan-focused smartphone guides.</p>
        </div>
        <Link href="/videos" className="group/link hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15 sm:inline-flex">
          All Videos <ArrowUpRight className="h-4 w-4 transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(310px,0.9fr)]">
        <button
          type="button"
          onClick={() => setActiveVideo(featuredVideo)}
          className="group relative min-h-[290px] overflow-hidden rounded-3xl border border-white/10 text-left shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:min-h-[400px] lg:min-h-[460px]"
          aria-label={`Play featured video: ${featuredVideo.title}`}
        >
          <VideoThumbnail video={featuredVideo} priority />
          <div className="absolute inset-0 flex items-center justify-center"><PlayButton large /></div>
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-blue-100/90">
              <span className="rounded-full bg-blue-500/80 px-2.5 py-1">{featuredVideo.category || 'Featured Review'}</span>
              {featuredVideo.duration && <span className="rounded-full bg-black/55 px-2.5 py-1 backdrop-blur-md">{featuredVideo.duration}</span>}
            </div>
            <h3 className="max-w-3xl text-xl font-bold leading-tight text-white line-clamp-2 sm:text-3xl">{featuredVideo.title}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300">
              {featuredVideo.phone && <span className="font-semibold text-blue-200">{featuredVideo.phone.brand} {featuredVideo.phone.modelName}</span>}
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{formatPublishedDate(featuredVideo.publishedAt)}</span>
            </div>
          </div>
        </button>

        <div className="flex snap-x gap-3 overflow-x-auto pb-2 no-scrollbar lg:grid lg:overflow-visible lg:pb-0">
          {compactVideos.map(video => (
            <button
              key={video.id}
              type="button"
              onClick={() => setActiveVideo(video)}
              className="group relative min-h-[225px] w-[82%] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 text-left shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:w-[46%] lg:min-h-0 lg:w-full"
              aria-label={`Play video: ${video.title}`}
            >
              <VideoThumbnail video={video} />
              <div className="absolute left-4 top-4"><PlayButton /></div>
              {video.duration && <span className="absolute right-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">{video.duration}</span>}
              <div className="absolute inset-x-0 bottom-0 p-4">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-blue-200">{video.category || 'Video Review'}</span>
                <h3 className="text-sm font-bold leading-snug text-white line-clamp-2 sm:text-base">{video.title}</h3>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-300">
                  {video.phone && <span className="min-w-0 truncate font-medium text-blue-200">{video.phone.brand} {video.phone.modelName}</span>}
                  <span className="ml-auto shrink-0">{formatPublishedDate(video.publishedAt)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Link href="/videos" className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-semibold text-white transition hover:bg-white/15 sm:hidden">
        View All Videos <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </Link>

      {activeVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={closeModal} role="dialog" aria-modal="true" aria-label={`Video player: ${activeVideo.title}`}>
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-4xl" onClick={event => event.stopPropagation()}>
            <button onClick={closeModal} className="absolute -top-12 right-0 rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close video player">
              <X className="h-6 w-6" />
            </button>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?autoplay=1&rel=0`}
                title={activeVideo.title}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <h2 className="mt-3 line-clamp-2 px-1 text-sm font-semibold text-white sm:text-base">{activeVideo.title}</h2>
            {activeVideo.phone && (
              <Link href={`/phones/${activeVideo.phone.slug}`} onClick={closeModal} className="mt-2 inline-flex items-center gap-2 px-1 text-xs font-medium text-blue-400 transition-colors hover:text-blue-300">
                {activeVideo.phone.thumbnail && <Image src={activeVideo.phone.thumbnail} alt="" width={16} height={16} className="rounded object-contain" unoptimized />}
                {activeVideo.phone.brand} {activeVideo.phone.modelName}
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
