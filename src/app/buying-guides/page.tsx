import type { Metadata } from 'next';
import Link from 'next/link';
import { BatteryCharging, Camera, Gamepad2, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';
export const metadata: Metadata = {
  title: 'Phone Buying Guides for Pakistan | PhoneDock',
  description: 'Simple smartphone buying guides for gaming, camera, battery, value and PTA-approved phones in Pakistan.',
  alternates: { canonical: `${BASE_URL}/buying-guides` },
};

const guides = [
  { slug: 'gaming-phones', title: 'Best Gaming Phones', text: 'Performance, cooling, display and battery priorities explained.', icon: Gamepad2 },
  { slug: 'camera-phones', title: 'Best Camera Phones', text: 'Choose the right camera phone for photos, portraits and video.', icon: Camera },
  { slug: 'battery-phones', title: 'Best Battery Phones', text: 'Battery capacity, efficiency and charging speed made simple.', icon: BatteryCharging },
  { slug: 'value-phones', title: 'Best Value Phones', text: 'Find the strongest balance of price, specs and long-term use.', icon: WalletCards },
  { slug: 'pta-approved-phones', title: 'PTA-Approved Phones', text: 'Understand PTA status and shop with fewer surprises.', icon: ShieldCheck },
];

export default function BuyingGuidesPage() {
  return <div className="min-h-screen flex flex-col"><Header /><main className="flex-1">
    <section className="border-b bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <div className="flex items-center gap-2 text-blue-300"><Sparkles className="h-5 w-5" /><span className="text-sm font-bold uppercase tracking-widest">PhoneDock Guides</span></div>
        <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Choose your next phone with confidence</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Practical Pakistan-focused guides based on price, scores, specifications and PTA status.</p>
      </div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
      {guides.map(g => <Link key={g.slug} href={`/buying-guides/${g.slug}`} className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
        <div className="inline-flex rounded-xl bg-blue-50 p-3 text-blue-600"><g.icon className="h-6 w-6" /></div>
        <h2 className="mt-4 text-xl font-extrabold text-gray-900 group-hover:text-blue-600">{g.title}</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">{g.text}</p>
        <span className="mt-5 inline-block text-sm font-bold text-blue-600">Read guide →</span>
      </Link>)}
    </section>
  </main><Footer /></div>;
}
