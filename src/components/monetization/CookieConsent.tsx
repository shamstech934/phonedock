'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'phonedock_cookie_consent_v1';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!localStorage.getItem(STORAGE_KEY));
  }, []);

  const save = (value: 'accepted' | 'essential') => {
    localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
    window.dispatchEvent(new CustomEvent('phonedock:consent', { detail: value }));
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[120] mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-950 dark:text-white">Cookies, analytics and ads</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            PhoneDock uses essential storage and, with permission, analytics and advertising tools to improve the site and keep it free. Read our{' '}
            <Link href="/privacy-policy" className="font-medium text-blue-600 hover:underline">Privacy Policy</Link>.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => save('essential')} className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-900">Essential only</button>
          <button onClick={() => save('accepted')} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Accept all</button>
        </div>
      </div>
    </div>
  );
}
