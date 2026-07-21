'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSlotProps = {
  slot?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical';
  className?: string;
  label?: string;
};

export function AdSlot({ slot, format = 'auto', className = '', label = 'Advertisement' }: AdSlotProps) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  const resolvedSlot = slot?.trim();

  useEffect(() => {
    if (!client || !resolvedSlot) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers and delayed AdSense loading should never break the page.
    }
  }, [client, resolvedSlot]);

  if (!client || !resolvedSlot) return null;

  return (
    <aside aria-label={label} className={`w-full overflow-hidden ${className}`}>
      <p className="mb-1 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">{label}</p>
      <ins
        className="adsbygoogle block min-h-[90px]"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={resolvedSlot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
