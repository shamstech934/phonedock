import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { AlertTriangle, Shield, Info } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Disclaimer',
  description: 'Important disclaimers about pricing, PTA status, and general website usage on PhoneDock.',
  alternates: { canonical: `${getBaseUrl()}/disclaimer` },
};

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#EFF6FF]/40 via-white to-white">
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display">Disclaimer</h1>
            <p className="text-sm text-muted-foreground mt-2">Important information about using PhoneDock</p>
          </div>

          <div className="space-y-5 animate-fade-in">
            <section className="card-premium p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <h2 className="font-bold text-lg text-gray-900">Pricing Disclaimer</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                All phone prices displayed on PhoneDock are in Pakistani Rupees (PKR) and represent <strong>approximate market prices</strong> at the time of our last update. These prices are compiled from various online and offline retailers across Pakistan, including but not limited to Daraz, Telemart, PriceOye, and physical markets in major cities.
              </p>
              <ul className="text-sm text-gray-600 leading-relaxed space-y-1.5 list-disc pl-5 mt-3">
                <li>Actual prices may vary significantly from our listed prices</li>
                <li>Prices may differ between cities (Karachi, Lahore, Islamabad, etc.)</li>
                <li>Promotional prices, flash sales, and bundle deals are not always reflected</li>
                <li>Tax and shipping costs may apply and are not included in listed prices</li>
                <li>PhoneDock is <strong>not a retailer</strong> and does not sell any products</li>
              </ul>
              <p className="text-sm text-gray-600 leading-relaxed mt-3">
                We strongly recommend verifying the current price with the retailer before making any purchase decision.
              </p>
            </section>

            <section className="card-premium p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-blue-500" />
                </div>
                <h2 className="font-bold text-lg text-gray-900">PTA Disclaimer</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                PhoneDock provides PTA (Pakistan Telecommunication Authority) approval status information as a convenience to our users. However, we want to make the following clear:
              </p>
              <ul className="text-sm text-gray-600 leading-relaxed space-y-1.5 list-disc pl-5 mt-3">
                <li>PTA approval statuses are sourced from publicly available PTA databases and manufacturer declarations</li>
                <li>PTA status may change at any time as new devices are approved or regulations change</li>
                <li>We do <strong>not</strong> guarantee the accuracy of PTA status information</li>
                <li>Always verify PTA approval status directly through the <strong>PTA Device Identification, Registration and Blocking System (DIRBS)</strong> at <strong>dirbs.pta.gov.pk</strong> before purchasing a device</li>
                <li>Using non-PTA-approved devices in Pakistan may result in network blocking or penalties</li>
              </ul>
              <p className="text-sm text-gray-600 leading-relaxed mt-3">
                The PTA status listed on PhoneDock should be used as a starting point for research, not as a definitive legal reference.
              </p>
            </section>

            <section className="card-premium p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Info className="w-4 h-4 text-gray-500" />
                </div>
                <h2 className="font-bold text-lg text-gray-900">General Website Disclaimer</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                The information provided on PhoneDock is for general informational purposes only. While we strive to keep the information up to date and correct, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability, or availability with respect to the website or the information, products, services, or related graphics contained on the website for any purpose.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-3">
                Any reliance you place on such information is therefore strictly at your own risk. In no event will we be liable for any loss or damage, including without limitation, indirect or consequential loss or damage, or any loss or damage whatsoever arising from loss of data or profits arising out of, or in connection with, the use of this website.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}