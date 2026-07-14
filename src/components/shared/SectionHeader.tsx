'use client';

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
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-5 h-5 text-blue-500" />}
        <h2 className="section-title text-lg sm:text-xl text-gray-900">
          {title}
        </h2>
      </div>
      {link && (
        <Link href={link} className="text-sm font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1 transition-colors">
          {linkText || 'View All'} <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}