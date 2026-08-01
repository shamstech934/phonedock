import Image from 'next/image';
import { resolveBrandLogo } from '@/lib/brand-logos';

type BrandLogoProps = {
  name: string;
  slug?: string;
  logo?: string;
  size?: number;
  className?: string;
  imageClassName?: string;
};

export function BrandLogo({ name, slug, logo, size = 48, className = '', imageClassName = '' }: BrandLogoProps) {
  const src = resolveBrandLogo(name, slug, logo);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'B';

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_8px_24px_rgba(15,23,42,.06)] dark:border-slate-700 dark:bg-slate-900 ${className}`}
      style={{ width: size, height: size }}
      aria-label={`${name} logo`}
    >
      {src ? (
        <Image
          src={src}
          alt={`${name} logo`}
          width={Math.max(32, size - 12)}
          height={Math.max(32, size - 12)}
          className={`h-[68%] w-[76%] object-contain ${imageClassName}`}
          unoptimized
        />
      ) : (
        <span className="text-sm font-black tracking-tight text-slate-500 dark:text-slate-300">{initials}</span>
      )}
    </div>
  );
}
