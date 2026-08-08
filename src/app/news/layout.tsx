import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';

export const metadata: Metadata = {
  title: 'News & Updates - Mobile Phone Industry Pakistan',
  description: 'Latest mobile phone news, launches, leaks, and industry updates in Pakistan.',
  alternates: { canonical: `${getBaseUrl()}/news` },
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}