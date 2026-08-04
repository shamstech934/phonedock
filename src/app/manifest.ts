import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SpecsDekh — Pakistan Smartphone Database',
    short_name: 'SpecsDekh',
    description: 'Compare smartphone specifications, prices, PTA status, benchmarks, and reviews in Pakistan.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#3b82f6',
    orientation: 'portrait-primary',
    lang: 'en-PK',
    categories: ['technology', 'shopping', 'utilities'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
