import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { Megaphone, Eye, MousePointer, Star, BarChart3, Mail, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Advertise with PhoneDock',
  description: 'Advertise your phone brand or retail store on Pakistan\'s #1 smartphone database. Reach millions of phone buyers.',
  alternates: { canonical: `${getBaseUrl()}/advertise` },
};

export default function AdvertisePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#EFF6FF]/40 via-white to-white">
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20">
              <Megaphone className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display">Advertise with PhoneDock</h1>
            <p className="text-sm text-muted-foreground mt-2">Reach smartphone buyers exploring phones in Pakistan</p>
          </div>

          <div className="space-y-5 animate-fade-in">
            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Why PhoneDock?</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                PhoneDock is Pakistan&apos;s most comprehensive smartphone database, visited by hundreds of thousands of phone buyers every month. Our audience is highly targeted — people actively researching phones, comparing specs, and ready to make a purchase decision.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: Eye, label: 'Monthly Visitors', value: '100K+' },
                  { icon: MousePointer, label: 'Phone Page Views', value: '500K+' },
                  { icon: Star, label: 'Phones in Database', value: '1000+' },
                  { icon: BarChart3, label: 'Avg. Session Duration', value: '3+ min' },
                ].map(stat => (
                  <div key={stat.label} className="text-center p-3 bg-orange-50/50 rounded-xl border border-orange-100/50">
                    <stat.icon className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-4">Advertising Options</h2>
              <div className="space-y-3">
                {[
                  {
                    title: 'Sponsored Phone Listings',
                    desc: 'Feature your phones at the top of search results and category pages. Your listings stand out with a "Sponsored" badge and premium placement.',
                    highlights: ['Priority placement in search results', 'Featured on brand pages', 'Performance tracking dashboard'],
                  },
                  {
                    title: 'Banner Advertising',
                    desc: 'Display banner ads across PhoneDock in high-visibility positions including header, sidebar, and in-feed placements.',
                    highlights: ['Multiple size options', 'Contextual targeting by brand/price', 'Impression and click tracking'],
                  },
                  {
                    title: 'Brand Store Page',
                    desc: 'Get a dedicated brand page with your logo, description, featured products, and a direct link to your online store.',
                    highlights: ['Custom branded page', 'SEO-optimized for your brand', 'Direct store link'],
                  },
                  {
                    title: 'Content Sponsorship',
                    desc: 'Sponsor phone reviews, comparison articles, or "best of" listicles. Reach users in an editorial context with high engagement.',
                    highlights: ['Native content integration', 'Social media promotion', 'High engagement rates'],
                  },
                ].map(option => (
                  <div key={option.title} className="p-4 rounded-xl border border-gray-100 hover:border-orange-200 transition-colors">
                    <h3 className="text-sm font-bold text-gray-900 mb-1">{option.title}</h3>
                    <p className="text-xs text-gray-600 mb-2">{option.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {option.highlights.map(h => (
                        <span key={h} className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100/50 rounded-full px-2 py-0.5">
                          <CheckCircle className="w-2.5 h-2.5" />{h}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Get in Touch</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                Interested in advertising with PhoneDock? We&apos;d love to discuss how we can help you reach your target audience. Contact our partnerships team for custom packages, pricing, and availability.
              </p>
              <div className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Partnerships Email</p>
                  <p className="text-sm font-semibold text-gray-900">partnerships@phonedock.pk</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                We typically respond within 1-2 business days. Please include your company name, website, and advertising goals in your email.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}