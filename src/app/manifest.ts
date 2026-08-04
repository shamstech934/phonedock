import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PhoneDock — Pakistan Smartphone Database',
    short_name: 'PhoneDock',
    description: 'Compare smartphone specifications, prices, PTA status, benchmarks, and reviews in Pakistan.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#3b82f6',
    orientation: 'portrait-primary',
    lang: 'en-PK',
    categories: ['technology', 'shopping', 'utilities'],
    icons: [
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
