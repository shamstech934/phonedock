'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { useUser } from '@/lib/useUser';

type Profile = { name: string; email: string; avatarUrl: string; country: string; timezone: string; preferredCurrency: string; preferredLanguage: string; notificationSettings: { email: boolean; priceDrops: boolean; ptaChanges: boolean; restock: boolean }; privacySettings: { saveHistory: boolean; personalization: boolean } };

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, refresh } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => { if (!loading && !user) router.replace('/login?redirect=/profile'); }, [loading, user, router]);
  useEffect(() => { if (user) void fetch('/api/account/profile', { cache: 'no-store' }).then(res => res.json()).then(data => setProfile(data.profile || null)); }, [user]);
  async function save(event: FormEvent) { event.preventDefault(); if (!profile) return; setMessage(''); const response = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) }); setMessage(response.ok ? 'Profile saved.' : 'Unable to save profile.'); if (response.ok) await refresh(); }
  if (!profile) return <div className="grid min-h-screen place-items-center">Loading...</div>;
  const field = (key: keyof Pick<Profile, 'name' | 'avatarUrl' | 'country' | 'timezone' | 'preferredCurrency' | 'preferredLanguage'>, label: string) => <label className="block text-sm font-medium">{label}<input value={profile[key]} onChange={event => setProfile({ ...profile, [key]: event.target.value })} className="mt-1 h-11 w-full rounded-xl border px-3" /></label>;
  return <><Header/><main className="min-h-[70vh] bg-slate-50 px-4 py-10"><form onSubmit={save} className="mx-auto max-w-2xl space-y-5 rounded-2xl border bg-white p-6 shadow-sm"><div><h1 className="text-2xl font-extrabold">Profile</h1><p className="text-sm text-slate-500">Manage your account preferences and privacy.</p></div><div className="grid gap-4 sm:grid-cols-2">{field('name','Name')}{field('avatarUrl','Avatar URL')}{field('country','Country code')}{field('timezone','Timezone')}{field('preferredCurrency','Currency')}{field('preferredLanguage','Language')}</div><fieldset className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"><legend className="px-2 font-semibold">Notifications</legend>{Object.entries(profile.notificationSettings).map(([key,value])=><label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value} onChange={event=>setProfile({...profile,notificationSettings:{...profile.notificationSettings,[key]:event.target.checked}})}/>{key}</label>)}</fieldset><fieldset className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"><legend className="px-2 font-semibold">Privacy</legend>{Object.entries(profile.privacySettings).map(([key,value])=><label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value} onChange={event=>setProfile({...profile,privacySettings:{...profile.privacySettings,[key]:event.target.checked}})}/>{key}</label>)}</fieldset>{message&&<p role="status" className="text-sm">{message}</p>}<button className="h-11 rounded-xl bg-blue-600 px-5 font-semibold text-white">Save profile</button></form></main><Footer/></>;
}
