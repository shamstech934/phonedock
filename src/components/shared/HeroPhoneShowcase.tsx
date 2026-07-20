'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
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

export function HeroPhoneShowcase({ phones, autoplay = true, intervalMs = 5000, showInfo = true }: { phones: HeroPhone[]; autoplay?: boolean; intervalMs?: number; showInfo?: boolean }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [progressKey, setProgressKey] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const goNext = useCallback(() => {
    setCurrent(prev => (prev + 1) % phones.length);
    setProgressKey(prev => prev + 1);
  }, [phones.length]);

  const goPrev = useCallback(() => {
    setCurrent(prev => (prev - 1 + phones.length) % phones.length);
    setProgressKey(prev => prev + 1);
  }, [phones.length]);

  const goTo = useCallback((index: number) => {
    setCurrent(index);
    setProgressKey(prev => prev + 1);
  }, []);

  // Auto-slide every 5 seconds, pause on hover
  useEffect(() => {
    if (!autoplay || isPaused || phones.length <= 1) return;
    timerRef.current = setInterval(goNext, Math.max(2000, intervalMs));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoplay, intervalMs, isPaused, goNext, phones.length]);

  // Restart progress bar when unpausing
  useEffect(() => {
    if (!isPaused) setProgressKey(prev => prev + 1);
  }, [isPaused]);

  // Swipe support for mobile
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  if (!phones.length) return null;

  const phone = phones[current];

  // Extract 3 key specs for the card
  const specItems: string[] = [];
  if (phone.specs) {
    if (phone.specs.ram) specItems.push(phone.specs.ram);
    if (phone.specs.mainCamera) specItems.push(phone.specs.mainCamera);
    if (phone.specs.battery) specItems.push(phone.specs.battery);
    if (specItems.length < 3 && phone.specs.chipset) specItems.push(phone.specs.chipset);
    if (specItems.length < 3 && phone.specs.display) specItems.push(phone.specs.display);
  }

  return (
    <div
      className="relative w-full h-full flex items-center justify-center select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Soft blue glow behind phone — slightly larger for 25% bigger phone */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '260px',
          height: '260px',
          top: '-5%',
          right: '8%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.95, 1.08, 0.95] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex flex-row-reverse items-center justify-center w-full max-w-[440px] mx-auto gap-3">
        {/* Phone Image — 25% larger: 281→351, 344→430 */}
        <div className="relative z-10 flex-shrink-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`img-${phone.id}-${progressKey}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                {phone.thumbnail ? (
                  <Image
                    src={phone.thumbnail}
                    alt={phone.modelName}
                    width={351}
                    height={430}
                    className="object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
                    priority={current === 0}
                    unoptimized
                  />
                ) : (
                  <div className="w-[280px] h-[343px] bg-white/[0.07] rounded-3xl flex items-center justify-center border border-white/10">
                    <span className="text-white/25 text-xs">No Image</span>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Info Card — 10% smaller */}
        {showInfo && <div className="relative z-0 flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`card-${phone.id}-${progressKey}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white/[0.08] backdrop-blur-xl rounded-2xl p-[15px] border border-white/[0.12] shadow-lg shadow-black/10"
            >
              {/* Brand name — 10% smaller: 9px→8px */}
              <p className="text-[8px] text-blue-300 font-semibold uppercase tracking-wider mb-0.5 leading-none">
                {phone.brand?.name || ''}
              </p>
              {/* Phone model name — 10% smaller: 12px→11px */}
              <h3 className="text-[11px] font-bold text-white leading-tight mb-1.5 line-clamp-2">
                {phone.modelName}
              </h3>
              {/* Price + PTA badge — 10% smaller: 14px→13px */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-extrabold text-white tracking-tight leading-none">
                  {formatPrice(phone.pricePKR)}
                </span>
                {phone.ptaApproved && (
                  <span className="inline-flex items-center gap-0.5 text-[7px] font-semibold bg-emerald-500/20 text-emerald-300 px-1.5 py-[2px] rounded-full border border-emerald-400/15 leading-none">
                    <Shield className="w-2 h-2" /> PTA
                  </span>
                )}
              </div>
              {/* 3 key specs pills — 10% smaller: 9px→8px */}
              {specItems.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {specItems.slice(0, 3).map((spec, i) => (
                    <span
                      key={i}
                      className="text-[8px] text-gray-300/80 bg-white/[0.06] px-1.5 py-[2px] rounded-md border border-white/[0.06] leading-tight"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              )}
              {/* View Details button — 10% smaller: 10px→9px */}
              <Link
                href={`/phones/${phone.slug}`}
                className="block text-center text-[9px] font-semibold text-white bg-white/[0.08] hover:bg-white/[0.15] rounded-xl py-[5px] transition-all duration-200 border border-white/[0.1] hover:border-white/[0.18]"
              >
                View Details
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>}
      </div>

      {/* Navigation arrows */}
      {phones.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.16] backdrop-blur-sm flex items-center justify-center transition-all duration-200 border border-white/[0.08] hover:border-white/[0.15] z-20"
            aria-label="Previous phone"
          >
            <ChevronLeft className="w-4 h-4 text-white/70" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.16] backdrop-blur-sm flex items-center justify-center transition-all duration-200 border border-white/[0.08] hover:border-white/[0.15] z-20"
            aria-label="Next phone"
          >
            <ChevronRight className="w-4 h-4 text-white/70" />
          </button>

          {/* Progress indicators */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {phones.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="h-[3px] rounded-full overflow-hidden transition-all duration-300 cursor-pointer"
                style={{ width: i === current ? '22px' : '5px' }}
                aria-label={`Go to slide ${i + 1}`}
              >
                <div className="w-full h-full bg-white/[0.15] rounded-full relative overflow-hidden">
                  {i === current && (
                    <motion.div
                      key={progressKey}
                      className="absolute inset-y-0 left-0 bg-blue-400/80 rounded-full"
                      initial={{ width: '0%' }}
                      animate={isPaused ? { width: '100%' } : { width: '100%' }}
                      transition={
                        isPaused
                          ? { duration: 0 }
                          : { duration: 5, ease: 'linear' }
                      }
                      style={isPaused ? { animationPlayState: 'paused' } : {}}
                    />
                  )}
                  {i !== current && (
                    <div className="absolute inset-0 bg-white/40 rounded-full" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}