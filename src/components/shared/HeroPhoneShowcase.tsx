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

export function HeroPhoneShowcase({ phones }: { phones: HeroPhone[] }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [progressKey, setProgressKey] = useState(0);

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
    if (isPaused || phones.length <= 1) return;
    timerRef.current = setInterval(goNext, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPaused, goNext, phones.length]);

  // Restart progress bar when unpausing
  useEffect(() => {
    if (!isPaused) setProgressKey(prev => prev + 1);
  }, [isPaused]);

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
    >
      {/* Soft blue glow behind phone */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '220px',
          height: '220px',
          top: '0%',
          right: '12%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.95, 1.08, 0.95] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex flex-col items-center w-full max-w-[280px] mx-auto">
        {/* Phone Image — overlaps the card below */}
        <div className="relative z-10" style={{ marginBottom: '-28px' }}>
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
                    width={220}
                    height={260}
                    className="object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
                    priority={current === 0}
                    unoptimized
                  />
                ) : (
                  <div className="w-52 h-60 bg-white/[0.07] rounded-3xl flex items-center justify-center border border-white/10">
                    <span className="text-white/25 text-xs">No Image</span>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Info Card — compact, less space than image */}
        <div className="relative z-0 w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={`card-${phone.id}-${progressKey}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white/[0.08] backdrop-blur-xl rounded-2xl p-3.5 border border-white/[0.12] shadow-lg shadow-black/10"
            >
              {/* Brand name */}
              <p className="text-[10px] text-blue-300 font-semibold uppercase tracking-wider mb-0.5 leading-none">
                {phone.brand?.name || ''}
              </p>
              {/* Phone model name */}
              <h3 className="text-[13px] font-bold text-white leading-tight mb-1.5 line-clamp-1">
                {phone.modelName}
              </h3>
              {/* Price + PTA badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[15px] font-extrabold text-white tracking-tight leading-none">
                  {formatPrice(phone.pricePKR)}
                </span>
                {phone.ptaApproved && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 px-1.5 py-[2px] rounded-full border border-emerald-400/15 leading-none">
                    <Shield className="w-2.5 h-2.5" /> PTA
                  </span>
                )}
              </div>
              {/* 3 key specs pills */}
              {specItems.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {specItems.slice(0, 3).map((spec, i) => (
                    <span
                      key={i}
                      className="text-[10px] text-gray-300/80 bg-white/[0.06] px-1.5 py-[2px] rounded-md border border-white/[0.06] leading-tight"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              )}
              {/* View Details button */}
              <Link
                href={`/phones/${phone.slug}`}
                className="block text-center text-[11px] font-semibold text-white bg-white/[0.08] hover:bg-white/[0.15] rounded-xl py-[7px] transition-all duration-200 border border-white/[0.1] hover:border-white/[0.18]"
              >
                View Details
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
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