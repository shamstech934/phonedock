import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';

export const metadata: Metadata = {
  title: 'All Phone Brands in Pakistan',
  description: 'Explore all smartphone brands available in Pakistan. Find Samsung, Apple, Xiaomi, Realme, Infinix, Tecno, OnePlus and more with latest prices.',
  alternates: { canonical: `${getBaseUrl()}/brands` },
};

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
  return children;
}