'use client';

import { useState, useRef, useMemo } from 'react';
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
}

// Track failed URLs at module level to prevent repeated retries
const failedUrls = new Set<string>();

export function SafePhoneImage({
  src,
  alt,
  width,
  height,
  sizes,
  className = '',
  fallbackClassName,
}: SafePhoneImageProps) {
  const [broken, setBroken] = useState(() => !src || failedUrls.has(src || ''));

  const imgRef = useRef<HTMLDivElement>(null);

  const isBlank = !src || failedUrls.has(src);

  // If the src is already known-bad or empty, don't render Image at all
  const effectiveSrc = isBlank ? undefined : src;

  const handleFallback = () => {
    if (src) failedUrls.add(src);
    setBroken(true);
  };

  // Fallback icon dimensions derived from className or props
  const iconSize = useMemo(() => {
    if (width && height) return { w: width, h: height };
    // Default 64x64 when no dimensions given
    return { w: 64, h: 64 };
  }, [width, height]);

  if (broken || !effectiveSrc) {
    return (
      <div
        ref={imgRef}
        className={`flex items-center justify-center bg-[#F8FAFC] ${fallbackClassName || className}`}
        style={!width || !height ? undefined : { width: iconSize.w, height: iconSize.h }}
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
      sizes={sizes}
      className={`object-contain ${className}`}
      unoptimized
      onError={handleFallback}
    />
  );
}