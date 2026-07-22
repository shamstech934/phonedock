import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, Lightbulb } from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { getTopPhones } from '@/lib/get-top-phones';
import { Phone } from '@/lib/models';
import { connectDB } from '@/lib/mongodb';
import type { Phone as PhoneType } from '@/components/shared/types';
import { serializeJsonLd } from '@/lib/json-ld';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';
const guides = {
  'gaming-phones': { title: 'Best Gaming Phones in Pakistan', intro: 'Prioritize chipset performance, stable FPS, cooling, refresh rate and battery endurance.', sort: 'performanceScore', tips: ['Prefer a strong recent chipset', 'Look for 120Hz or faster display', 'Check gaming battery endurance', 'Do not judge gaming performance from RAM alone'] },
  'camera-phones': { title: 'Best Camera Phones in Pakistan', intro: 'A good camera phone combines sensor quality, image processing, OIS and useful lenses.', sort: 'cameraScore', tips: ['OIS helps in low light and video', 'Sensor quality matters more than megapixels alone', 'Check ultrawide and telephoto quality', 'Review video stabilization and microphone quality'] },
  'battery-phones': { title: 'Best Battery Phones in Pakistan', intro: 'Battery capacity matters, but chipset efficiency and software optimization are equally important.', sort: 'batteryScore', tips: ['Compare real endurance, not mAh only', 'Fast charging should have thermal protection', 'OLED and efficient chipsets can save power', 'Check battery replacement support'] },
  'value-phones': { title: 'Best Value Phones in Pakistan', intro: 'The best value phone gives balanced performance, camera, battery and software support at a fair price.', sort: 'valueScore', tips: ['Avoid paying only for brand name', 'Check update policy and resale value', 'Compare official and market warranty', 'Leave budget for a charger or case if not included'] },
  'pta-approved-phones': { title: 'PTA-Approved Phones in Pakistan', intro: 'PTA approval is essential for normal SIM use in Pakistan. Confirm the IMEI status before payment.', sort: 'overallRating', tips: ['Verify both IMEIs for dual-SIM phones', 'Ask for proof of PTA approval', 'Match box, device and invoice IMEI', 'Avoid unclear patched or temporary approval claims'] },
} as const;

type GuideSlug = keyof typeof guides;
export function generateStaticParams() { return Object.keys(guides).map(slug => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const guide = guides[slug as GuideSlug]; if (!guide) return {};
  return { title: `${guide.title} | PhoneDock`, description: guide.intro, alternates: { canonical: `${BASE_URL}/buying-guides/${slug}` } };
}

async function getPhones(slug: GuideSlug): Promise<PhoneType[]> {
  if (slug !== 'pta-approved-phones') return getTopPhones(guides[slug].sort, 12);
  await connectDB();
  const docs = await Phone.find({ active: true, status: 'published', ptaApproved: true }).sort({ overallRating: -1 }).limit(12).populate('brand').lean();
  return docs.map((p: any) => ({ ...p, id: p._id.toString(), brandId: p.brandId?.toString?.() || '', brand: p.brand ? { ...p.brand, id: p.brand._id?.toString?.() || '' } : undefined })) as PhoneType[];
}

export const revalidate = 900;

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const guide = guides[slug as GuideSlug]; if (!guide) notFound();
  const phones = await getPhones(slug as GuideSlug);
  const jsonLd = { '@context': 'https://schema.org', '@type': 'ItemList', name: guide.title, itemListElement: phones.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE_URL}/phones/${p.slug}`, name: p.modelName })) };
  return <div className="min-h-screen flex flex-col"><Header /><main className="flex-1 bg-slate-50/60">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="flex items-center gap-1 text-xs text-gray-500"><Link href="/buying-guides">Buying Guides</Link><ChevronRight className="h-3 w-3" /><span>{guide.title}</span></nav>
      <div className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">{guide.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">{guide.intro}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {guide.tips.map(tip => <div key={tip} className="flex gap-3 rounded-xl bg-blue-50/70 p-3 text-sm text-gray-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />{tip}</div>)}
        </div>
      </div>
      <div className="mt-8 flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-500" /><h2 className="text-2xl font-extrabold text-gray-900">Recommended phones</h2></div>
      {phones.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{phones.map(p => <PhoneCard key={p.id} phone={p} />)}</div> : <div className="mt-5 rounded-2xl border bg-white p-8 text-center text-gray-500">No ranked phones available yet.</div>}
    </div>
  </main><Footer /></div>;
}
