import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { Link2, ExternalLink } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure',
  description: 'PhoneDock affiliate link disclosure — how we earn revenue and maintain editorial independence.',
  alternates: { canonical: `${getBaseUrl()}/affiliate-disclosure` },
};

export default function AffiliateDisclosurePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#EFF6FF]/40 via-white to-white">
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <Link2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display">Affiliate Disclosure</h1>
            <p className="text-sm text-muted-foreground mt-2">Transparency about how PhoneDock earns revenue</p>
          </div>

          <div className="card-premium p-6 sm:p-8 animate-fade-in">
            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">How We Earn Revenue</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                PhoneDock is a free resource for smartphone buyers in Pakistan. To keep our service free and to cover the costs of running this website — including server hosting, data collection, content creation, and team salaries — we participate in affiliate marketing programs.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-3">
                This means that when you click on links to online retailers (such as Daraz, Telemart, PriceOye, and others) from our website and make a purchase, we may receive a small commission from that retailer. This commission comes at <strong>no additional cost to you</strong> — the price you pay is exactly the same whether you use our link or go directly to the retailer.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">Editorial Independence</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Our affiliate relationships do not influence our editorial content, phone ratings, reviews, or recommendations. We rate and review phones based solely on their merits — specifications, performance, value for money, and relevance to Pakistani consumers. We will never:
              </p>
              <ul className="text-sm text-gray-600 leading-relaxed space-y-1.5 list-disc pl-5 mt-3">
                <li>Give a phone a higher rating because of an affiliate relationship</li>
                <li>Feature a phone prominently in exchange for payment (unless clearly marked as sponsored)</li>
                <li>Alter specifications, pricing, or PTA status to benefit any partner</li>
                <li>Suppress negative information about a phone to protect an affiliate relationship</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">Identifying Affiliate Links</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Some of the links on PhoneDock are affiliate links. We may mark these with a small disclosure icon <ExternalLink className="w-3 h-3 inline" /> or label them as &quot;Shop&quot; or &quot;Buy Now&quot; links. When you click on these links, you will be redirected to our partner&apos;s website to complete your purchase.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">Sponsored Content</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                PhoneDock may accept sponsored content or advertising from phone brands and retailers. Any sponsored content will be clearly labeled as such and will always maintain our editorial standards. Sponsored content does not affect our phone database, ratings, or comparison tools.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-lg text-gray-900 mb-2">Questions?</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                If you have any questions about our affiliate relationships or this disclosure, please contact us at <strong>legal@phonedock.pk</strong>. We believe in full transparency and are happy to answer any questions you may have about how we operate.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}