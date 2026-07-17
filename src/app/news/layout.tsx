import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'News & Updates - Mobile Phone Industry Pakistan',
  description: 'Latest mobile phone news, launches, leaks, and industry updates in Pakistan.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/news` },
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}