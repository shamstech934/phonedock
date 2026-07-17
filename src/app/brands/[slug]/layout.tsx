import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brand Phones & Prices',
  description: 'View all phones from this brand with latest Pakistan prices, specifications, and reviews.',
};

export default function BrandSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}