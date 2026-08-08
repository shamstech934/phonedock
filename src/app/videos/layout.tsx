import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';

export const metadata: Metadata = {
  title: 'Video Reviews - Phone Camera, Gaming & Battery Tests',
  description: 'Watch in-depth video reviews covering camera quality, gaming performance, battery life, and full phone reviews.',
  alternates: { canonical: `${getBaseUrl()}/videos` },
};

export default function VideosLayout({ children }: { children: React.ReactNode }) {
  return children;
}