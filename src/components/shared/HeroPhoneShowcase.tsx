'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
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

interface Props { phones: HeroPhone[]; autoplay?: boolean; intervalMs?: number; showInfo?: boolean }

export function HeroPhoneShowcase({ phones, autoplay = true, intervalMs = 5000, showInfo = true }: Props) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef(0);
  const next = useCallback(() => setCurrent(value => (value + 1) % phones.length), [phones.length]);
  const previous = useCallback(() => setCurrent(value => (value - 1 + phones.length) % phones.length), [phones.length]);

  useEffect(() => {
    if (!autoplay || paused || phones.length < 2) return;
    const timer = setInterval(next, Math.max(2000, intervalMs));
    return () => clearInterval(timer);
  }, [autoplay, intervalMs, next, paused, phones.length]);

  if (!phones.length) return null;
  const phone = phones[current];

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

      <div className="absolute inset-x-8 top-4 bottom-[120px] overflow-visible [perspective:1100px] sm:top-5 lg:top-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={phone.id}
            initial={{ opacity: 0, y: 25, rotateY: -24, rotateZ: -2, scale: .86 }}
            animate={{ opacity: 1, y: [5, -2, 5], rotateY: -14, rotateZ: 3, scale: .94 }}
            exit={{ opacity: 0, y: -15, rotateY: 18, scale: .9 }}
            transition={{ opacity: { duration: .35 }, scale: { duration: .45 }, rotateY: { duration: .5 }, rotateZ: { duration: .5 }, y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
            className="relative mx-auto h-full w-[72%] max-w-[290px] [transform-style:preserve-3d]"
          >
            {phone.thumbnail ? (
              <Image
                src={phone.thumbnail}
                alt={phone.modelName}
                fill
                sizes="(max-width: 640px) 190px, 290px"
                priority={current === 0}
                unoptimized
                className="object-contain p-2 mix-blend-multiply contrast-110 drop-shadow-[0_32px_24px_rgba(0,0,0,.55)] sm:p-1"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-300">No image</div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {showInfo && (
        <AnimatePresence mode="wait">
          <motion.div key={`caption-${phone.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute bottom-2 left-1/2 z-20 flex w-[82%] max-w-[460px] -translate-x-1/2 items-center rounded-2xl border border-sky-300/35 bg-slate-950/75 px-4 py-3 shadow-[0_16px_36px_rgba(0,0,0,.32)] backdrop-blur-xl">
            <Link href={`/phones/${phone.slug}`} className="min-w-0 flex-1 truncate text-sm font-extrabold text-white hover:text-sky-200">{phone.modelName}</Link>
            <span className="mx-3 h-7 w-px bg-white/20" />
            <span className="shrink-0 text-sm font-black text-blue-400">{formatPrice(phone.pricePKR)}</span>
            {phone.ptaApproved && <><span className="mx-3 h-7 w-px bg-white/20" /><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300"><ShieldCheck className="h-3 w-3" />PTA</span></>}
          </motion.div>
        </AnimatePresence>
      )}

      {phones.length > 1 && <>
        <button onClick={previous} aria-label="Previous phone" className="absolute left-2 top-1/2 z-30 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-slate-950/45 text-white backdrop-blur hover:bg-white/15"><ChevronLeft className="h-5 w-5" /></button>
        <button onClick={next} aria-label="Next phone" className="absolute right-2 top-1/2 z-30 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-slate-950/45 text-white backdrop-blur hover:bg-white/15"><ChevronRight className="h-5 w-5" /></button>
      </>}
    </div>
  );
}
