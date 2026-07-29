'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

export interface HeroCampaign {
  id: string;
  name?: string;
  enabled?: boolean;
  desktopImage?: string;
  mobileImage?: string;
  alt?: string;
  startAt?: string;
  endAt?: string;
  overlay?: number;
  position?: string;
}

function isCampaignActive(campaign: HeroCampaign, now: number) {
  if (campaign.enabled === false || !campaign.desktopImage) return false;
  const start = campaign.startAt ? Date.parse(campaign.startAt) : Number.NEGATIVE_INFINITY;
  const end = campaign.endAt ? Date.parse(campaign.endAt) : Number.POSITIVE_INFINITY;
  return (Number.isNaN(start) || now >= start) && (Number.isNaN(end) || now <= end);
}

export function HeroCampaignBackground({
  campaigns,
  fallback,
  intervalMs = 7000,
}: {
  campaigns?: HeroCampaign[];
  fallback?: string;
  intervalMs?: number;
}) {
  const [current, setCurrent] = useState(0);
  const [now] = useState(() => Date.now());
  const active = useMemo(
    () => (Array.isArray(campaigns) ? campaigns : []).filter(campaign => isCampaignActive(campaign, now)).slice(0, 8),
    [campaigns, now],
  );

  useEffect(() => {
    setCurrent(0);
  }, [active.length]);

  useEffect(() => {
    if (active.length < 2) return;
    const timer = window.setInterval(
      () => setCurrent(index => (index + 1) % active.length),
      Math.max(4000, intervalMs),
    );
    return () => window.clearInterval(timer);
  }, [active.length, intervalMs]);

  const selected = active[current];
  const desktopImage = selected?.desktopImage || fallback;
  if (!desktopImage) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl" aria-hidden="true">
      {active.map((campaign, index) => (
        <picture
          key={campaign.id}
          className={`absolute inset-0 transition-opacity duration-1000 motion-reduce:transition-none ${index === current ? 'opacity-100' : 'opacity-0'}`}
        >
          {campaign.mobileImage && <source media="(max-width: 767px)" srcSet={campaign.mobileImage} />}
          <Image
            src={campaign.desktopImage!}
            alt=""
            fill
            sizes="(max-width: 1440px) 100vw, 1440px"
            priority={index === 0}
            quality={78}
            className="object-cover"
            style={{ objectPosition: campaign.position || 'center' }}
          />
          <span className="absolute inset-0 bg-slate-950" style={{ opacity: Math.min(0.9, Math.max(0, (campaign.overlay ?? 45) / 100)) }} />
        </picture>
      ))}
      {active.length === 0 && fallback && (
        <>
          <Image src={fallback} alt="" fill sizes="(max-width: 1440px) 100vw, 1440px" priority quality={78} className="object-cover" />
          <span className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/65 to-cyan-950/55" />
        </>
      )}
      {active.length > 1 && (
        <div className="absolute right-4 top-4 flex gap-1.5 rounded-full bg-slate-950/45 px-2 py-1.5 backdrop-blur">
          {active.map((campaign, index) => <span key={campaign.id} className={`h-1.5 rounded-full ${index === current ? 'w-5 bg-cyan-300' : 'w-1.5 bg-white/45'}`} />)}
        </div>
      )}
    </div>
  );
}
