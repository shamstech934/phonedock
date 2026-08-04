import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';

const SITE_NAME = 'PhoneDock Pakistan';
const DEFAULT_OG_IMAGE = '/opengraph-image';

export function absoluteUrl(path = '/') {
  const base = getBaseUrl().replace(/\/$/, '');
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function compactText(value: string, max = 160) {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function buildPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
  type?: 'website' | 'article';
  keywords?: string[];
}): Metadata {
  const canonical = absoluteUrl(input.path);
  const description = compactText(input.description);
  const image = absoluteUrl(input.image || DEFAULT_OG_IMAGE);

  return {
    title: input.title,
    description,
    keywords: input.keywords,
    alternates: { canonical },
    robots: input.noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    openGraph: {
      title: input.title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: 'en_PK',
      type: input.type || 'website',
      images: [{ url: image, width: 1200, height: 630, alt: input.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description,
      images: [image],
    },
  };
}
