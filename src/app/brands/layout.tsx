import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'All Phone Brands in Pakistan',
  description: 'Explore all smartphone brands available in Pakistan. Find Samsung, Apple, Xiaomi, Realme, Infinix, Tecno, OnePlus and more with latest prices.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/brands` },
};

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
  return children;
}