'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Smartphone, TrendingUp } from 'lucide-react';

export function HomeHeroSearch() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const submit = () => {
    const value = query.trim();
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <>
      <div className="hero-search-slide flex gap-2 max-w-xl" style={{ animationDelay: '0.7s' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          <input
            placeholder="Phone name, brand..."
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && submit()}
            className="w-full pl-9 sm:pl-12 pr-3 sm:pr-4 h-10 sm:h-12 text-xs sm:text-sm rounded-xl bg-white/15 backdrop-blur-xl text-white outline-none focus:ring-2 focus:ring-blue-400/40 focus:bg-white/20 border border-white/10 placeholder:text-gray-400 transition-all"
            aria-label="Search phones"
          />
        </div>
        <button onClick={submit} className="glass-float text-white h-10 sm:h-12 px-4 sm:px-6 text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Search
        </button>
      </div>

      <div className="hero-animate flex flex-wrap gap-2 sm:gap-3 mt-4 sm:mt-6" style={{ animationDelay: '0.9s' }}>
        <Link href="/phones" className="btn-glass text-white hover:bg-white/15 font-semibold h-9 sm:h-10 px-4 sm:px-5 border border-white/20 text-xs sm:text-sm rounded-md inline-flex items-center">
          <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> Browse Phones
        </Link>
        <Link href="/compare" className="btn-glass text-white hover:bg-white/15 font-semibold h-9 sm:h-10 px-4 sm:px-5 border border-white/20 text-xs sm:text-sm rounded-md inline-flex items-center">
          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> Compare
        </Link>
      </div>
    </>
  );
}
