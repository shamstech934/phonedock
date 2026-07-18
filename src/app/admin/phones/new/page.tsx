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

  const fetchBrands = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/brands?limit=200', { credentials: 'include' });
      const d = await res.json();
      setBrands((d.brands || []).map((b: { id: string; name: string; slug: string }) => ({ id: b.id, name: b.name, slug: b.slug })));
    } catch {}
  }, []);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  return (
    <div className="animate-fade-in">
      <PhoneForm brands={brands} onSave={() => router.push('/admin/phones')} onCancel={() => router.push('/admin/phones')} />
    </div>
  );
}