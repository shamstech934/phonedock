import { Camera } from 'lucide-react';
import type { Metadata } from 'next';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { Badge } from '@/components/ui/badge';
import type { Phone } from '@/components/shared/types';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk';

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

async function getBestCameraPhones(): Promise<Phone[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/top-phones?sort=cameraScore&limit=20`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.phones || data || [];
  } catch {
    return [];
  }
}

export default async function BestCameraPhonePage() {
  const phones = await getBestCameraPhones();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">Best Camera Phones in Pakistan 2025</h1>
            <p className="text-sm text-muted-foreground mt-1">Ranking the best camera smartphones available in Pakistan based on expert scores</p>
          </div>

          <div className="card-premium p-4 sm:p-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Our camera phone rankings are based on a comprehensive evaluation of sensor quality, lens versatility, low-light performance, video capabilities, and image processing.
              We analyze main camera, ultrawide, telephoto, and selfie cameras to give you an overall camera score that reflects real-world photography and videography experience.
            </p>
          </div>

          {phones.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {phones.map((phone) => (
                <div key={phone.id} className="relative">
                  <PhoneCard phone={phone} />
                  {phone.cameraScore > 0 && (
                    <Badge className="absolute top-3 right-3 z-10 bg-emerald-600 text-white text-[10px] font-semibold shadow-sm">
                      Camera: {phone.cameraScore}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Camera className="w-14 h-14 mx-auto mb-4 opacity-15" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">No camera phone data yet</h3>
              <p className="text-sm">Check back later for updated rankings</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}