'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Avoid exposing stack traces or sensitive request details in the UI.
    console.error('[GlobalError]', error.digest || error.name);
  }, [error]);

  return (
    <html lang="en-PK">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', color: '#0f172a' }}>
        <main
          role="alert"
          style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}
        >
          <section style={{ width: '100%', maxWidth: '440px', textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '32px', boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)' }}>
            <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#2563eb' }}>PhoneDock</p>
            <h1 style={{ margin: '0 0 10px', fontSize: '24px' }}>Something went wrong</h1>
            <p style={{ margin: '0 0 22px', color: '#64748b', lineHeight: 1.6 }}>
              The page could not be loaded. Please try again. Your data has not been changed.
            </p>
            <button
              type="button"
              onClick={reset}
              autoFocus
              style={{ border: 0, borderRadius: '12px', padding: '11px 18px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
