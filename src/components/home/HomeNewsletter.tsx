'use client';

import { useState } from 'react';
import { BellRing, Check, ChevronRight, Mail, ShieldCheck, Smartphone, Tag } from 'lucide-react';

const UPDATE_TYPES = [
  { icon: Tag, label: 'Price drops' },
  { icon: Smartphone, label: 'New launches' },
  { icon: ShieldCheck, label: 'PTA updates' },
  { icon: BellRing, label: 'Expert reviews' },
];

export function HomeNewsletter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const subscribe = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (response.ok) {
        setSubscribed(true);
        setEmail('');
      } else {
        setError(data.error || 'Subscription failed. Try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="scroll-mt-28" aria-labelledby="newsletter-title">
      <div className="relative overflow-hidden rounded-[2rem] border border-blue-200/60 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 shadow-2xl shadow-blue-900/20">
        <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(255,255,255,0.09),transparent_28%)]" />

        <div className="relative grid gap-8 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-10 lg:py-10">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              Stay ahead
            </div>
            <h2 id="newsletter-title" className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Get important phone updates, not inbox noise.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Receive useful Pakistan-focused alerts for launches, prices, PTA information and new reviews.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {UPDATE_TYPES.map(item => (
                <div key={item.label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200">
                  <item.icon className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/12 bg-white/[0.08] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-400/20">
                <BellRing className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">PhoneDock Update Alerts</h3>
                <p className="mt-1 text-xs leading-5 text-slate-300">Join with your email. Unsubscribe whenever you want.</p>
              </div>
            </div>

            {subscribed ? (
              <div className="flex min-h-24 items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 text-center text-sm font-semibold text-emerald-200" role="status">
                <Check className="h-5 w-5" aria-hidden="true" />
                Subscribed successfully. Check your inbox.
              </div>
            ) : (
              <div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="newsletter-email" className="sr-only">Email address</label>
                  <input
                    id="newsletter-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    onKeyDown={event => event.key === 'Enter' && subscribe()}
                    className="h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950/50 px-4 text-sm text-white outline-none placeholder:text-slate-500 transition focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
                    aria-describedby={error ? 'newsletter-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={subscribe}
                    disabled={loading}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Subscribe to PhoneDock update alerts"
                  >
                    {loading ? 'Subscribing…' : 'Subscribe'}
                    {!loading && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {error && <p id="newsletter-error" className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
                <p className="mt-3 text-[11px] leading-5 text-slate-400">No spam. Only product, price and editorial updates relevant to phone buyers.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
