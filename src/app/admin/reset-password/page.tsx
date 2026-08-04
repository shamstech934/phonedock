'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { isStrongPassword } from '@/lib/auth';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [strengthErrors, setStrengthErrors] = useState<string[]>([]);

  // Live password strength feedback
  useEffect(() => {
    if (!newPassword) {
      setStrengthErrors([]);
      return;
    }
    const result = isStrongPassword(newPassword);
    setStrengthErrors(result.valid ? [] : result.errors);
  }, [newPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing reset token.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const pwCheck = isStrongPassword(newPassword);
    if (!pwCheck.valid) {
      setError(`Weak password: ${pwCheck.errors.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      if (res.ok) {
        setDone(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Reset failed. Please request a new link.');
      }
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8FAFC] animate-fade-in">
        <div className="w-full max-w-sm glass-modal rounded-2xl p-6 sm:p-8 shadow-xl shadow-blue-500/10 text-center">
          <h1 className="text-xl font-extrabold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            href="/admin/forgot-password"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8FAFC] animate-fade-in">
        <div className="w-full max-w-sm glass-modal rounded-2xl p-6 sm:p-8 shadow-xl shadow-blue-500/10 text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 mb-2">Password Reset</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your password has been changed successfully. All previous sessions have been invalidated.
          </p>
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors shadow-sm shadow-blue-500/25"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8FAFC] animate-fade-in">
      <div className="w-full max-w-sm glass-modal rounded-2xl p-6 sm:p-8 shadow-xl shadow-blue-500/10">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-blue-500" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900">Reset Password</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your new password below</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-medium rounded-xl px-4 py-2.5 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white"
            />
            {strengthErrors.length > 0 && newPassword && (
              <div className="mt-1.5 text-[10px] text-amber-600 space-y-0.5">
                {strengthErrors.map((err, i) => (
                  <p key={i}>- Must have {err}</p>
                ))}
              </div>
            )}
            {strengthErrors.length === 0 && newPassword && (
              <div className="mt-1.5 text-[10px] text-emerald-600 font-medium">Strong password</div>
            )}
          </div>
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white"
          />
          <button
            type="submit"
            disabled={loading || strengthErrors.length > 0}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white h-11 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-500/25"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}