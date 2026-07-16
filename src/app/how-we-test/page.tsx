import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { Beaker, BarChart3, Cpu, Camera, Battery, Monitor, Star } from 'lucide-react';

export const metadata: Metadata = {
  title: 'How We Test Phones',
  description: 'Learn about PhoneDock\'s phone testing methodology, benchmark procedures, and how we evaluate smartphones.',
  alternates: { canonical: `${getBaseUrl()}/how-we-test` },
};

export default function HowWeTestPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#EFF6FF]/40 via-white to-white">
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-400 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/20">
              <Beaker className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display">How We Test Phones</h1>
            <p className="text-sm text-muted-foreground mt-2">Our testing methodology and evaluation process</p>
          </div>

          <div className="space-y-5 animate-fade-in">
            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Our Testing Philosophy</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                At PhoneDock, our testing is designed to reflect real-world usage for Pakistani consumers. We evaluate phones based on what matters most in daily life — camera quality in different lighting conditions, battery life with typical usage patterns, display quality for media consumption, and performance for gaming and multitasking.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-3">
                Every phone in our database that carries a rating has been evaluated using a consistent methodology to ensure fair and comparable results across all price ranges and brands.
              </p>
            </section>

            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-4">Testing Categories</h2>
              <div className="space-y-4">
                {[
                  { icon: Camera, title: 'Camera Testing', color: 'bg-rose-50', iconColor: 'text-rose-500', items: [
                    'Daylight photos: landscape, portrait, macro, and food photography',
                    'Low-light and night mode testing with standard settings',
                    'Front camera selfies and video call quality',
                    'Video recording at maximum resolution (4K/1080p) with stabilization',
                    'Color accuracy, dynamic range, and noise analysis',
                  ]},
                  { icon: Cpu, title: 'Performance Testing', color: 'bg-blue-50', iconColor: 'text-blue-500', items: [
                    'Standardized benchmark suites (Geekbench, AnTuTu)',
                    'Real-world app launch times and multitasking',
                    'Gaming performance with popular titles (PUBG Mobile, Genshin Impact)',
                    'Thermal testing under sustained load (30 minutes)',
                    'Storage read/write speed benchmarks',
                  ]},
                  { icon: Battery, title: 'Battery Testing', color: 'bg-emerald-50', iconColor: 'text-emerald-500', items: [
                    'Screen-on time (SOT) testing with mixed usage',
                    'Video playback endurance test (looped 1080p video)',
                    'Charging speed measurement (0-100% time)',
                    'Standby drain over 8 hours',
                    'Real-world daily usage simulation (calls, browsing, social media, gaming)',
                  ]},
                  { icon: Monitor, title: 'Display Testing', color: 'bg-amber-50', iconColor: 'text-amber-500', items: [
                    'Color accuracy (Delta E) measurement',
                    'Maximum brightness (nits) in auto and manual modes',
                    'Sunlight visibility assessment',
                    'Touch response and refresh rate verification',
                    'HDR content playback evaluation',
                  ]},
                ].map(cat => (
                  <div key={cat.title} className="p-4 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className={`w-8 h-8 ${cat.color} rounded-lg flex items-center justify-center`}>
                        <cat.icon className={`w-4 h-4 ${cat.iconColor}`} />
                      </div>
                      <h3 className="text-sm font-bold text-gray-900">{cat.title}</h3>
                    </div>
                    <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-5">
                      {cat.items.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Scoring System</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                Each testing category receives a score from 0 to 10. These scores are then weighted to produce an overall rating. Our weighting reflects what Pakistani consumers value most:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: 'Camera', weight: '25%', icon: Camera, color: 'text-rose-500' },
                  { label: 'Performance', weight: '20%', icon: Cpu, color: 'text-blue-500' },
                  { label: 'Battery', weight: '20%', icon: Battery, color: 'text-emerald-500' },
                  { label: 'Display', weight: '15%', icon: Monitor, color: 'text-amber-500' },
                  { label: 'Value', weight: '20%', icon: Star, color: 'text-violet-500' },
                ].map(item => (
                  <div key={item.label} className="text-center p-3 bg-gray-50 rounded-xl">
                    <item.icon className={`w-5 h-5 ${item.color} mx-auto mb-1`} />
                    <p className="text-xs font-bold text-gray-900">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.weight}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                For the detailed formula and methodology behind our overall rating, please see our <a href="/rating-methodology" className="text-blue-500 hover:text-blue-600 font-medium">Rating Methodology</a> page.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}