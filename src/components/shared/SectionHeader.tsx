import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  icon: React.ElementType;
  link?: string;
  linkText?: string;
}

export function SectionHeader({ title, icon: Icon, link, linkText }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
        )}
        <h2 className="section-title truncate text-lg text-gray-900 sm:text-xl">
          {title}
        </h2>
      </div>
      {link && (
        <Link href={link} className="group inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-bold text-sky-600 transition hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:text-sm">
          {linkText || 'View All'} <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}