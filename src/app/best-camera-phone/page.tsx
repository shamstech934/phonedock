import type { Metadata } from 'next';
import { Camera } from 'lucide-react';
import { TopPhonesClientPage } from '@/components/shared/TopPhonesClientPage';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

export const metadata: Metadata = {
  title: 'Best Camera Phones in Pakistan 2025 | PhoneDock',
  description: 'Ranking the best camera smartphones available in Pakistan based on expert scores',
  alternates: { canonical: `${BASE_URL}/best-camera-phone` },
  openGraph: {
    title: 'Best Camera Phones in Pakistan 2025 | PhoneDock',
    description: 'Ranking the best camera smartphones available in Pakistan based on expert scores',
    url: `${BASE_URL}/best-camera-phone`,
    type: 'website',
  },
};

export default function BestCameraPhonePage() {
  return (
    <TopPhonesClientPage
      title="Best Camera Phones in Pakistan 2025"
      subtitle="Ranking the best camera smartphones available in Pakistan based on expert scores"
      sort="cameraScore"
      icon={Camera}
      description="Our camera phone rankings are based on a comprehensive evaluation of sensor quality, lens versatility, low-light performance, video capabilities, and image processing. We analyze main camera, ultrawide, telephoto, and selfie cameras to give you an overall camera score that reflects real-world photography and videography experience."
      badgeField="cameraScore"
      badgeLabel="Camera"
    />
  );
}