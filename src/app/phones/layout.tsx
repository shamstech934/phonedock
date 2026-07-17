import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'All Phones - Latest Prices & Specs in Pakistan',
  description: 'Browse complete phone database with latest Pakistan prices, specifications, PTA status, reviews, and compare features.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/phones` },
};

export default function PhonesLayout({ children }: { children: React.ReactNode }) {
  return children;
}