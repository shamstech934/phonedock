'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/lib/useAdmin';

const PhoneForm = dynamic(() => import('@/components/admin/phone-form'), { ssr: false });

export default function AdminPhoneEditPage() {
  useAdmin();
  const router = useRouter();
  const { id } = useParams();

  return (
    <div className="animate-fade-in">
      <PhoneForm phoneId={id as string} brands={[]} onSave={() => router.push('/admin/phones')} onCancel={() => router.push('/admin/phones')} />
    </div>
  );
}