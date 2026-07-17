import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compare Phones - Side by Side Specifications',
  description: 'Compare phones side by side. Check specifications, prices, camera, battery, performance scores and more.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/compare` },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}