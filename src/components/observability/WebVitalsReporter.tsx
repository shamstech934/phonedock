'use client';

import { useReportWebVitals } from 'next/web-vitals';

const SUPPORTED = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);

export function WebVitalsReporter() {
  useReportWebVitals(metric => {
    if (!SUPPORTED.has(metric.name) || process.env.NODE_ENV !== 'production') return;
    const body = JSON.stringify({ name: metric.name, value: metric.value, rating: metric.rating, navigationType: metric.navigationType });
    navigator.sendBeacon?.('/api/observability/web-vitals', new Blob([body], { type: 'application/json' }));
  });
  return null;
}
