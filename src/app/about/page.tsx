import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { Smartphone, Target, Users, Mail, Globe, Heart } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about PhoneDock — Pakistan\'s most comprehensive smartphone database. Our mission, team, and commitment to helping Pakistanis find the perfect phone.',
  alternates: { canonical: `${getBaseUrl()}/about` },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#EFF6FF]/40 via-white to-white">
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
              <Smartphone className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display">About PhoneDock</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">Pakistan&apos;s most trusted smartphone database, helping millions make informed purchasing decisions.</p>
          </div>

          <div className="space-y-6 animate-fade-in">
            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Our Mission</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                PhoneDock was founded with a simple yet powerful mission: to make smartphone shopping in Pakistan transparent, informed, and hassle-free. With hundreds of phones launching every year across dozens of brands, finding the right phone at the right price can be overwhelming. We exist to solve that problem.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-3">
                We believe every Pakistani deserves access to accurate, up-to-date phone specifications, honest pricing information, and PTA compliance details — all in one place. Our database covers every major brand available in Pakistan, from Samsung and Apple to Xiaomi, Realme, Infinix, Tecno, OnePlus, and more.
              </p>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Target, title: 'Accuracy First', desc: 'Every spec and price is verified against official sources and retailer data.' },
                { icon: Globe, title: 'Pakistan-Focused', desc: 'Built specifically for Pakistani consumers with PTA status, local pricing, and Urdu support.' },
                { icon: Heart, title: 'Free Forever', desc: 'Our core database and comparison tools will always be free for all users.' },
              ].map(item => (
                <div key={item.title} className="card-premium p-5 text-center">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <item.icon className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className="font-bold text-sm text-gray-900">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1.5">{item.desc}</p>
                </div>
              ))}
            </div>

            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Our Team</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                PhoneDock is run by a small team of smartphone enthusiasts, tech writers, and software engineers based in Pakistan. Our team combines deep knowledge of the mobile industry with a passion for building tools that genuinely help people.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-3">
                We independently test and review phones, maintain our database with daily updates, and work to ensure our pricing data reflects the real market conditions across Pakistan&apos;s major cities — from Karachi to Lahore, Islamabad to Peshawar.
              </p>
            </section>

            <section className="card-premium p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Contact Us</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium text-gray-900">info@phonedock.pk</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">For Business</p>
                    <p className="text-sm font-medium text-gray-900">partnerships@phonedock.pk</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}