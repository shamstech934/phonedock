'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';
import type { Brand } from '@/components/shared/types';

export default function AdminBrandsPage() {
  const { token } = useAdmin();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/brands', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setBrands(d.brands || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-36 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">Manage Brands</h1>
        <span className="text-xs text-muted-foreground">{brands.length} brands</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {brands.map(brand => (
          <div key={brand.id} className="card-premium p-5 hover:shadow-md hover:shadow-black/5 transition-all duration-300">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                {brand.logo ? <Image src={brand.logo} alt={brand.name} width={32} height={32} className="object-contain" unoptimized /> : <Layers className="w-6 h-6 text-gray-400" />}
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900">{brand.name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{brand.slug}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{brand.country || 'N/A'}</span>
              <Badge variant="secondary" className="text-[10px]">{brand._count?.phones || 0} phones</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}