'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShieldCheck, Smartphone } from 'lucide-react';
import { formatPrice } from './formatPrice';

export interface HeroPhone {
  id: string;
  modelName: string;
  slug: string;
  thumbnail: string;
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
  const touchStart = useRef(0);
  const carouselPhones = validImageIds ? phones.filter(phone => validImageIds.has(phone.id)).slice(0, 6) : [];
  const slideCount = carouselPhones.length;
  const activeIndex = slideCount ? current % slideCount : 0;
  const phone = carouselPhones[activeIndex];
  const next = useCallback(() => setCurrent(value => slideCount ? (value + 1) % slideCount : 0), [slideCount]);
  const previous = useCallback(() => setCurrent(value => slideCount ? (value - 1 + slideCount) % slideCount : 0), [slideCount]);

  // Validate remote/local thumbnails before admitting a phone to the carousel.
  // This prevents captions from rotating through visually empty slides.
  useEffect(() => {
    let cancelled = false;
    setValidImageIds(null);
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
      if (!phone.thumbnail) { finishProbe(); return; }
      const probe = new window.Image();
      probes.push(probe);
      probe.onload = () => {
        // Reject tracking pixels and tiny placeholder assets. They technically
        // load, but produce an apparently empty hero slide.
        if (!cancelled && probe.naturalWidth >= 80 && probe.naturalHeight >= 80) {
          // Publish each successful image immediately. One slow remote host must
          // never keep every other hero phone behind a loading spinner.
          setValidImageIds(previous => new Set([...(previous || []), phone.id]));
        }
        finishProbe();
      };
      probe.onerror = finishProbe;
      probe.src = phone.thumbnail;
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
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={event => { touchStart.current = event.changedTouches[0].screenX; }}
      onTouchEnd={event => {
        const difference = touchStart.current - event.changedTouches[0].screenX;
        if (Math.abs(difference) > 50) (difference > 0 ? next : previous)();
      }}
    >
      {/* Concentric light wall behind the floating product. */}
      <div className="pointer-events-none absolute left-1/2 top-[42%] h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(14,165,233,.48)_0%,rgba(14,116,207,.16)_38%,transparent_70%)] blur-xl" />
      {[320, 255, 190].map(size => (
        <div key={size} className="pointer-events-none absolute left-1/2 top-[41%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/10" style={{ width: size, height: size }} />
      ))}

      {/* Multi-layer neon podium matching the selected Floating 3D Stage. */}
      <div className="pointer-events-none absolute bottom-[38px] left-1/2 h-[106px] w-[88%] max-w-[510px] -translate-x-1/2">
        <div className="absolute inset-x-0 bottom-0 h-[74px] rounded-[50%] border border-sky-400/55 bg-blue-950/65 shadow-[0_0_35px_rgba(14,165,233,.38)] [transform:rotateX(64deg)]" />
        <div className="absolute inset-x-[8%] bottom-[22px] h-[72px] rounded-[50%] border-2 border-cyan-300/80 bg-gradient-to-b from-sky-500/35 to-blue-950/90 shadow-[0_0_18px_rgba(34,211,238,.85),0_18px_22px_rgba(0,0,0,.34)] [transform:rotateX(61deg)]" />
        <div className="absolute inset-x-[14%] bottom-[43px] h-[54px] rounded-[50%] border border-sky-200/60 bg-[radial-gradient(ellipse,rgba(125,211,252,.5)_0%,rgba(30,64,175,.34)_48%,rgba(2,6,23,.82)_76%)] shadow-[0_0_28px_rgba(56,189,248,.65)] [transform:rotateX(59deg)]" />
      </div>

      <div
        className="hero-stage-position absolute inset-x-8 top-4 bottom-[120px] overflow-visible [perspective:1100px] sm:top-5 lg:top-6"
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
        <AnimatePresence mode="wait">
          <motion.div
            key={phone?.id || 'hero-stage-loading'}
            initial={{ opacity: 0, y: 25, rotateY: -24, rotateZ: -2, scale: .86 }}
            animate={{ opacity: 1, y: [5, -2, 5], rotateY: -14, rotateZ: 3, scale: .94 }}
            exit={{ opacity: 0, y: -15, rotateY: 18, scale: .9 }}
            transition={{ opacity: { duration: .35 }, scale: { duration: .45 }, rotateY: { duration: .5 }, rotateZ: { duration: .5 }, y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
            className="relative mx-auto h-full w-[72%] max-w-[290px] [transform-style:preserve-3d]"
          >
            {phone ? (
              <div className="absolute inset-0 rounded-[42%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,.12),transparent_64%)]">
                <Image
                  src={phone.thumbnail}
                  alt={phone.modelName}
                  fill
                  sizes="(max-width: 640px) 190px, 290px"
                  priority={activeIndex === 0}
                  unoptimized
                  onError={() => setValidImageIds(previousIds => {
                    const nextIds = new Set(previousIds || []);
                    nextIds.delete(phone.id);
                    return nextIds;
                  })}
                  className={`${position?.imageFit === 'cover' ? 'object-cover' : 'object-contain'} p-2 mix-blend-normal contrast-105 drop-shadow-[0_32px_24px_rgba(0,0,0,.55)] sm:p-1`}
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-slate-300">
                {validImageIds === null ? <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-sky-300" /> : <><Smartphone className="h-20 w-20 text-sky-200/40" /><span>No valid hero images</span></>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {showInfo && phone && (
        <AnimatePresence mode="wait">
          <motion.div key={`caption-${phone.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute bottom-2 left-1/2 z-20 flex w-[82%] max-w-[460px] -translate-x-1/2 items-center rounded-2xl border border-sky-300/35 bg-slate-950/75 px-4 py-3 shadow-[0_16px_36px_rgba(0,0,0,.32)] backdrop-blur-xl">
            <Link href={`/phones/${phone.slug}`} className="min-w-0 flex-1 truncate text-sm font-extrabold text-white hover:text-sky-200">{phone.modelName}</Link>
            <span className="mx-3 h-7 w-px bg-white/20" />
            <span className="shrink-0 text-sm font-black text-blue-400">{formatPrice(phone.pricePKR)}</span>
            {phone.ptaApproved && <><span className="mx-3 h-7 w-px bg-white/20" /><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300"><ShieldCheck className="h-3 w-3" />PTA</span></>}
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
