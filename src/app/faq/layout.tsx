import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ - Frequently Asked Questions',
  description: 'Find answers to common questions about PhoneDock — pricing, PTA status, phone ratings, comparison tools, and more.',
  alternates: { canonical: 'https://phonedock.pk/faq' },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}