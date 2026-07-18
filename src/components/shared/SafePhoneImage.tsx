'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Smartphone } from 'lucide-react';

interface SafePhoneImageProps {
  src?: string | null;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  fallbackClassName?: string;
  priority?: boolean;
}

// Track failed URLs at module level to prevent repeated retries
const failedUrls = new Set<string>();

// Allowed remote image hostnames (match next.config.ts remotePatterns)
const ALLOWED_HOSTS = new Set([
  'fdn2.gsmarena.com',
  'res.cloudinary.com',
  'images.unsplash.com',
  'upload.wikimedia.org',
  'i.ytimg.com',
  'phonedock.pk',
  'localhost',
]);

function isAllowedHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.endsWith('.cloudinary.com')) return true;
    return ALLOWED_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

function normalizeSrc(src: string): string | null {
  if (!src || typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  // If it's a relative path, it's fine
  if (trimmed.startsWith('/')) return trimmed;
  // If it's an absolute URL, validate the host
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (!isAllowedHost(trimmed)) return null;
    return trimmed;
  }
  // Treat as relative path
  return trimmed;
}

export function SafePhoneImage({
  src,
  alt,
  width,
  height,
  sizes,
  className = '',
  fallbackClassName,
  priority = false,
}: SafePhoneImageProps) {
  const [broken, setBroken] = useState(() => {
    if (!src) return true;
    if (failedUrls.has(src)) return true;
    const normalized = normalizeSrc(src);
    return !normalized;
  });

  const isBlank = !src || failedUrls.has(src) || !normalizeSrc(src || '');
  const effectiveSrc = isBlank ? undefined : normalizeSrc(src || '');

  const handleFallback = () => {
    if (src) failedUrls.add(src);
    setBroken(true);
  };

  // Compute responsive sizes if not provided
  const effectiveSizes = useMemo(() => {
    if (sizes) return sizes;
    if (!width || width <= 64) return undefined; // Too small for responsive
    if (width <= 100) return '(max-width: 640px) 50vw, 100vw';
    if (width <= 200) return '(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px';
    return '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw';
  }, [sizes, width]);

  const iconSize = useMemo(() => {
    if (width && height) return { w: width, h: height };
    return { w: 64, h: 64 };
  }, [width, height]);

  if (broken || !effectiveSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-[#F8FAFC] ${fallbackClassName || className}`}
        style={!width || !height ? undefined : { width: iconSize.w, height: iconSize.h }}
        aria-hidden="true"
      >
        <Smartphone
          className="text-gray-300"
          style={{ width: Math.max(iconSize.w * 0.5, 16), height: Math.max(iconSize.h * 0.5, 16) }}
        />
      </div>
    );
  }

  return (
    <Image
      src={effectiveSrc}
      alt={alt}
      width={width}
      height={height}
      sizes={effectiveSizes}
      className={`object-contain ${className}`}
      unoptimized
      loading={priority ? 'eager' : 'lazy'}
      priority={priority}
      onError={handleFallback}
    />
  );
}