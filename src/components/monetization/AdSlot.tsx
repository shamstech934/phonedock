'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();
  const [consented, setConsented] = useState(false);
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  const resolvedSlot = slot?.trim();

  useEffect(() => {
    const sync = () => setConsented(localStorage.getItem('phonedock_cookie_consent_v1') === 'accepted');
    sync(); window.addEventListener('phonedock:consent', sync);
    if (!client || !resolvedSlot || !consented || pathname.startsWith('/admin')) return () => window.removeEventListener('phonedock:consent', sync);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers and delayed AdSense loading should never break the page.
    }
    return () => window.removeEventListener('phonedock:consent', sync);
  }, [client, resolvedSlot, consented, pathname]);

  if (!client || !resolvedSlot || !consented || pathname.startsWith('/admin')) return null;

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
