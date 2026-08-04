'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle2, Globe2, Loader2, LockKeyhole, Save, ShieldCheck, UserRound } from 'lucide-react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { useUser } from '@/lib/useUser';

type Profile = {
  name: string;
  email: string;
  avatarUrl: string;
  country: string;
  timezone: string;
  preferredCurrency: string;
  preferredLanguage: string;
  notificationSettings: { email: boolean; priceDrops: boolean; ptaChanges: boolean; restock: boolean };
  privacySettings: { saveHistory: boolean; personalization: boolean };
};

const notificationLabels: Record<keyof Profile['notificationSettings'], { title: string; description: string }> = {
  email: { title: 'Account emails', description: 'Security and important account messages.' },
  priceDrops: { title: 'Price-drop alerts', description: 'Get notified when a saved phone becomes cheaper.' },
  ptaChanges: { title: 'PTA status changes', description: 'Updates when PTA approval information changes.' },
  restock: { title: 'Availability alerts', description: 'Know when a tracked phone becomes available again.' },
};

const privacyLabels: Record<keyof Profile['privacySettings'], { title: string; description: string }> = {
  saveHistory: { title: 'Save recently viewed phones', description: 'Keep a private list so you can return to phones quickly.' },
  personalization: { title: 'Personalized recommendations', description: 'Use your saved activity to improve recommendations.' },
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, refresh } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/profile');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setFetchError('');
    void fetch('/api/account/profile', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load your profile.');
        return response.json();
      })
      .then(data => { if (!cancelled) setProfile(data.profile || null); })
      .catch(error => { if (!cancelled) setFetchError(error instanceof Error ? error.message : 'Unable to load your profile.'); });
    return () => { cancelled = true; };
  }, [user]);

  const initials = useMemo(() => {
    const source = profile?.name || user?.name || 'P';
    return source.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
  }, [profile?.name, user?.name]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile || saving) return;
    setMessage('');
    setSaving(true);
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      setMessage(response.ok ? 'Profile and preferences saved.' : 'Unable to save profile. Please try again.');
      if (response.ok) await refresh();
    } catch {
      setMessage('Unable to save profile. Please check your connection.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || (!profile && !fetchError)) {
    return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="flex items-center gap-3 text-sm font-semibold text-slate-600"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Loading your profile…</div></div>;
  }

  if (fetchError || !profile) {
    return <><Header/><main className="grid min-h-[70vh] place-items-center bg-slate-50 px-4"><div className="max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm"><ShieldCheck className="mx-auto h-10 w-10 text-amber-500"/><h1 className="mt-4 text-xl font-black text-slate-950">Profile unavailable</h1><p className="mt-2 text-sm text-slate-500">{fetchError || 'Please sign in again and retry.'}</p><button type="button" onClick={() => window.location.reload()} className="mt-5 h-11 rounded-xl bg-blue-600 px-5 font-semibold text-white">Retry</button></div></main><Footer/></>;
  }

  const updateField = (key: keyof Pick<Profile, 'name' | 'avatarUrl' | 'country' | 'timezone' | 'preferredCurrency' | 'preferredLanguage'>, value: string) => setProfile(current => current ? { ...current, [key]: value } : current);

  return (
    <div className="min-h-screen bg-slate-50/80">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-600 via-blue-600 to-cyan-500 p-6 text-white shadow-lg shadow-blue-900/10 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-3xl border border-white/30 bg-white/15 text-2xl font-black backdrop-blur">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-100">PhoneDock account</p>
              <h1 className="mt-1 truncate text-3xl font-black tracking-tight">{profile.name || 'Your profile'}</h1>
              <p className="mt-1 truncate text-sm text-blue-100">{profile.email}</p>
            </div>
          </div>
        </div>

        <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-600"><UserRound className="h-5 w-5"/></div><div><h2 className="font-black text-slate-950">Personal details</h2><p className="text-sm text-slate-500">Used to personalize your PhoneDock experience.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Name<input value={profile.name} maxLength={80} required onChange={event => updateField('name', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
              <label className="text-sm font-semibold text-slate-700">Email<input value={profile.email} readOnly className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 font-normal text-slate-500" /></label>
              <label className="sm:col-span-2 text-sm font-semibold text-slate-700">Avatar URL<input type="url" value={profile.avatarUrl} onChange={event => updateField('avatarUrl', event.target.value)} placeholder="https://…" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
            </div>

            <div className="my-7 h-px bg-slate-100" />
            <div className="mb-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-600"><Globe2 className="h-5 w-5"/></div><div><h2 className="font-black text-slate-950">Regional preferences</h2><p className="text-sm text-slate-500">Control currency, language and time formatting.</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Country code<input value={profile.country} maxLength={2} onChange={event => updateField('country', event.target.value.toUpperCase())} placeholder="PK" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
              <label className="text-sm font-semibold text-slate-700">Timezone<input value={profile.timezone} onChange={event => updateField('timezone', event.target.value)} placeholder="Asia/Karachi" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
              <label className="text-sm font-semibold text-slate-700">Currency<select value={profile.preferredCurrency} onChange={event => updateField('preferredCurrency', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="PKR">PKR — Pakistani Rupee</option><option value="USD">USD — US Dollar</option><option value="AED">AED — UAE Dirham</option></select></label>
              <label className="text-sm font-semibold text-slate-700">Language<select value={profile.preferredLanguage} onChange={event => updateField('preferredLanguage', event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="en">English</option><option value="ur">Urdu</option><option value="roman-ur">Roman Urdu</option></select></label>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-600"><Bell className="h-5 w-5"/></div><div><h2 className="font-black text-slate-950">Notifications</h2><p className="text-sm text-slate-500">Choose the alerts that matter to you.</p></div></div>
              <div className="space-y-3">{(Object.keys(notificationLabels) as Array<keyof Profile['notificationSettings']>).map(key => { const item = notificationLabels[key]; return <label key={key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 p-3.5 transition hover:border-blue-200 hover:bg-blue-50/40"><input type="checkbox" checked={profile.notificationSettings[key]} onChange={event => setProfile({ ...profile, notificationSettings: { ...profile.notificationSettings, [key]: event.target.checked } })} className="mt-1 h-4 w-4 accent-blue-600"/><span><span className="block text-sm font-bold text-slate-800">{item.title}</span><span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{item.description}</span></span></label>; })}</div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><LockKeyhole className="h-5 w-5"/></div><div><h2 className="font-black text-slate-950">Privacy</h2><p className="text-sm text-slate-500">You remain in control of personalization.</p></div></div>
              <div className="space-y-3">{(Object.keys(privacyLabels) as Array<keyof Profile['privacySettings']>).map(key => { const item = privacyLabels[key]; return <label key={key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 p-3.5 transition hover:border-emerald-200 hover:bg-emerald-50/40"><input type="checkbox" checked={profile.privacySettings[key]} onChange={event => setProfile({ ...profile, privacySettings: { ...profile.privacySettings, [key]: event.target.checked } })} className="mt-1 h-4 w-4 accent-emerald-600"/><span><span className="block text-sm font-bold text-slate-800">{item.title}</span><span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{item.description}</span></span></label>; })}</div>
            </section>

            <div className="sticky bottom-4 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl shadow-slate-900/10 backdrop-blur">
              {message && <p role="status" className={`mb-3 flex items-center gap-2 text-sm font-semibold ${message.startsWith('Profile') ? 'text-emerald-700' : 'text-red-600'}`}>{message.startsWith('Profile') && <CheckCircle2 className="h-4 w-4"/>}{message}</p>}
              <button disabled={saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}{saving ? 'Saving…' : 'Save profile'}</button>
            </div>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}
