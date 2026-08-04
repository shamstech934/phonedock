import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'PhoneDock privacy policy. Learn how we collect, use, and protect your personal information when you visit our website.',
  alternates: { canonical: `${getBaseUrl()}/privacy-policy` },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#EFF6FF]/40 via-white to-white">
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8 animate-fade-in">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display">Privacy Policy</h1>
            <p className="text-xs text-muted-foreground mt-2">Last updated: January 2025</p>
          </div>

          <div className="card-premium p-6 sm:p-8 animate-fade-in prose-sm">
            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">1. Introduction</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                PhoneDock (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website phonedock.pk (the &quot;Site&quot;). This policy applies to all visitors, users, and others who access the Site.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">2. Information We Collect</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-2">We may collect the following types of information:</p>
              <ul className="text-sm text-gray-600 leading-relaxed space-y-1.5 list-disc pl-5">
                <li><strong>Usage Data:</strong> We automatically collect information about how you interact with our Site, including pages visited, time spent on pages, search queries, phone models viewed, and comparison data. This helps us improve our services.</li>
                <li><strong>Device Information:</strong> We collect your IP address, browser type, browser version, operating system, device type, and screen resolution to optimize your experience.</li>
                <li><strong>Cookies:</strong> We use cookies and similar tracking technologies to enhance your browsing experience, remember your preferences (such as dark mode), and analyze site traffic.</li>
                <li><strong>Contact Information:</strong> If you contact us through our contact form, we collect your name, email address, and the content of your message.</li>
                <li><strong>Admin Data:</strong> For registered administrators, we store login credentials (encrypted), access logs, and management activity.</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">3. How We Use Your Information</h2>
              <p className="text-sm text-gray-600 leading-relaxed">We use the collected information for the following purposes:</p>
              <ul className="text-sm text-gray-600 leading-relaxed space-y-1.5 list-disc pl-5 mt-2">
                <li>To provide, maintain, and improve our phone database and comparison tools</li>
                <li>To personalize your experience, including remembering your preferences</li>
                <li>To analyze usage trends and optimize site performance</li>
                <li>To respond to your inquiries and requests</li>
                <li>To detect and prevent fraud or abuse of our platform</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">4. Cookies</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                PhoneDock uses cookies — small text files placed on your device — to enhance your experience. We use both session cookies (which expire when you close your browser) and persistent cookies (which remain until they expire or are deleted). You can control cookies through your browser settings; however, disabling cookies may affect certain features of the Site.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">
                We also use third-party analytics services (such as Google Analytics) that may set their own cookies to help us understand how visitors use our Site.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">5. Third-Party Services</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Our Site may contain links to third-party websites, including online retailers and comparison partners. We are not responsible for the privacy practices of these third-party sites. We encourage you to review their privacy policies before providing any personal information. Additionally, we may use third-party services for analytics, advertising, and content delivery, each with their own privacy policies.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">6. Data Sharing</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                We do not sell, trade, or rent your personal information to third parties. We may share anonymized, aggregated data with partners for analytical purposes. We may also disclose information if required by law, in response to a legal process, or to protect our rights or the safety of others.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">7. Your Rights</h2>
              <p className="text-sm text-gray-600 leading-relaxed">You have the right to:</p>
              <ul className="text-sm text-gray-600 leading-relaxed space-y-1.5 list-disc pl-5 mt-2">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your personal data (subject to legal obligations)</li>
                <li>Opt out of non-essential cookies through your browser settings</li>
                <li>Withdraw consent for any data processing based on your consent</li>
              </ul>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">
                To exercise any of these rights, please contact us at privacy@phonedock.pk.
              </p>
            </section>

            <section className="mb-6">
              <h2 className="font-bold text-lg text-gray-900 mb-2">8. Data Security</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-lg text-gray-900 mb-2">9. Changes to This Policy</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated &quot;Last updated&quot; date. We encourage you to review this policy periodically to stay informed about how we protect your information.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-3">
                If you have any questions about this Privacy Policy, please contact us at <strong>privacy@phonedock.pk</strong>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}