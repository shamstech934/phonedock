'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const CONSENT_KEY = 'phonedock_cookie_consent_v1';

export function GrowthScripts() {
  const pathname = usePathname();
  const [consented, setConsented] = useState(false);
  useEffect(() => {
    const sync = () => setConsented(localStorage.getItem(CONSENT_KEY) === 'accepted');
    sync(); window.addEventListener('phonedock:consent', sync); return () => window.removeEventListener('phonedock:consent', sync);
  }, []);
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim();

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
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true});`}
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
