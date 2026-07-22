'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onloadTurnstileCallback';

interface TurnstileWidgetProps {
  siteKey?: string;
  onVerify: (token: string) => void;
  onError?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  className?: string;
}

export function TurnstileWidget({ siteKey, onVerify, onError, theme = 'auto', size = 'normal', className = '' }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { onVerifyRef.current = onVerify; }, [onVerify]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.turnstile) { setLoaded(true); return; }

    const existingScript = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    window.onloadTurnstileCallback = () => setLoaded(true);
    return () => { delete window.onloadTurnstileCallback; };
  }, []);

  useEffect(() => {
    if (!loaded || !containerRef.current || !siteKey) return;
    if (widgetIdRef.current) { window.turnstile?.remove(widgetIdRef.current); }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme,
      size,
      callback: (token: string) => onVerifyRef.current(token),
      'error-callback': () => onErrorRef.current?.(),
      'expired-callback': () => {
        if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
      },
    });

    return () => {
      if (widgetIdRef.current) { window.turnstile?.remove(widgetIdRef.current); widgetIdRef.current = null; }
    };
  }, [loaded, siteKey, theme, size]);

  if (!siteKey) return null;

  return <div ref={containerRef} className={className} />;
}
