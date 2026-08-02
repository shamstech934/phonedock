'use client';

import Script from 'next/script';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const CONSENT_KEY = 'phonedock_cookie_consent_v1';
const GA_ID_PATTERN = /^G-[A-Z0-9]+$/i;

function normaliseGaId(value: unknown): string {
  const candidate = String(value || '').trim().toUpperCase();
  return GA_ID_PATTERN.test(candidate) ? candidate : '';
}

export function GrowthScripts() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [consented, setConsented] = useState(false);
  const [cmsGaId, setCmsGaId] = useState('');

  useEffect(() => {
    const sync = () => setConsented(localStorage.getItem(CONSENT_KEY) === 'accepted');
    sync();
    window.addEventListener('phonedock:consent', sync);
    return () => window.removeEventListener('phonedock:consent', sync);
  }, []);

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then(response => (response.ok ? response.json() : null))
      .then(data => setCmsGaId(normaliseGaId(data?.settings?.googleAnalyticsId)))
      .catch(() => {
        // The public environment variable remains a safe fallback.
      });
  }, []);

  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  const gaId = normaliseGaId(cmsGaId || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim();
  const queryString = searchParams.toString();
  const pagePath = useMemo(
    () => `${pathname}${queryString ? `?${queryString}` : ''}`,
    [pathname, queryString],
  );

  useEffect(() => {
    if (!consented || !gaId || pathname.startsWith('/admin')) return;

    const timer = window.setTimeout(() => {
      window.gtag?.('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: pagePath,
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [consented, gaId, pagePath, pathname]);

  if (!consented || pathname.startsWith('/admin')) return null;

  return (
    <>
      {adsenseClient ? (
        <Script
          id="phonedock-adsense"
          async
          strategy="afterInteractive"
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClient)}`}
        />
      ) : null}

      {gaId ? (
        <>
          <Script
            id="phonedock-ga-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
          />
          <Script id="phonedock-ga-config" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true,send_page_view:false,transport_type:'beacon'});`}
          </Script>
        </>
      ) : null}

      {clarityId ? (
        <Script id="phonedock-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,'clarity','script','${clarityId}');`}
        </Script>
      ) : null}
    </>
  );
}
