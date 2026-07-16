import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';

export const metadata: Metadata = {
  title: 'FAQ - Frequently Asked Questions',
  description: 'Find answers to common questions about PhoneDock — pricing, PTA status, phone ratings, comparison tools, and more.',
  alternates: { canonical: `${getBaseUrl()}/faq` },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}