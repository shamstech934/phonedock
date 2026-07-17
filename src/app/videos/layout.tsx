import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Video Reviews - Phone Camera, Gaming & Battery Tests',
  description: 'Watch in-depth video reviews covering camera quality, gaming performance, battery life, and full phone reviews.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk'}/videos` },
};

export default function VideosLayout({ children }: { children: React.ReactNode }) {
  return children;
}