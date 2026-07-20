'use client';

import { useState } from 'react';
import { Check, Mail } from 'lucide-react';
import { SectionHeader } from '@/components/shared/SectionHeader';

export function HomeNewsletter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const subscribe = async () => {
    if (!email.trim() || !email.includes('@')) return;
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
    <section className="space-y-4">
      <SectionHeader title="Stay Updated" icon={Mail} />
      <div className="card-premium p-6 sm:p-8 text-center">
        <h3 className="font-bold text-gray-900 text-lg mb-2">Get the Latest Phone Updates</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">New launches, price drops, and expert reviews delivered straight to your inbox.</p>
        {subscribed ? (
          <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium text-sm py-2">
            <Check className="w-4 h-4" /> Subscribed successfully! Check your inbox.
          </div>
        ) : (
          <div className="space-y-2 max-w-md mx-auto">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={event => setEmail(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && subscribe()}
                className="flex-1 h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                aria-label="Email address"
              />
              <button onClick={subscribe} disabled={loading} className="btn-primary h-11 px-6 rounded-xl text-sm font-semibold whitespace-nowrap disabled:opacity-50">
                {loading ? 'Subscribing...' : 'Subscribe'}
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
