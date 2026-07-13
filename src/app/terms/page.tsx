import type { Metadata } from 'next';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'Terms and conditions for using PhoneDock — Pakistan\'s smartphone database and comparison platform.',
  alternates: { canonical: 'https://phonedock.pk/terms' },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#EFF6FF]/40 via-white to-white">
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8 animate-fade-in">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display">Terms and Conditions</h1>
            <p className="text-xs text-muted-foreground mt-2">Last updated: January 2025</p>
          </div>

          <div className="card-premium p-6 sm:p-8 animate-fade-in">
            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">1. Acceptance of Terms</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                By accessing and using PhoneDock (phonedock.pk), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our website. We reserve the right to modify these terms at any time, and your continued use of the Site constitutes acceptance of any changes.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">2. Description of Service</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                PhoneDock provides a smartphone information database, including phone specifications, pricing information (in Pakistani Rupees), PTA status details, comparison tools, and related content. Our service is provided &quot;as is&quot; and is intended for informational and educational purposes only.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">3. Use of the Website</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-2">You agree to use PhoneDock only for lawful purposes. You may not:</p>
              <ul className="text-sm text-gray-600 leading-relaxed space-y-1.5 list-disc pl-5">
                <li>Use the Site in any way that violates applicable laws or regulations</li>
                <li>Attempt to gain unauthorized access to any portion of the Site</li>
                <li>Scrape, crawl, or extract data from the Site without prior written permission</li>
                <li>Reproduce, duplicate, or copy content from the Site for commercial redistribution</li>
                <li>Use automated tools (bots, scrapers) to access the Site in a manner that overloads our infrastructure</li>
                <li>Interfere with or disrupt the Site or servers or networks connected to the Site</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">4. Accuracy of Information</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                While we strive to ensure the accuracy and timeliness of all information on PhoneDock, we make no warranties or representations about the completeness, reliability, or accuracy of this information. Phone specifications, prices, PTA statuses, and other data may change without notice. Prices listed are approximate market prices and may vary by retailer, city, and time.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">5. Pricing Disclaimer</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                All prices displayed on PhoneDock are in Pakistani Rupees (PKR) and are approximate market rates. Actual prices may vary depending on the retailer, location, promotions, and market conditions. PhoneDock is not a retailer and does not sell phones. We are not responsible for any pricing discrepancies between our listed prices and actual retail prices.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">6. Intellectual Property</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                All content on PhoneDock, including text, graphics, logos, images, data compilations, and software, is the property of PhoneDock or its content suppliers and is protected by applicable intellectual property laws. You may not reproduce, distribute, modify, create derivative works from, or commercially exploit any content without our express written permission.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">7. Third-Party Links</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Our Site may contain links to third-party websites, including online retailers and service providers. These links are provided for convenience only and do not signify endorsement. We are not responsible for the content, privacy practices, or availability of external sites.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">8. Limitation of Liability</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                To the fullest extent permitted by law, PhoneDock shall not be liable for any direct, indirect, incidental, consequential, or special damages arising from your use of or inability to use the Site, including but not limited to damages for loss of profits, goodwill, data, or other intangible losses, even if we have been advised of the possibility of such damages.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">9. Governing Law</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                These Terms and Conditions are governed by and construed in accordance with the laws of the Islamic Republic of Pakistan. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts of Pakistan.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-lg text-gray-900 mb-2">10. Contact</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                For any questions regarding these Terms and Conditions, please contact us at <strong>legal@phonedock.pk</strong>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}