'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/lib/useAdmin';

const PhoneForm = dynamic(() => import('@/components/admin/phone-form'), { ssr: false });

export default function AdminPhoneNewPage() {
  useAdmin();
  const router = useRouter();
  const [brands, setBrands] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [loadError, setLoadError] = useState('');

  const fetchBrands = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/brands?limit=200', { credentials: 'include' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to load brands');
      setBrands((d.brands || []).map((b: { id: string; name: string; slug: string }) => ({ id: b.id, name: b.name, slug: b.slug })));
      setLoadError('');
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Failed to load brands'); }
  }, []);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  return (
    <div className="animate-fade-in">
      {loadError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}. Phone creation is disabled until brands can be loaded.</div>}
      <PhoneForm brands={brands} onSave={() => router.push('/admin/phones')} onCancel={() => router.push('/admin/phones')} />
    </div>
  );
}
