import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { Database, RefreshCw, Globe, CheckCircle, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Data Sources',
  description: 'Learn where PhoneDock gets its phone data, our methodology, and how often we update our database.',
  alternates: { canonical: `${getBaseUrl()}/data-sources` },
};

export default function DataSourcesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#EFF6FF]/40 via-white to-white">
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
              <Database className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display">Data Sources</h1>
            <p className="text-sm text-muted-foreground mt-2">Where we get our data and how we keep it accurate</p>
          </div>

          <div className="space-y-5 animate-fade-in">
            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Our Data Sources</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                PhoneDock compiles phone data from multiple authoritative sources to ensure accuracy and comprehensiveness. Our data pipeline combines automated collection with manual verification:
              </p>
              <div className="space-y-3">
                {[
                  { icon: Globe, title: 'Official Manufacturer Sources', desc: 'Phone specifications are primarily sourced from official manufacturer websites (Samsung.com, Apple.com, Xiaomi.com, etc.) and press releases. This ensures baseline accuracy for all technical specifications.' },
                  { icon: Database, title: 'Authorized Distributors', desc: 'We work with authorized distributors and regional offices in Pakistan to verify local variants, PTA approval status, and Pakistan-specific model information.' },
                  { icon: FileText, title: 'GSMArena & Industry Databases', desc: 'We reference established industry databases for cross-verification of specifications, benchmark scores, and release information. All data is cross-checked against multiple sources.' },
                  { icon: RefreshCw, title: 'Retailer Price Monitoring', desc: 'Prices are collected from major Pakistani online retailers including Daraz, Telemart, PriceOye, Homeshopping, and physical market rates from major cities. We track prices across multiple retailers to provide a representative market price.' },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                      <item.icon className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                      <p className="text-xs text-gray-600 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Methodology</h2>
              <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <p><strong>Collection:</strong> Our automated collectors gather data from configured sources on a regular schedule, pulling specifications, images, and availability information.</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <p><strong>Verification:</strong> All collected data goes through a review process where specifications are cross-referenced against at least two independent sources before publication.</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <p><strong>Normalization:</strong> Data is normalized to a consistent format (e.g., converting storage to GB, display sizes to inches, battery to mAh) for accurate comparisons.</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <p><strong>Local Context:</strong> We add Pakistan-specific data such as PTA status, local pricing, and market availability that may not be available from international sources.</p>
                </div>
              </div>
            </section>

            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Update Frequency</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Phone Prices', freq: 'Daily', detail: 'Market prices are refreshed daily from multiple retailers' },
                  { label: 'Specifications', freq: 'Weekly', detail: 'Specs are verified weekly for existing phones' },
                  { label: 'New Phones', freq: 'As Launched', detail: 'New phones are added within 24-48 hours of announcement' },
                  { label: 'PTA Status', freq: 'Bi-weekly', detail: 'PTA approval status checked against official DIRBS database' },
                ].map(item => (
                  <div key={item.label} className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-900">{item.label}</p>
                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{item.freq}</span>
                    </div>
                    <p className="text-[10px] text-gray-600">{item.detail}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Last full database refresh: January 2025. Individual records are updated on an ongoing basis.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}