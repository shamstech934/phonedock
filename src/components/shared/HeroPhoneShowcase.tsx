'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Battery, Camera, ChevronLeft, ChevronRight, Cpu, Pause, Play, ShieldCheck, Smartphone } from 'lucide-react';
import { formatPrice } from './formatPrice';

export interface HeroPhone {
  id: string;
  modelName: string;
  slug: string;
  thumbnail: string;
  heroImage?: string;
  pricePKR: number;
  ptaStatus: string;
  ptaApproved: boolean;
  brand?: { name: string; logo: string };
  specs?: { ram?: string; mainCamera?: string; battery?: string; chipset?: string; display?: string; storage?: string } | null;
}

interface StagePosition {
  desktopX?: number; desktopY?: number; desktopScale?: number; desktopRotate?: number;
  mobileX?: number; mobileY?: number; mobileScale?: number; mobileRotate?: number;
  imageFit?: 'contain' | 'cover';
}
interface Props { phones: HeroPhone[]; autoplay?: boolean; intervalMs?: number; showInfo?: boolean; position?: StagePosition }

export function HeroPhoneShowcase({ phones, autoplay = true, intervalMs = 5000, showInfo = true, position }: Props) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [validImageIds, setValidImageIds] = useState<Set<string> | null>(null);
  const [lowResolutionImageIds, setLowResolutionImageIds] = useState<Set<string>>(new Set());
  const touchStart = useRef(0);
  const carouselPhones = validImageIds ? phones.filter(phone => validImageIds.has(phone.id)).slice(0, 6) : [];
  const slideCount = carouselPhones.length;
  const activeIndex = slideCount ? current % slideCount : 0;
  const phone = carouselPhones[activeIndex];
  const activeImageSource = phone?.heroImage || phone?.thumbnail || '';
  const isLowResolution = phone ? lowResolutionImageIds.has(phone.id) : false;
  const featureCards = phone ? [
    { label: 'Camera', value: phone.specs?.mainCamera, icon: Camera, tone: 'text-sky-300' },
    { label: 'Battery', value: phone.specs?.battery, icon: Battery, tone: 'text-emerald-300' },
    { label: 'Performance', value: phone.specs?.chipset || phone.specs?.ram, icon: Cpu, tone: 'text-violet-300' },
  ].filter(card => card.value).slice(0, 3) : [];
  const next = useCallback(() => setCurrent(value => slideCount ? (value + 1) % slideCount : 0), [slideCount]);
  const previous = useCallback(() => setCurrent(value => slideCount ? (value - 1 + slideCount) % slideCount : 0), [slideCount]);

  // Validate remote/local thumbnails before admitting a phone to the carousel.
  // This prevents captions from rotating through visually empty slides.
  useEffect(() => {
    let cancelled = false;
    setValidImageIds(null);
    setLowResolutionImageIds(new Set());
    setCurrent(0);
    let remaining = phones.length;
    const probes: HTMLImageElement[] = [];
    const finishProbe = () => {
      remaining -= 1;
      if (!cancelled && remaining <= 0) {
        setValidImageIds(previous => previous ?? new Set());
      }
    };
    const timeout = window.setTimeout(() => {
      if (!cancelled) setValidImageIds(previous => previous ?? new Set());
    }, 8000);

    phones.forEach(phone => {
      const imageSource = phone.heroImage || phone.thumbnail;
      if (!imageSource) { finishProbe(); return; }
      const probe = new window.Image();
      probes.push(probe);
      probe.onload = () => {
        // Reject tracking pixels and tiny placeholder assets. They technically
        // load, but produce an apparently empty hero slide.
        if (!cancelled && probe.naturalWidth >= 80 && probe.naturalHeight >= 80) {
          if (probe.naturalWidth < 600 || probe.naturalHeight < 600) {
            setLowResolutionImageIds(previous => new Set([...previous, phone.id]));
          }
          // Publish each successful image immediately. One slow remote host must
          // never keep every other hero phone behind a loading spinner.
          setValidImageIds(previous => new Set([...(previous || []), phone.id]));
        }
        finishProbe();
      };
      probe.onerror = finishProbe;
      probe.src = imageSource;
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      probes.forEach(probe => { probe.onload = null; probe.onerror = null; });
    };
  }, [phones]);

  useEffect(() => {
    if (!autoplay || paused || slideCount < 2) return;
    const timer = setInterval(next, Math.max(2000, intervalMs));
    return () => clearInterval(timer);
  }, [autoplay, intervalMs, next, paused, slideCount]);

  if (!phones.length) return null;
  return (
    <div
      className="relative h-full w-full select-none overflow-hidden"
      onTouchStart={event => { touchStart.current = event.changedTouches[0].screenX; }}
      onTouchEnd={event => {
        const difference = touchStart.current - event.changedTouches[0].screenX;
        if (Math.abs(difference) > 50) (difference > 0 ? next : previous)();
      }}
    >
      <div className="pointer-events-none absolute inset-3 rounded-[1.75rem] border border-white/10 bg-slate-950/20 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-[2px]" />
      <div className="pointer-events-none absolute left-[28%] top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/15 blur-3xl" />

      <div
        className="hero-stage-position absolute bottom-[108px] left-5 top-5 w-[44%] overflow-visible [perspective:1100px] sm:left-7 lg:left-8"
        style={{
          '--desktop-x': `${position?.desktopX || 0}px`,
          '--desktop-y': `${position?.desktopY || 0}px`,
          '--desktop-scale': `${(position?.desktopScale || 100) / 100}`,
          '--desktop-rotate': `${position?.desktopRotate || 0}deg`,
          '--mobile-x': `${position?.mobileX || 0}px`,
          '--mobile-y': `${position?.mobileY || 0}px`,
          '--mobile-scale': `${(position?.mobileScale || 100) / 100}`,
          '--mobile-rotate': `${position?.mobileRotate || 0}deg`,
        } as CSSProperties}
      >
        <motion.div
          key={phone?.id || 'hero-stage-loading'}
          initial={{ opacity: 0, y: 18, rotateY: -8, scale: .92 }}
          animate={{ opacity: 1, y: [3, -4, 3], rotateY: -3, rotateZ: 0, scale: .98 }}
          transition={{ opacity: { duration: .3 }, scale: { duration: .4 }, rotateY: { duration: .45 }, rotateZ: { duration: .45 }, y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
          className={`relative mx-auto h-full [transform-style:preserve-3d] ${isLowResolution ? 'w-[78%] max-w-[210px]' : 'w-full max-w-[260px]'}`}
        >
            {phone ? (
              <div className="absolute inset-0 overflow-hidden rounded-[2.25rem] border border-white/70 bg-[radial-gradient(circle_at_50%_38%,#ffffff_0%,#f8fafc_52%,#e2e8f0_100%)] shadow-[0_28px_55px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.95)]">
                <Image
                  src={activeImageSource}
                  alt={phone.modelName}
                  fill
                  sizes={isLowResolution ? '(max-width: 640px) 160px, 225px' : '(max-width: 640px) 190px, 290px'}
                  priority={activeIndex === 0}
                  onError={() => setValidImageIds(previousIds => {
                    const nextIds = new Set(previousIds || []);
                    nextIds.delete(phone.id);
                    return nextIds;
                  })}
                  className={`${position?.imageFit === 'cover' ? 'object-cover' : 'object-contain'} z-[2] p-2 contrast-105 drop-shadow-[0_18px_16px_rgba(15,23,42,.22)]`}
                />
                <div className="pointer-events-none absolute inset-x-[14%] bottom-2 h-4 rounded-[50%] bg-slate-500/20 blur-md" />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-slate-300">
                {validImageIds === null ? <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-sky-300" /> : <><Smartphone className="h-20 w-20 text-sky-200/40" /><span>No valid hero images</span></>}
              </div>
            )}
        </motion.div>
      </div>

      {phone && <div className="absolute bottom-[108px] right-5 top-5 z-20 flex w-[48%] flex-col justify-center gap-2.5 sm:right-7 lg:right-8">
        {featureCards.length > 0 ? featureCards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-slate-950/38 px-3 py-2.5 shadow-lg backdrop-blur-xl">
            <div className={`mb-1 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[.16em] ${tone}`}><Icon className="h-3.5 w-3.5" />{label}</div>
            <p className="truncate text-xs font-bold text-white sm:text-sm" title={value}>{value}</p>
          </div>
        )) : (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4 text-xs leading-5 text-slate-300 backdrop-blur-xl">
            Detailed specifications will appear here when available.
          </div>
        )}
        {phone.ptaApproved && <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-bold text-emerald-200"><ShieldCheck className="h-3.5 w-3.5" />PTA Approved</span>}
      </div>}

      {showInfo && phone && (
        <AnimatePresence mode="wait">
          <motion.div key={`caption-${phone.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute bottom-3 left-5 right-5 z-20 flex items-center rounded-2xl border border-sky-300/25 bg-slate-950/72 px-4 py-3 shadow-[0_16px_36px_rgba(0,0,0,.28)] backdrop-blur-xl sm:left-7 sm:right-7 lg:left-8 lg:right-8">
            <Link href={`/phones/${phone.slug}`} className="min-w-0 flex-1 truncate text-sm font-extrabold text-white hover:text-sky-200">{phone.modelName}</Link>
            <span className="mx-3 h-7 w-px bg-white/20" />
            <span className="shrink-0 text-sm font-black text-blue-400">{formatPrice(phone.pricePKR)}</span>
          </motion.div>
        </AnimatePresence>
      )}

      {slideCount > 1 && <>
        <button onClick={previous} aria-label="Previous phone" className="absolute left-2 top-1/2 z-30 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-slate-950/45 text-white backdrop-blur hover:bg-white/15"><ChevronLeft className="h-5 w-5" /></button>
        <button onClick={next} aria-label="Next phone" className="absolute right-2 top-1/2 z-30 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-slate-950/45 text-white backdrop-blur hover:bg-white/15"><ChevronRight className="h-5 w-5" /></button>
      </>}
      {slideCount > 1 && <div className="absolute bottom-[78px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/45 px-3 py-1.5 backdrop-blur">
        {carouselPhones.map((slide, index) => <button key={slide.id} type="button" onClick={() => setCurrent(index)} aria-label={`Show ${slide.modelName}`} aria-current={index === activeIndex ? 'true' : undefined} className={`h-1.5 rounded-full transition-all ${index === activeIndex ? 'w-6 bg-sky-300' : 'w-1.5 bg-white/35 hover:bg-white/70'}`} />)}
        <span className="ml-1 text-[9px] font-bold tabular-nums text-white/65">{activeIndex + 1}/{slideCount}</span>
        <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Resume phone slideshow' : 'Pause phone slideshow'} className="ml-1 grid h-5 w-5 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        </button>
      </div>}
      <style jsx>{`
        .hero-stage-position {
          transform: translate(var(--mobile-x), var(--mobile-y)) scale(var(--mobile-scale)) rotate(var(--mobile-rotate));
          transform-origin: center bottom;
        }
        @media (min-width: 1024px) {
          .hero-stage-position {
            transform: translate(var(--desktop-x), var(--desktop-y)) scale(var(--desktop-scale)) rotate(var(--desktop-rotate));
          }
        }
      `}</style>
    </div>
  );
}
