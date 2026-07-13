import Link from 'next/link';
import { Smartphone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#0F172A] text-gray-400 mt-auto relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-extrabold text-lg text-white">Phone<span className="text-blue-400">Dock</span></span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-500">Pakistan&apos;s #1 smartphone database. Compare specs, prices, and find your perfect phone.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Popular Brands</h4>
            <div className="space-y-2.5 text-sm">
              {['Samsung', 'Apple', 'Xiaomi', 'OnePlus', 'Vivo', 'Oppo'].map(b => (
                <Link key={b} href={`/brands/${b.toLowerCase()}`} className="block text-gray-500 hover:text-blue-400 transition-colors duration-200">{b}</Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Quick Links</h4>
            <div className="space-y-2.5 text-sm">
              {[
                { l: 'Home', h: '/' }, { l: 'Compare', h: '/compare' }, { l: 'News', h: '/news' },
                { l: 'About', h: '/about' }, { l: 'Contact', h: '/contact' }, { l: 'Advertise', h: '/advertise' },
              ].map(item => (
                <Link key={item.l} href={item.h} className="block text-gray-500 hover:text-blue-400 transition-colors duration-200">{item.l}</Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Trust & Transparency</h4>
            <div className="space-y-2.5 text-sm">
              {[
                { l: 'Privacy Policy', h: '/privacy-policy' },
                { l: 'Terms & Conditions', h: '/terms' },
                { l: 'Disclaimer', h: '/disclaimer' },
                { l: 'Affiliate Disclosure', h: '/affiliate-disclosure' },
              ].map(item => (
                <Link key={item.l} href={item.h} className="block text-gray-500 hover:text-blue-400 transition-colors duration-200">{item.l}</Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">About Our Data</h4>
            <div className="space-y-2.5 text-sm">
              {[
                { l: 'Data Sources', h: '/data-sources' },
                { l: 'How We Test', h: '/how-we-test' },
                { l: 'Rating Methodology', h: '/rating-methodology' },
                { l: 'FAQ', h: '/faq' },
              ].map(item => (
                <Link key={item.l} href={item.h} className="block text-gray-500 hover:text-blue-400 transition-colors duration-200">{item.l}</Link>
              ))}
            </div>
          </div>
        </div>
        <div className="divider-glass mb-6" />
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-600">
          <p>&copy; 2025 PhoneDock. All rights reserved. Made for Pakistan.</p>
          <p className="text-cyan-400/60 font-medium">Phone prices may vary. Check with retailers.</p>
        </div>
      </div>
    </footer>
  );
}