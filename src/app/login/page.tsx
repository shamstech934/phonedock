'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { useUser } from '@/lib/useUser';

export default function LoginPage() {
  const router = useRouter(); const params = useSearchParams(); const { user, refresh } = useUser();
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [remember,setRemember]=useState(false); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  useEffect(()=>{ if(user) router.replace(params.get('redirect') || '/account'); },[user,router,params]);
  async function submit(e:FormEvent){e.preventDefault();setError('');setLoading(true);try{const r=await fetch('/api/account/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email,password,remember})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Sign in failed');await refresh();router.replace(params.get('redirect') || '/account');}catch(e){setError(e instanceof Error?e.message:'Sign in failed');}finally{setLoading(false)}}
  return <><Header/><main className="min-h-[70vh] bg-slate-50 px-4 py-12"><div className="mx-auto max-w-md rounded-2xl border bg-white p-6 shadow-sm"><h1 className="text-2xl font-extrabold">Sign in to PhoneDock</h1><p className="mt-1 text-sm text-slate-500">Access your account and saved features.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-medium">Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3 outline-none focus:ring-2 focus:ring-blue-500"/></label><label className="block text-sm font-medium">Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3 outline-none focus:ring-2 focus:ring-blue-500"/></label>{error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white disabled:opacity-60">{loading?'Signing in...':'Sign in'}</button></form><p className="mt-5 text-center text-sm text-slate-600">New here? <Link href="/signup" className="font-semibold text-blue-600">Create account</Link></p></div></main><Footer/></>;
}
