import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';

export const metadata: Metadata = {
  title: 'All Phones - Latest Prices & Specs in Pakistan',
  description: 'Browse complete phone database with latest Pakistan prices, specifications, PTA status, reviews, and compare features.',
  alternates: { canonical: `${getBaseUrl()}/phones` },
};

export default function PhonesLayout({ children }: { children: React.ReactNode }) {
  return children;
}