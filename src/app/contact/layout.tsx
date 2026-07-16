import type { Metadata } from 'next';
import { getBaseUrl } from '@/lib/urls';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the PhoneDock team. Report errors, ask questions, or send suggestions about Pakistan\'s smartphone database.',
  alternates: { canonical: `${getBaseUrl()}/contact` },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}