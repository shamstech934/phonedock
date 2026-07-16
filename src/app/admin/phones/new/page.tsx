'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/lib/useAdmin';

const PhoneForm = dynamic(() => import('@/components/admin/phone-form'), { ssr: false });

export default function AdminPhoneNewPage() {
  useAdmin();
  const router = useRouter();

  return (
    <div className="animate-fade-in">
      <PhoneForm brands={[]} onSave={() => router.push('/admin/phones')} onCancel={() => router.push('/admin/phones')} />
    </div>
  );
}