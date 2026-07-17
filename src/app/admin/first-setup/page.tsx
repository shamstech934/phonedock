'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, KeyRound, AlertTriangle, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';

type PageState = 'loading' | 'available' | 'unavailable' | 'success';

export default function FirstSetupPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check if setup is available on mount
  const checkSetupStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/first-setup/status');
      if (res.ok) {
        setPageState('available');
      } else {
        setPageState('unavailable');
      }
    } catch {
      setPageState('unavailable');
    }
  }, []);

  useEffect(() => {
    checkSetupStatus();
  }, [checkSetupStatus]);

  // If setup is unavailable, show 404-like page
  if (pageState === 'unavailable') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8FAFC]">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-gray-300" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Page Not Found</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
            The requested page could not be found.
          </p>
          <a
            href="/admin/login"
            className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors"
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  // Success state after creation
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8FAFC]">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Superadmin Created</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Your superadmin account has been created successfully. You are now being redirected to the dashboard.
          </p>
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Important Next Step</p>
                <p className="text-xs text-amber-700 mt-1">
                  Remove <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-[11px]">FIRST_ADMIN_SETUP_KEY</code> from Vercel environment variables and redeploy once.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.replace('/admin/dashboard')}
            className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white h-11 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-500/25"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Password strength indicator
  const getPasswordStrength = (pw: string): { label: string; color: string; percent: number } => {
    if (pw.length < 14) return { label: 'Too short', color: 'text-red-500', percent: 15 };
    let score = 0;
    if (/[A-Z]/.test(pw)) score += 1;
    if (/[a-z]/.test(pw)) score += 1;
    if (/[0-9]/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;
    if (pw.length >= 16) score += 1;
    if (pw.length >= 20) score += 1;

    if (score <= 2) return { label: 'Weak', color: 'text-red-500', percent: 30 };
    if (score <= 4) return { label: 'Good', color: 'text-amber-500', percent: 60 };
    return { label: 'Strong', color: 'text-green-600', percent: 100 };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/first-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, confirmPassword, setupKey }),
      });

      const data = await res.json();

      if (res.ok) {
        setPageState('success');
        // Redirect to dashboard after a brief moment to show success
        setTimeout(() => {
          router.replace('/admin/dashboard');
        }, 2000);
      } else {
        setError(data.error || 'Setup failed. Please try again.');
      }
    } catch {
      setError('Connection failed. Check your internet and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8FAFC]">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900">First Admin Setup</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create the first superadmin account for PhoneDock
          </p>
        </div>

        {/* Info banner */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-xs text-blue-700">
            This is a one-time setup wizard. After the first superadmin is created, this page will permanently become unavailable.
          </p>
        </div>

        {/* Form */}
        <div className="glass-modal rounded-2xl p-6 sm:p-8 shadow-xl shadow-blue-500/10">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-medium rounded-xl px-4 py-2.5 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Setup Key */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                One-Time Setup Key
              </label>
              <input
                type="password"
                placeholder="Enter your setup key"
                value={setupKey}
                onChange={e => setSetupKey(e.target.value)}
                required
                autoComplete="off"
                autoFocus
                className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white font-mono"
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 14 chars, mixed case, number, special"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full h-11 px-4 pr-10 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">
                      {password.length}/14 min characters
                    </span>
                    <span className={`text-[10px] font-semibold ${strength.color}`}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        strength.percent <= 30 ? 'bg-red-500' :
                        strength.percent <= 60 ? 'bg-amber-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${strength.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full h-11 px-4 pr-10 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-[10px] text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !name || !email || !password || !confirmPassword || !setupKey}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white h-11 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-500/25 flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Superadmin Account'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-center text-muted-foreground/70 mt-4">
          This page will become permanently unavailable after setup.
        </p>
      </div>
    </div>
  );
}