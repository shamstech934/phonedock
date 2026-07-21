'use client';

import { ExternalLink } from 'lucide-react';
import { trackAffiliateClick } from '@/lib/analytics';

type Props = {
  partner: 'daraz' | 'priceoye' | 'mega';
  phoneSlug: string;
  className?: string;
  children?: React.ReactNode;
};

export function AffiliateButton({ partner, phoneSlug, className = '', children }: Props) {
  const href = `/api/affiliate?partner=${encodeURIComponent(partner)}&phone=${encodeURIComponent(phoneSlug)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      onClick={() => trackAffiliateClick(partner, href, phoneSlug)}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 ${className}`}
    >
      {children || `Buy on ${partner.charAt(0).toUpperCase()}${partner.slice(1)}`}
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}
