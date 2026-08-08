import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';

export const metadata: Metadata = {
  title: 'Compare Phones - Side by Side Specifications',
  description: 'Compare phones side by side. Check specifications, prices, camera, battery, performance scores and more.',
  alternates: { canonical: `${getBaseUrl()}/compare` },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}