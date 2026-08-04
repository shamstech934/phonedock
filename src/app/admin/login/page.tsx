'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';
import Link from 'next/link';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { admin, loading: authLoading, login } = useAdmin();
  const router = useRouter();

  // Redirect authenticated users away from login page
  useEffect(() => {
    if (!authLoading && admin) {
      router.replace('/admin/dashboard');
    }
  }, [admin, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Essential: send/receive httpOnly cookies
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        // Server sets httpOnly cookie — no token stored client-side
        // login() will verify session via cookie and redirect
        await login();
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('Connection failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8FAFC] animate-fade-in">
      <div className="w-full max-w-sm glass-modal rounded-2xl p-6 sm:p-8 shadow-xl shadow-blue-500/10">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to manage your phone database</p>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-medium rounded-xl px-4 py-2.5 mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white h-11 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-500/25"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="text-center mt-4">
          <Link
            href="/admin/forgot-password"
            className="text-[11px] text-blue-500 hover:text-blue-600 transition-colors font-medium"
          >
            Forgot password?
          </Link>
        </div>
        <p className="text-[10px] text-center text-muted-foreground/70 mt-2">
          Contact superadmin for access
        </p>
      </div>
    </div>
  );
}