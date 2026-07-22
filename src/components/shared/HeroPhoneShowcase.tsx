'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { formatPrice } from './formatPrice';

export interface HeroPhone {
  id: string; modelName: string; slug: string; thumbnail: string; pricePKR: number;
  ptaStatus: string; ptaApproved: boolean; brand?: { name: string; logo: string };
  specs?: { ram?: string; mainCamera?: string; battery?: string; chipset?: string; display?: string; storage?: string } | null;
}

interface Props { phones: HeroPhone[]; autoplay?: boolean; intervalMs?: number; showInfo?: boolean }

export function HeroPhoneShowcase({ phones, autoplay=true, intervalMs=5000, showInfo=true }: Props) {
  const [current,setCurrent]=useState(0); const [paused,setPaused]=useState(false); const touch=useRef(0);
  const next=useCallback(()=>setCurrent(value=>(value+1)%phones.length),[phones.length]);
  const previous=useCallback(()=>setCurrent(value=>(value-1+phones.length)%phones.length),[phones.length]);
  useEffect(()=>{if(!autoplay||paused||phones.length<2)return;const timer=setInterval(next,Math.max(2000,intervalMs));return()=>clearInterval(timer)},[autoplay,intervalMs,next,paused,phones.length]);
  if(!phones.length)return null;
  const phone=phones[current];
  return <div className="relative flex h-full min-h-[290px] w-full select-none items-center justify-center overflow-hidden" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onTouchStart={e=>{touch.current=e.changedTouches[0].screenX}} onTouchEnd={e=>{const d=touch.current-e.changedTouches[0].screenX;if(Math.abs(d)>50)(d>0?next:previous)()}}>
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
    <div className="relative flex h-full w-full items-center justify-center [perspective:1100px]">
      <div className="pointer-events-none absolute bottom-[56px] left-1/2 h-20 w-[76%] max-w-[390px] -translate-x-1/2 rounded-[50%] border border-cyan-300/45 bg-[radial-gradient(ellipse,rgba(34,211,238,.38)_0%,rgba(59,130,246,.18)_42%,transparent_72%)] shadow-[0_0_45px_rgba(34,211,238,.28),inset_0_0_26px_rgba(125,211,252,.24)] [transform:translateX(-50%)_rotateX(66deg)]" />
      <div className="pointer-events-none absolute bottom-[72px] left-1/2 h-12 w-[55%] max-w-[285px] -translate-x-1/2 rounded-[50%] border border-white/30 [transform:translateX(-50%)_rotateX(66deg)]" />
      <AnimatePresence mode="wait">
        <motion.div key={phone.id} initial={{opacity:0,y:18,rotateY:-22,scale:.9}} animate={{opacity:1,y:[0,-7,0],rotateY:-12,rotateX:2,scale:1}} exit={{opacity:0,y:-10,rotateY:18,scale:.92}} transition={{opacity:{duration:.3},scale:{duration:.4},rotateY:{duration:.5},y:{duration:4,repeat:Infinity,ease:'easeInOut'}}} className="absolute top-2 h-[205px] w-[170px] sm:h-[245px] sm:w-[205px] lg:h-[270px] lg:w-[225px] [transform-style:preserve-3d]">
          {phone.thumbnail?<Image src={phone.thumbnail} alt={phone.modelName} fill sizes="225px" priority={current===0} unoptimized className="object-contain drop-shadow-[0_30px_28px_rgba(0,0,0,.48)]"/>:<div className="flex h-full items-center justify-center rounded-[28px] border border-white/15 bg-white/10 text-xs text-slate-300">No image</div>}
        </motion.div>
      </AnimatePresence>
      {showInfo&&<AnimatePresence mode="wait"><motion.div key={`caption-${phone.id}`} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:6}} className="absolute bottom-1 left-1/2 z-20 flex w-[88%] max-w-[430px] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-white/15 bg-slate-950/45 px-4 py-2.5 shadow-xl backdrop-blur-xl">
        <Link href={`/phones/${phone.slug}`} className="min-w-0"><p className="truncate text-[9px] font-bold uppercase tracking-[.16em] text-cyan-300">{phone.brand?.name||'Featured phone'}</p><p className="truncate text-sm font-extrabold text-white">{phone.modelName}</p></Link>
        <div className="shrink-0 text-right"><p className="text-sm font-black text-white">{formatPrice(phone.pricePKR)}</p>{phone.ptaApproved&&<span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-300"><ShieldCheck className="h-3 w-3"/>PTA Approved</span>}</div>
      </motion.div></AnimatePresence>}
    </div>
    {phones.length>1&&<><button onClick={previous} aria-label="Previous phone" className="absolute left-1 top-1/2 z-30 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-slate-950/35 text-white backdrop-blur hover:bg-white/15"><ChevronLeft className="h-4 w-4"/></button><button onClick={next} aria-label="Next phone" className="absolute right-1 top-1/2 z-30 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-slate-950/35 text-white backdrop-blur hover:bg-white/15"><ChevronRight className="h-4 w-4"/></button><div className="absolute bottom-[-10px] left-1/2 z-30 flex -translate-x-1/2 gap-1.5">{phones.map((item,index)=><button key={item.id} onClick={()=>setCurrent(index)} aria-label={`Go to slide ${index+1}`} aria-current={index===current?'true':undefined} className={`h-1.5 rounded-full transition-all ${index===current?'w-7 bg-cyan-300':'w-1.5 bg-white/35'}`}/>)}</div></>}
  </div>;
}
