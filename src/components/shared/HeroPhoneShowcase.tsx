'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Shield } from 'lucide-react';
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
  specs?: {
    ram?: string;
    mainCamera?: string;
    battery?: string;
    chipset?: string;
    display?: string;
    storage?: string;
  } | null;
}

interface HeroPhoneShowcaseProps {
  phones: HeroPhone[];
  autoplay?: boolean;
  intervalMs?: number;
  showInfo?: boolean;
}

export function HeroPhoneShowcase({ phones, autoplay = true, intervalMs = 5000, showInfo = true }: HeroPhoneShowcaseProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const goNext = useCallback(() => {
    setCurrent(previous => (previous + 1) % phones.length);
    setProgressKey(previous => previous + 1);
  }, [phones.length]);

  const goPrev = useCallback(() => {
    setCurrent(previous => (previous - 1 + phones.length) % phones.length);
    setProgressKey(previous => previous + 1);
  }, [phones.length]);

  const goTo = useCallback((index: number) => {
    setCurrent(index);
    setProgressKey(previous => previous + 1);
  }, []);

  useEffect(() => {
    if (!autoplay || isPaused || phones.length <= 1) return;
    timerRef.current = setInterval(goNext, Math.max(2000, intervalMs));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoplay, goNext, intervalMs, isPaused, phones.length]);

  useEffect(() => {
    if (!isPaused) setProgressKey(previous => previous + 1);
  }, [isPaused]);

  if (!phones.length) return null;

  const phone = phones[current];
  const specItems: string[] = [];
  if (phone.specs) {
    if (phone.specs.ram) specItems.push(phone.specs.ram);
    if (phone.specs.mainCamera) specItems.push(phone.specs.mainCamera);
    if (phone.specs.battery) specItems.push(phone.specs.battery);
    if (specItems.length < 3 && phone.specs.chipset) specItems.push(phone.specs.chipset);
    if (specItems.length < 3 && phone.specs.display) specItems.push(phone.specs.display);
  }

  const onTouchEnd = (event: React.TouchEvent) => {
    touchEndX.current = event.changedTouches[0].screenX;
    const difference = touchStartX.current - touchEndX.current;
    if (Math.abs(difference) > 50) {
      if (difference > 0) goNext();
      else goPrev();
    }
  };

  return (
    <div
      className="relative flex h-full w-full select-none items-center justify-center"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={event => { touchStartX.current = event.changedTouches[0].screenX; }}
      onTouchEnd={onTouchEnd}
    >
      <motion.div
        className="pointer-events-none absolute right-[4%] top-[4%] h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.4)_0%,rgba(59,130,246,0.16)_42%,transparent_72%)] blur-[38px]"
        animate={{ opacity: [0.4, 0.75, 0.4], scale: [0.95, 1.08, 0.95] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative mx-auto flex w-full max-w-[520px] items-center justify-center gap-3 px-8 sm:gap-4 sm:px-10">
        {showInfo && (
          <div className="relative z-20 w-[116px] shrink-0 sm:w-[142px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={`card-${phone.id}-${progressKey}`}
                initial={{ opacity: 0, x: -16, rotateY: 8 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden rounded-2xl border border-white/15 bg-slate-950/35 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-3.5"
              >
                <div className="mb-2 flex items-center justify-between gap-1.5">
                  <p className="min-w-0 truncate text-[8px] font-bold uppercase tracking-[0.14em] text-sky-300 sm:text-[9px]">
                    {phone.brand?.name || 'Featured'}
                  </p>
                  {phone.ptaApproved && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-emerald-300/20 bg-emerald-400/15 px-1.5 py-1 text-[7px] font-bold leading-none text-emerald-200">
                      <Shield className="h-2.5 w-2.5" aria-hidden="true" /> PTA
                    </span>
                  )}
                </div>
                <h3 className="mb-2 line-clamp-2 min-h-8 text-[11px] font-extrabold leading-4 text-white sm:text-xs">
                  {phone.modelName}
                </h3>
                <p className="mb-2 truncate text-[11px] font-extrabold tracking-tight text-white sm:text-sm" title={formatPrice(phone.pricePKR)}>
                  {formatPrice(phone.pricePKR)}
                </p>
                {specItems.length > 0 && (
                  <div className="mb-2.5 space-y-1">
                    {specItems.slice(0, 3).map((spec, index) => (
                      <span key={`${spec}-${index}`} className="block truncate rounded-md border border-white/[0.07] bg-white/[0.06] px-1.5 py-1 text-[8px] leading-tight text-slate-300" title={spec}>
                        {spec}
                      </span>
                    ))}
                  </div>
                )}
                <Link
                  href={`/phones/${phone.slug}`}
                  className="flex min-h-8 items-center justify-center rounded-lg border border-sky-300/20 bg-sky-400/15 px-2 text-[9px] font-bold text-white transition hover:border-sky-200/40 hover:bg-sky-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  View Details
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        <div className="relative z-10 min-w-0 flex-1 [perspective:900px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`image-${phone.id}-${progressKey}`}
              initial={{ opacity: 0, scale: 0.92, rotateY: -10 }}
              animate={{ opacity: 1, scale: 1, rotateY: -5 }}
              exit={{ opacity: 0, scale: 0.92, rotateY: 8 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="relative mx-auto h-[176px] w-full max-w-[250px] rounded-[26px] border border-white/20 bg-gradient-to-br from-white/20 via-white/8 to-sky-400/10 p-2 shadow-[0_28px_65px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-md sm:h-[226px] lg:h-[250px]"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="relative h-full w-full overflow-hidden rounded-[20px] bg-white/95 shadow-inner"
              >
                {phone.thumbnail ? (
                  <Image
                    src={phone.thumbnail}
                    alt={phone.modelName}
                    fill
                    sizes="(max-width: 640px) 180px, 250px"
                    className="object-contain p-2 drop-shadow-[0_16px_30px_rgba(15,23,42,0.28)]"
                    priority={current === 0}
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/[0.07]">
                    <span className="text-xs text-slate-400">No Image</span>
                  </div>
                )}
              </motion.div>
              <div className="pointer-events-none absolute inset-x-8 -bottom-4 h-5 rounded-full bg-black/35 blur-xl" aria-hidden="true" />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {phones.length > 1 && (
        <>
          <button onClick={goPrev} className="absolute left-0 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-slate-950/25 backdrop-blur-md transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300" aria-label="Previous phone">
            <ChevronLeft className="h-4 w-4 text-white/80" />
          </button>
          <button onClick={goNext} className="absolute right-0 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-slate-950/25 backdrop-blur-md transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300" aria-label="Next phone">
            <ChevronRight className="h-4 w-4 text-white/80" />
          </button>
          <div className="absolute -bottom-1 left-1/2 z-30 flex -translate-x-1/2 gap-1.5">
            {phones.map((item, index) => (
              <button key={item.id} onClick={() => goTo(index)} className={`h-1 rounded-full transition-all ${index === current ? 'w-6 bg-sky-300' : 'w-1.5 bg-white/35 hover:bg-white/60'}`} aria-label={`Go to slide ${index + 1}`} aria-current={index === current ? 'true' : undefined} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
