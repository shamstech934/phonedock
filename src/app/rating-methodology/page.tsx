import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { Camera, Cpu, Battery, Monitor, Star, Calculator } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Rating Methodology',
  description: 'Understand how PhoneDock calculates phone ratings — our scoring formula, category weights, and score breakdown.',
  alternates: { canonical: `${getBaseUrl()}/rating-methodology` },
};

export default function RatingMethodologyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#EFF6FF]/40 via-white to-white">
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <Calculator className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display">Rating Methodology</h1>
            <p className="text-sm text-muted-foreground mt-2">How we calculate our phone ratings</p>
          </div>

          <div className="space-y-5 animate-fade-in">
            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Overview</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Every phone on PhoneDock receives an overall rating from 0 to 10. This rating is calculated from five individual category scores, each weighted according to its importance for Pakistani consumers. Our methodology is designed to be transparent, consistent, and reflective of real-world user experience.
              </p>
            </section>

            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-4">Category Weights</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-700">Category</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-gray-700">Weight</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-700">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { cat: 'Camera', weight: '25%', icon: Camera, color: 'text-rose-500', desc: 'Photo and video quality across various conditions' },
                      { cat: 'Performance', weight: '20%', icon: Cpu, color: 'text-blue-500', desc: 'Processing power, gaming, multitasking, and thermal management' },
                      { cat: 'Battery', weight: '20%', icon: Battery, color: 'text-emerald-500', desc: 'Battery life, charging speed, and power efficiency' },
                      { cat: 'Display', weight: '15%', icon: Monitor, color: 'text-amber-500', desc: 'Screen quality, brightness, color accuracy, and refresh rate' },
                      { cat: 'Value for Money', weight: '20%', icon: Star, color: 'text-violet-500', desc: 'Overall value considering specs, features, and price in PKR' },
                    ].map(row => (
                      <tr key={row.cat} className="border-b border-gray-50">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <row.icon className={`w-4 h-4 ${row.color}`} />
                            <span className="font-medium text-gray-900">{row.cat}</span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-3 font-bold text-gray-900">{row.weight}</td>
                        <td className="py-3 px-3 text-muted-foreground">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Score Breakdown</h2>
              <div className="space-y-4">
                {[
                  { title: 'Camera Score (0-10)', items: [
                    'Daylight photo quality (0-3 points)',
                    'Low-light/night mode (0-2 points)',
                    'Video recording quality (0-2 points)',
                    'Selfie/front camera (0-1.5 points)',
                    'Camera features & versatility (0-1.5 points)',
                  ]},
                  { title: 'Performance Score (0-10)', items: [
                    'Benchmark scores (AnTuTu/Geekbench normalized) (0-3 points)',
                    'Real-world app performance (0-2 points)',
                    'Gaming performance (0-2.5 points)',
                    'Thermal management (0-1.5 points)',
                    'Storage speed (0-1 point)',
                  ]},
                  { title: 'Battery Score (0-10)', items: [
                    'Screen-on time (0-3 points)',
                    'Charging speed (0-3 points)',
                    'Real-world endurance (0-2 points)',
                    'Standby efficiency (0-1 point)',
                    'Battery optimization features (0-1 point)',
                  ]},
                  { title: 'Display Score (0-10)', items: [
                    'Resolution and pixel density (0-2 points)',
                    'Maximum brightness (0-2 points)',
                    'Color accuracy and gamut (0-2 points)',
                    'Refresh rate (0-2 points)',
                    'Panel technology (AMOLED, IPS) (0-2 points)',
                  ]},
                  { title: 'Value Score (0-10)', items: [
                    'Specifications-to-price ratio (0-3 points)',
                    'Build quality and materials (0-2 points)',
                    'Software support and updates (0-2 points)',
                    'Included accessories (0-1.5 points)',
                    'Market competition comparison (0-1.5 points)',
                  ]},
                ].map(section => (
                  <div key={section.title} className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-2">{section.title}</h3>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {section.items.map(item => <li key={item} className="flex items-center gap-2"><span className="w-1 h-1 bg-gray-400 rounded-full shrink-0" />{item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Overall Rating Formula</h2>
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 font-mono text-sm text-gray-900">
                <p className="font-semibold mb-2">Overall Rating =</p>
                <p className="pl-4">(Camera x 0.25) + (Performance x 0.20) + (Battery x 0.20) + (Display x 0.15) + (Value x 0.20)</p>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mt-3">
                The final overall rating is rounded to one decimal place. For example, a phone scoring 8.5 in Camera, 7.0 in Performance, 8.0 in Battery, 9.0 in Display, and 7.5 in Value would receive:
              </p>
              <div className="p-3 bg-gray-50 rounded-xl mt-2 text-xs font-mono text-gray-700">
                (8.5 x 0.25) + (7.0 x 0.20) + (8.0 x 0.20) + (9.0 x 0.15) + (7.5 x 0.20) = 2.125 + 1.4 + 1.6 + 1.35 + 1.5 = <strong>7.975 ≈ 8.0</strong>
              </div>
            </section>

            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Rating Scale</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { range: '9.0 - 10', label: 'Exceptional', color: 'bg-emerald-500' },
                  { range: '7.5 - 8.9', label: 'Excellent', color: 'bg-blue-500' },
                  { range: '6.0 - 7.4', label: 'Good', color: 'bg-amber-500' },
                  { range: '4.0 - 5.9', label: 'Average', color: 'bg-orange-500' },
                  { range: '0 - 3.9', label: 'Below Average', color: 'bg-red-500' },
                ].map(item => (
                  <div key={item.label} className="text-center p-3 rounded-xl border border-gray-100">
                    <div className={`w-3 h-3 ${item.color} rounded-full mx-auto mb-1.5`} />
                    <p className="text-[10px] text-muted-foreground">{item.range}</p>
                    <p className="text-xs font-bold text-gray-900">{item.label}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}