'use client';

import { useState } from 'react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import Link from 'next/link';
import { HelpCircle, ChevronDown } from 'lucide-react';

const faqs = [
  {
    category: 'General',
    questions: [
      { q: 'What is PhoneDock?', a: 'PhoneDock is Pakistan\'s most comprehensive smartphone database. We provide detailed specifications, pricing in Pakistani Rupees (PKR), PTA approval status, comparison tools, and expert reviews for all major phone brands available in Pakistan.' },
      { q: 'Is PhoneDock free to use?', a: 'Yes, PhoneDock is completely free. Our core features — phone database, comparison tools, and reviews — will always be free. We may show advertisements and affiliate links to support our operations.' },
      { q: 'How often is the data updated?', a: 'Phone prices are updated daily, specifications are verified weekly, and new phones are added within 24-48 hours of their official announcement. PTA status is checked bi-weekly against the official DIRBS database.' },
      { q: 'Do you sell phones?', a: 'No, PhoneDock is an information and comparison platform. We do not sell phones directly. However, we provide links to authorized retailers where you can purchase phones at the best available prices.' },
    ],
  },
  {
    category: 'Pricing',
    questions: [
      { q: 'Are the prices accurate?', a: 'We strive to provide the most accurate market prices possible. Prices are collected from multiple online and offline retailers across Pakistan. However, actual prices may vary by retailer, city, and timing. We recommend verifying the price with the retailer before purchasing.' },
      { q: 'Why do prices differ between cities?', a: 'Phone prices in Pakistan can vary between cities due to differences in local taxes, import duties, demand, and retailer margins. We show approximate national average prices, but your local market price may be different.' },
      { q: 'Do prices include tax?', a: 'Our listed prices represent approximate market retail prices and generally include standard sales tax. However, additional taxes or duties may apply depending on the purchase method and location.' },
    ],
  },
  {
    category: 'PTA & Regulations',
    questions: [
      { q: 'What does PTA Approved mean?', a: 'PTA (Pakistan Telecommunication Authority) approval means the device is officially registered and authorized for use on Pakistani mobile networks. Non-PTA-approved phones may face network blocking or penalties. Always verify PTA status on the official DIRBS portal (dirbs.pta.gov.pk) before purchasing.' },
      { q: 'How do I check if my phone is PTA approved?', a: 'You can check PTA status by visiting the official DIRBS portal at dirbs.pta.gov.pk and entering your phone\'s IMEI number. You can find your IMEI by dialing *#06# on your phone.' },
      { q: 'What happens if I use a non-PTA phone?', a: 'Using a non-PTA-approved phone in Pakistan may result in your device being blocked from mobile networks. PTA conducts regular IMEI checks and blocks unregistered devices. You may also face fines. We strongly recommend only using PTA-approved devices.' },
    ],
  },
  {
    category: 'Features & Tools',
    questions: [
      { q: 'How does the comparison tool work?', a: 'Our comparison tool lets you select up to 3 phones and compare them side-by-side across all specifications, prices, ratings, and PTA status. Simply search for phones and add them to the comparison to see a detailed breakdown.' },
      { q: 'How are phone ratings calculated?', a: 'PhoneDock ratings are based on five categories: Camera (25%), Performance (20%), Battery (20%), Display (15%), and Value for Money (20%). Each category is scored 0-10 based on testing and analysis. For full details, see our Rating Methodology page.' },
      { q: 'Can I suggest a phone to be added?', a: 'Yes! If a phone is missing from our database, please use the Contact page to send us the phone name and brand. We\'ll add it as soon as possible, typically within 24-48 hours.' },
    ],
  },
];

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#EFF6FF]/40 via-white to-white">
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
              <HelpCircle className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display">Frequently Asked Questions</h1>
            <p className="text-sm text-muted-foreground mt-2">Find answers to common questions about PhoneDock</p>
          </div>

          <div className="space-y-6 animate-fade-in">
            {faqs.map(section => (
              <div key={section.category}>
                <h2 className="font-bold text-sm text-gray-900 mb-3 uppercase tracking-wider text-muted-foreground">{section.category}</h2>
                <div className="space-y-2">
                  {section.questions.map((faq, i) => {
                    const key = `${section.category}-${i}`;
                    const isOpen = openItems.has(key);
                    return (
                      <div key={key} className="card-premium overflow-hidden">
                        <button
                          onClick={() => toggle(key)}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-white/50 transition-colors"
                        >
                          <span className="text-sm font-semibold text-gray-900 pr-4">{faq.q}</span>
                          <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 pt-0 animate-fade-in">
                            <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="card-premium p-6 mt-8 text-center animate-fade-in">
            <p className="text-sm text-gray-600">Still have questions?</p>
            <Link href="/contact" className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors">
              Contact us and we&apos;ll be happy to help
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}