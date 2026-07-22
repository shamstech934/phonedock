'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Star, ChevronRight, Smartphone, Camera, Battery, Cpu, Trophy,
  Monitor, Wifi, Check, Minus, GitCompare, Shield, BarChart3,
  ChevronLeft, ExternalLink, AlertTriangle, Play, Bell,
  HardDrive, Heart,
} from 'lucide-react';
import { TurnstileWidget } from '@/components/shared/TurnstileWidget';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { formatPrice } from '@/components/shared/formatPrice';
import type { Phone } from '@/components/shared/types';
import { useRecentlyViewed, useWishlist } from '@/lib/personalization/usePersonalization';
import { PhoneShareMenu } from '@/components/shared/PhoneShareMenu';

// ── Lightweight SVG Price History Chart (no SSR issues) ──
function PriceHistoryChart({ history }: { history: Array<{ recordedAt: string; storeName: string | null; price: number }> }) {
  // Only show base price (storeName === null) for the main line
  const basePrices = history.filter(h => h.storeName === null);
  if (basePrices.length < 2) return null;
  const prices = basePrices.map(h => h.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const w = 280, h = 120, pad = { t: 10, r: 10, b: 20, l: 45 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const points = basePrices.map((h, i) => ({
    x: pad.l + (i / (basePrices.length - 1)) * plotW,
    y: pad.t + plotH - ((h.price - minP) / range) * plotH,
    price: h.price,
    date: new Date(h.recordedAt).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }),
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${pad.t + plotH} L${points[0].x},${pad.t + plotH} Z`;
  const fmtShort = (n: number) => n >= 100000 ? `${(n / 1000).toFixed(0)}K` : n.toLocaleString();

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="phTitle phDesc">
      <title id="phTitle">Price history chart</title>
      <desc id="phDesc">Price trend from PKR {minP?.toLocaleString()} to PKR {maxP?.toLocaleString()} over {points?.length || 0} data points</desc>
      <defs>
        <linearGradient id="phGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Y axis labels */}
      <text x={pad.l - 4} y={pad.t + 4} textAnchor="end" fontSize="8" fill="#9ca3af">{fmtShort(maxP)}</text>
      <text x={pad.l - 4} y={pad.t + plotH + 3} textAnchor="end" fontSize="8" fill="#9ca3af">{fmtShort(minP)}</text>
      {/* Grid lines */}
      <line x1={pad.l} y1={pad.t} x2={w - pad.r} y2={pad.t} stroke="#f3f4f6" strokeWidth="0.5" />
      <line x1={pad.l} y1={pad.t + plotH} x2={w - pad.r} y2={pad.t + plotH} stroke="#f3f4f6" strokeWidth="0.5" />
      {/* Area fill */}
      <path d={areaPath} fill="url(#phGrad)" />
      {/* Line */}
      <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={points.length <= 8 ? 3 : 1.5} fill="#3b82f6" stroke="white" strokeWidth="1.5" />
      ))}
      {/* X axis date labels (first, last) */}
      <text x={points[0].x} y={h - 2} textAnchor="middle" fontSize="7" fill="#9ca3af">{points[0].date}</text>
      <text x={points[points.length - 1].x} y={h - 2} textAnchor="middle" fontSize="7" fill="#9ca3af">{points[points.length - 1].date}</text>
    </svg>
  );
}

// ── Price Tracker Chart (from PriceTrackerHistory records) ──
function PriceTrackerChart({ history }: { history: Array<{ newPrice: number; capturedAt: string }> }) {
  const [hovered, setHovered] = useState<number | null>(null);
  // history is sorted desc from API — reverse for chronological order
  const sorted = [...history].reverse();
  if (sorted.length < 2) return null;

  const prices = sorted.map(h => h.newPrice);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const w = 600, h = 200, pad = { t: 16, r: 16, b: 32, l: 56 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const pts = sorted.map((h, i) => ({
    x: pad.l + (i / (sorted.length - 1)) * plotW,
    y: pad.t + plotH - ((h.newPrice - minP) / range) * plotH,
    price: h.newPrice,
    date: new Date(h.capturedAt).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: '2-digit' }),
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${pad.t + plotH} L${pts[0].x},${pad.t + plotH} Z`;

  // Determine trend: compare first and last
  const trendDown = prices[prices.length - 1] <= prices[0];
  const lineColor = trendDown ? '#16a34a' : '#dc2626'; // green-600 / red-600
  const gradId = 'ptGrad';
  const fmtShort = (n: number) => n >= 100000 ? `${(n / 1000).toFixed(0)}K` : n.toLocaleString();

  // X-axis labels: show every 5th
  const xLabels = pts.filter((_, i) => i % 5 === 0 || i === pts.length - 1);
  // Y-axis labels
  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = maxP - (i / ySteps) * range;
    return { val, y: pad.t + (i / ySteps) * plotH };
  });

  return (
    <div className="relative w-full" style={{ maxHeight: '200px' }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet" style={{ maxHeight: '200px' }} role="img" aria-labelledby="ptTitle ptDesc">
        <title id="ptTitle">Price tracker chart</title>
        <desc id="ptDesc">Tracked price from PKR {Math.min(...prices)?.toLocaleString()} to PKR {Math.max(...prices)?.toLocaleString()} over {sorted.length} data points</desc>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* Y axis labels + grid */}
        {yLabels.map((yl, i) => (
          <g key={`y${i}`}>
            <line x1={pad.l} y1={yl.y} x2={w - pad.r} y2={yl.y} stroke="#f3f4f6" strokeWidth="0.5" />
            <text x={pad.l - 6} y={yl.y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{fmtShort(yl.val)}</text>
          </g>
        ))}
        {/* X axis labels */}
        {xLabels.map((p, i) => (
          <text key={`x${i}`} x={p.x} y={h - 6} textAnchor="middle" fontSize="8" fill="#9ca3af">{p.date}</text>
        ))}
        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots — larger on hover */}
        {pts.map((p, i) => (
          <g key={`d${i}`} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
            <circle cx={p.x} cy={p.y} r={hovered === i ? 5 : (pts.length <= 15 ? 3 : 1.5)} fill={lineColor} stroke="white" strokeWidth={hovered === i ? 2 : 1.5} />
          </g>
        ))}
        {/* Tooltip */}
        {hovered !== null && pts[hovered] && (
          <g>
            <rect x={pts[hovered].x - 60} y={pts[hovered].y - 36} width="120" height="28" rx="6" fill="#1f2937" fillOpacity="0.92" />
            <text x={pts[hovered].x} y={pts[hovered].y - 18} textAnchor="middle" fontSize="10" fill="white" fontWeight="600">
              Rs.{pts[hovered].price.toLocaleString()} — {pts[hovered].date}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}


function ScoreRadar({ phone }: { phone: Phone }) {
  const scores = [
    { label: 'Performance', value: phone.performanceScore || 0 },
    { label: 'Camera', value: phone.cameraScore || 0 },
    { label: 'Battery', value: phone.batteryScore || 0 },
    { label: 'Display', value: phone.displayScore || 0 },
    { label: 'Value', value: phone.valueScore || 0 },
  ];
  const cx = 120, cy = 120, radius = 82;
  const point = (index: number, value = 100) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / scores.length;
    const r = radius * Math.max(0, Math.min(value, 100)) / 100;
    return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
  };
  const polygon = scores.map((score, index) => point(index, score.value)).join(' ');
  const rings = [25, 50, 75, 100];

  return (
    <div className="rounded-2xl border border-gray-100 bg-[#F8FAFC] p-4">
      <svg viewBox="0 0 240 240" className="mx-auto h-auto w-full max-w-[300px]" role="img" aria-label="Phone score radar chart">
        {rings.map(ring => (
          <polygon key={ring} points={scores.map((_, index) => point(index, ring)).join(' ')} fill="none" stroke="#dbeafe" strokeWidth="1" />
        ))}
        {scores.map((_, index) => (
          <line key={index} x1={cx} y1={cy} x2={point(index).split(',')[0]} y2={point(index).split(',')[1]} stroke="#e5e7eb" strokeWidth="1" />
        ))}
        <polygon points={polygon} fill="rgba(37,99,235,0.18)" stroke="#2563eb" strokeWidth="2.5" />
        {scores.map((score, index) => {
          const [x, y] = point(index, score.value).split(',');
          const [lx, ly] = point(index, 118).split(',');
          return (
            <g key={score.label}>
              <circle cx={x} cy={y} r="4" fill="#2563eb" stroke="white" strokeWidth="2" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="600" fill="#334155">{score.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BuyingInsight({ phone }: { phone: Phone }) {
  const entries = [
    ['Performance', Number(phone.performanceScore) || 0],
    ['Camera', Number(phone.cameraScore) || 0],
    ['Battery', Number(phone.batteryScore) || 0],
    ['Display', Number(phone.displayScore) || 0],
    ['Value', Number(phone.valueScore) || 0],
  ] as const;
  const available = entries.filter(([, score]) => score > 0);

  if (available.length < 2) {
    return (
      <div className="card-premium p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">PhoneDock buying insight</p>
        <h3 className="mt-1 text-xl font-bold text-gray-900">Compare the essentials before buying</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Detailed category scores are not available for this phone yet. Check its chipset, camera, battery, display and current price, then compare it with nearby alternatives below.
        </p>
      </div>
    );
  }

  const best = [...available].sort((a, b) => b[1] - a[1])[0];
  const weakest = [...available].sort((a, b) => a[1] - b[1])[0];
  const average = Math.round(available.reduce((sum, [, score]) => sum + score, 0) / available.length);
  const verdict = average >= 85 ? 'Excellent all-round choice' : average >= 75 ? 'Strong choice for most buyers' : average >= 65 ? 'Good, but compare alternatives' : 'Best for a specific use case';
  const priceValue = phone.valueScore >= 80 ? 'strong value for money' : phone.valueScore >= 65 ? 'reasonable value' : 'pricing that should be compared carefully';

  return (
    <div className="card-premium p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">PhoneDock buying insight</p>
          <h3 className="mt-1 text-xl font-bold text-gray-900">{verdict}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Best for <strong className="text-gray-800">{best[0].toLowerCase()}</strong>, with {priceValue}. Its weakest scored area is {weakest[0].toLowerCase()}, so buyers focused on that should compare nearby options first.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3">
          <div className="text-3xl font-extrabold text-blue-700">{average}</div>
          <div className="text-xs font-medium leading-tight text-blue-700">Smart buy<br />score / 100</div>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ score, label, mini }: { score: number; label: string; mini?: boolean }) {
  const validScore = Number.isFinite(Number(score)) && Number(score) > 0;
  if (!validScore) {
    return (
      <div className={mini ? 'flex items-center justify-between gap-2' : 'space-y-1.5'}>
        <span className={mini ? 'w-14 shrink-0 text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}>{label}</span>
        <span className='text-xs font-medium text-muted-foreground'>Not rated yet</span>
      </div>
    );
  }
  if (mini) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-14 shrink-0">{label}</span>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="score-bar h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-700 ease-out" style={{ width: `${score}%` }} />
        </div>
        <span className="text-xs font-bold w-8 text-right">{score}</span>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{score}/100</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="score-bar h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-700 ease-out" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ── Price Drop Alert Button ──
function PriceAlertButton({ phoneId, slug }: { phoneId: string; slug: string }) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/phones/${slug}/price-alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (res.ok) { setSubscribed(true); }
      else { setError(d.error || d.message || 'Subscription failed. Try again.'); }
    } catch {
      setError('Network error. Please check your connection and try again.');
    }
    setLoading(false);
  };

  if (subscribed) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50/50 rounded-lg p-2.5">
        <Bell className="w-3.5 h-3.5" /> You will be notified when the price drops
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
      <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email for price drop alert" aria-label="Email for price drop alert" className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400" />
      <button onClick={handleSubscribe} disabled={loading || !email} className="shrink-0 rounded-lg bg-blue-50 text-blue-600 px-3 py-2 text-xs font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1">
        <Bell className="w-3 h-3" /> {loading ? '...' : 'Notify'}
      </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── User Reviews Section ──
function UserReviewsSection({ slug }: { slug: string }) {
  const [reviews, setReviews] = useState<Array<{ id: string; name: string; rating: number; comment: string; createdAt: string }>>([]);
  const [average, setAverage] = useState(0);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [turnstileToken, setTurnstileToken] = useState('');

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/phones/${slug}/reviews`).then(r => r.json()).then(d => {
      setReviews(d.reviews || []);
      setAverage(d.average || 0);
      setTotal(d.total || 0);
    }).catch(() => {});
  }, [slug]);

  const handleSubmit = async () => {
    if (!formName || !formEmail || !formComment || formComment.length < 10) return;
    setSubmitting(true);
    setSubmitMsg('');
    try {
      const res = await fetch(`/api/phones/${slug}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, email: formEmail, rating: formRating, comment: formComment, turnstileToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitMsg('Review submitted! It will appear after moderation.');
        setFormName(''); setFormEmail(''); setFormRating(5); setFormComment(''); setShowForm(false);
      } else {
        setSubmitMsg(data.error || 'Failed to submit review');
      }
    } catch { setSubmitMsg('Network error'); }
    setSubmitting(false);
  };

  return (
    <section className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-400" fill="currentColor" /> User Reviews
        </h2>
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors">
          {showForm ? 'Cancel' : 'Write a Review'}
        </button>
      </div>

      {/* Average Rating */}
      {total > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-200/50">
          <div className="text-3xl font-bold text-gray-900">{average}</div>
          <div>
            <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-4 h-4 ${i <= Math.round(average) ? 'text-amber-400' : 'text-gray-200'}`} fill={i <= Math.round(average) ? 'currentColor' : 'none'} />)}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Based on {total} review{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Review Form */}
      {showForm && (
        <div className="card-premium p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Your name" aria-label="Your name" className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <input value={formEmail} onChange={e => setFormEmail(e.target.value)} type="email" placeholder="Your email (private)" aria-label="Your email" className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground mr-2">Rating:</span>
            <div role="radiogroup" aria-label="Rating">
              {[1,2,3,4,5].map(i => (
                <button key={i} type="button" role="radio" aria-checked={i <= formRating} aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => setFormRating(i)} className="p-0.5">
                  <Star className={`w-5 h-5 transition-colors ${i <= formRating ? 'text-amber-400' : 'text-gray-200'}`} fill={i <= formRating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>
          <textarea value={formComment} onChange={e => setFormComment(e.target.value)} placeholder="Share your experience with this phone..." rows={3} aria-label="Your review" className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          {turnstileSiteKey && (
            <div className="flex justify-center">
              <TurnstileWidget siteKey={turnstileSiteKey} onVerify={setTurnstileToken} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Your email is private and never shown.</p>
            <button onClick={handleSubmit} disabled={submitting || !formName || !formEmail || formComment.length < 10 || !!((turnstileSiteKey) && !turnstileToken)} className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
          {submitMsg && <p className={`text-xs ${submitMsg.includes('submitted') ? 'text-emerald-600' : 'text-red-500'}`}>{submitMsg}</p>}
        </div>
      )}

      {/* Reviews List */}
      {reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="card-premium p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">{r.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.name}</p>
                    <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= r.rating ? 'text-amber-400' : 'text-gray-200'}`} fill={i <= r.rating ? 'currentColor' : 'none'} />)}</div>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{r.comment}</p>
            </div>
          ))}
        </div>
      ) : !showForm ? (
        <p className="text-sm text-muted-foreground text-center py-6">No reviews yet. Be the first to share your experience!</p>
      ) : null}
    </section>
  );
}

export default function PhoneDetailPage({ slug, initialData }: { slug: string; initialData: { phone: Phone; related: Phone[] } | null }) {
  const wishlist = useWishlist();
  const recent = useRecentlyViewed();
  const data = initialData;
  const loading = false;
  const [activeTab, setActiveTab] = useState('specs');
  const [activeImage, setActiveImage] = useState(0);
  const [priceHistory, setPriceHistory] = useState<Array<{ recordedAt: string; storeName: string | null; price: number }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [priceTracker, setPriceTracker] = useState<{
    currentPrice: number; previousPrice: number; lowestPrice: number; highestPrice: number;
    averagePrice: number; dataPoints: number; savingsFromHigh: number; trend: 'up' | 'down' | 'stable';
    priceChange: number; percentageChange: number; lastPriceChangedAt: string | null;
    positionInRange: number | null; discountFromAveragePct: number;
    buyRecommendation: 'buy_now' | 'good_price' | 'wait' | 'insufficient_data';
    buyRecommendationReason: string;
    priceMode: string; manualLock: boolean;
    history: Array<{ id: string; oldPrice: number; newPrice: number; difference: number; percentageChange: number; changeType: string; sourceType: string; capturedAt: string }>;
  } | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    // Secondary price datasets stay client-loaded so they do not delay the main HTML.
    setHistoryLoading(true);
    fetch(`/api/phones/${slug}/price-history`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setPriceHistory(d.history || []); setHistoryLoading(false); } })
      .catch(() => { if (!cancelled) setHistoryLoading(false); });
    fetch(`/api/phones/${slug}/price-tracker`)
      .then(r => r.json())
      .then(d => { if (!cancelled && !d.error) setPriceTracker(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (data?.phone) recent.add(data.phone);
  }, [data?.phone?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
            <div className="skeleton-shimmer h-6 w-64 rounded-lg" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="skeleton-shimmer aspect-square rounded-2xl" />
                <div className="skeleton-shimmer h-48 rounded-2xl" />
              </div>
              <div className="lg:col-span-2 space-y-4">
                <div className="skeleton-shimmer h-8 w-3/4 rounded-lg" />
                <div className="skeleton-shimmer h-4 w-full rounded-lg" />
                <div className="skeleton-shimmer h-32 rounded-2xl" />
                <div className="skeleton-shimmer h-64 rounded-2xl" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!data?.phone) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 py-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
              <Smartphone className="w-10 h-10 text-gray-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Phone not found</h2>
            <p className="text-sm text-muted-foreground mt-2">The phone you&apos;re looking for doesn&apos;t exist.</p>
            <Button variant="outline" className="mt-6 rounded-xl" asChild><Link href="/phones">Browse All Phones</Link></Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const { phone, related } = data;
  const p = phone;

  const images = p.images && p.images.length > 0 ? p.images : p.thumbnail ? [{ id: 'thumb', url: p.thumbnail, altText: p.modelName, sortOrder: 0 }] : [];

  const recommendationGroups = (() => {
    const used = new Set<string>();
    const takeBest = (key: keyof Phone, label: string) => {
      const match = [...related]
        .filter(item => !used.has(item.id) && Number(item[key] || 0) > Number(p[key] || 0))
        .sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))[0];
      if (!match) return null;
      used.add(match.id);
      return { label, phone: match };
    };
    const groups = [
      takeBest('cameraScore', 'Better camera'),
      takeBest('performanceScore', 'Better performance'),
      takeBest('batteryScore', 'Better battery'),
      takeBest('valueScore', 'Better value'),
    ].filter(Boolean) as Array<{ label: string; phone: Phone }>;

    for (const item of related) {
      if (groups.length >= 4) break;
      if (!used.has(item.id)) {
        used.add(item.id);
        groups.push({ label: item.brand?.name === p.brand?.name ? `More from ${p.brand?.name}` : 'Similar price', phone: item });
      }
    }
    return groups;
  })();

  const specGroups = [
    { title: 'Display & Design', icon: Monitor, specs: [
      { label: 'Display', value: p.specs?.display }, { label: 'Type', value: p.specs?.displayType }, { label: 'Resolution', value: p.specs?.resolution },
      { label: 'Refresh Rate', value: p.specs?.refreshRate }, { label: 'Protection', value: p.specs?.protection }, { label: 'Brightness', value: p.specs?.brightness },
      { label: 'Dimensions', value: p.specs?.dimensions }, { label: 'Weight', value: p.specs?.weight }, { label: 'Build', value: p.specs?.build },
      { label: 'Colors', value: p.specs?.colors }, { label: 'IP Rating', value: p.specs?.ipRating },
    ]},
    { title: 'Performance', icon: Cpu, specs: [
      { label: 'Chipset', value: p.specs?.chipset }, { label: 'CPU', value: p.specs?.cpu }, { label: 'GPU', value: p.specs?.gpu },
      { label: 'Process', value: p.specs?.process }, { label: 'RAM', value: p.specs?.ram }, { label: 'RAM Type', value: p.specs?.ramType },
      { label: 'Storage', value: p.specs?.storage }, { label: 'Card Slot', value: p.specs?.cardSlot },
    ]},
    { title: 'Camera', icon: Camera, specs: [
      { label: 'Main Camera', value: p.specs?.mainCamera }, { label: 'Sensor', value: p.specs?.mainCameraSensor }, { label: 'Aperture', value: p.specs?.aperture },
      { label: 'OIS', value: p.specs?.ois }, { label: 'EIS', value: p.specs?.eis }, { label: 'Ultrawide', value: p.specs?.ultrawide },
      { label: 'Telephoto', value: p.specs?.telephoto }, { label: 'Zoom', value: p.specs?.zoom }, { label: 'Features', value: p.specs?.cameraFeatures },
      { label: 'Video', value: p.specs?.videoRecording }, { label: 'Selfie', value: p.specs?.selfieCamera }, { label: 'Selfie Video', value: p.specs?.selfieVideo },
    ]},
    { title: 'Battery & Charging', icon: Battery, specs: [
      { label: 'Capacity', value: p.specs?.battery }, { label: 'Charging', value: p.specs?.charging }, { label: 'Charging Speed', value: p.specs?.chargingSpeed },
      { label: 'Wireless Charging', value: p.specs?.wirelessCharge }, { label: 'Wireless Speed', value: p.specs?.wirelessSpeed }, { label: 'Reverse Charge', value: p.specs?.reverseCharge },
    ]},
    { title: 'Connectivity', icon: Wifi, specs: [
      { label: 'Network', value: p.specs?.network }, { label: '5G', value: p.specs?.fiveG }, { label: 'WiFi', value: p.specs?.wifi },
      { label: 'Bluetooth', value: p.specs?.bluetooth }, { label: 'NFC', value: p.specs?.nfc }, { label: 'USB', value: p.specs?.usb },
    ]},
    { title: 'Features & OS', icon: Smartphone, specs: [
      { label: 'OS', value: `${p.specs?.os || ''} ${p.specs?.osVersion || ''}`.trim() || undefined }, { label: 'UI', value: p.specs?.osUI }, { label: 'Update Policy', value: p.specs?.updatePolicy },
      { label: 'Fingerprint', value: p.specs?.fingerprint }, { label: 'Face Unlock', value: p.specs?.faceUnlock }, { label: 'Sensors', value: p.specs?.sensors },
      { label: 'Special Features', value: p.specs?.specialFeatures },
    ]},
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm text-muted-foreground mb-5 flex-wrap">
              <li><Link href="/phones" className="hover:text-blue-500 transition-colors flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Phones</Link></li>
              <li><ChevronRight className="w-3.5 h-3.5" /></li>
              <li><Link href={`/brands/${p.brand?.slug}`} className="hover:text-blue-500 transition-colors">{p.brand?.name}</Link></li>
              <li><ChevronRight className="w-3.5 h-3.5" /></li>
              <li><span className="font-medium text-gray-900">{p.modelName}</span></li>
            </ol>
          </nav>

          <h1 className="sr-only">{p.brand?.name} {p.modelName}</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Images & Info */}
            <div className="lg:col-span-1 space-y-4">
              {/* Image Gallery */}
              <div className="card-premium overflow-hidden">
                <div className="bg-[#F8FAFC] aspect-square flex items-center justify-center p-8 relative">
                  {images.length > 0 ? (
                    <Image src={images[activeImage]?.url || images[0].url} alt={images[activeImage]?.altText || p.modelName} width={300} height={300} className="object-contain" priority sizes="(max-width: 1024px) 100vw, 400px" />
                  ) : (
                    <div className="w-32 h-32 rounded-3xl bg-gray-100 flex items-center justify-center">
                      <Smartphone className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar">
                    {images.map((img, i) => (
                      <button key={img.id} onClick={() => setActiveImage(i)} aria-label={`View image ${i + 1} of ${images.length}`} aria-pressed={i === activeImage} className={`w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-colors ${i === activeImage ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}>
                        <Image src={img.url} alt={img.altText || phone.modelName} width={64} height={64} className="object-contain w-full h-full p-1" unoptimized />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Price & Quick Info */}
              <div className="card-premium p-4 space-y-3">
                {p.originalPricePKR > p.pricePKR && p.originalPricePKR > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Deal</span>
                    <p className="text-xs text-emerald-600 mt-0.5">Save {Math.round(((p.originalPricePKR - p.pricePKR) / p.originalPricePKR) * 100)}% — was {formatPrice(p.originalPricePKR)}</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Price in Pakistan</span>
                  <span className="text-2xl font-bold text-blue-600">{formatPrice(p.pricePKR)}</span>
                </div>
                {/* Price tracking badges */}
                {priceTracker && (
                  <div className="space-y-2">
                    {/* Previous price + change badge */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {priceTracker.previousPrice > 0 && priceTracker.previousPrice !== priceTracker.currentPrice && (
                        <span className="text-sm text-gray-400 line-through">{formatPrice(priceTracker.previousPrice)}</span>
                      )}
                      {priceTracker.priceChange !== 0 ? (
                        priceTracker.priceChange < 0 ? (
                          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/50">
                            Price Dropped ▼ {formatPrice(Math.abs(priceTracker.priceChange))} ({Math.abs(priceTracker.percentageChange)}%)
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200/50">
                            Price Increased ▲ {formatPrice(priceTracker.priceChange)} ({priceTracker.percentageChange}%)
                          </span>
                        )
                      ) : priceTracker.history.length > 0 ? (
                        <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">No Change</span>
                      ) : null}
                    </div>
                    {/* Lowest price + last updated + mode */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                      {priceTracker.lowestPrice > 0 && priceTracker.lowestPrice < priceTracker.currentPrice && (
                        <span className="text-emerald-600 font-medium">Lowest: {formatPrice(priceTracker.lowestPrice)}</span>
                      )}
                      {priceTracker.lastPriceChangedAt && (
                        <span className="text-gray-400">Last updated: {new Date(priceTracker.lastPriceChangedAt).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${priceTracker.priceMode === 'manual' ? 'bg-blue-50 text-blue-700 border-blue-200/50' : 'bg-purple-50 text-purple-700 border-purple-200/50'}`}>
                        {priceTracker.priceMode === 'manual' ? 'Manually Verified' : 'Auto Tracked'}
                      </span>
                      {priceTracker.manualLock && (
                        <span className="text-[10px] font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200/50">Price Locked</span>
                      )}
                    </div>
                  </div>
                )}
                <Separator className="bg-gray-100" />
                {/* Price Drop Alert */}
                <PriceAlertButton phoneId={p.id} slug={slug} />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">PTA Status</span>
                  <Badge className={p.ptaApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 font-medium' : 'bg-gray-100 text-gray-600 font-medium'}>
                    <Shield className="w-3 h-3 mr-1" /> {p.ptaStatus}
                  </Badge>
                </div>
                <Separator className="bg-gray-100" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Release Date</span>
                  <span className="text-sm font-medium text-gray-900">{p.releaseDate ? new Date(p.releaseDate).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
                </div>
                {p.specs?.colors && (
                  <>
                    <Separator className="bg-gray-100" />
                    <div>
                      <span className="text-sm text-muted-foreground">Colors</span>
                      <p className="text-sm mt-1 font-medium text-gray-900">{p.specs.colors}</p>
                    </div>
                  </>
                )}
                <Separator className="bg-gray-100" />
                <div className="flex gap-2">
                  <Link href={`/compare?p=${p.slug}`} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-xl h-11 text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-500/25">
                    <GitCompare className="w-4 h-4" /> Compare
                  </Link>
                  <button
                    onClick={() => wishlist.toggle(p)}
                    aria-label={`${wishlist.has(p.slug) ? 'Remove from' : 'Add to'} wishlist`}
                    aria-pressed={wishlist.has(p.slug)}
                    className={`h-11 px-4 rounded-xl border transition-colors flex items-center justify-center ${wishlist.has(p.slug) ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-gray-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600'}`}
                  >
                    <Heart className={`w-4 h-4 ${wishlist.has(p.slug) ? 'fill-current' : ''}`} />
                  </button>
                  <PhoneShareMenu title={`${p.brand?.name || ''} ${p.modelName}`.trim()} text={`${p.modelName} price, full specifications and review in Pakistan`} compact />
                </div>
                <a href={`mailto:info@phonedock.pk?subject=Incorrect info: ${p.modelName}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-500 transition-colors justify-center">
                  <AlertTriangle className="w-3 h-3" /> Report incorrect information
                </a>
              </div>

              {/* Store Prices — Comparison Table */}
              {p.prices && p.prices.length > 0 && (() => {
                const sorted = [...p.prices].filter(pr => pr.price > 0).sort((a, b) => a.price - b.price);
                const lowestPrice = sorted.length > 0 ? sorted[0].price : 0;
                return (
                  <div className="card-premium p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">Compare Prices</h3>
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                        {sorted.length} store{sorted.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {sorted.map((pr, idx) => {
                        const isLowest = pr.price === lowestPrice && sorted.length > 1;
                        const priceDiff = pr.price > lowestPrice ? pr.price - lowestPrice : 0;
                        return (
                          <div key={pr.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isLowest ? 'bg-emerald-50/70 border-emerald-200/60' : 'bg-[#F8FAFC] border-transparent hover:border-gray-200'}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              {isLowest && (
                                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">Best</span>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{pr.storeName}</p>
                                <p className="text-[10px] mt-0.5 flex items-center gap-1">
                                  <span className={`w-1.5 h-1.5 rounded-full ${pr.inStock ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                  <span className={pr.inStock ? 'text-emerald-600' : 'text-red-500'}>{pr.inStock ? 'In Stock' : 'Out of Stock'}</span>
                                  {!pr.inStock && <span className="text-red-400 ml-1">— unavailable</span>}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              {pr.url ? (
                                <a href={pr.url} target="_blank" rel="noopener noreferrer" className={`font-bold text-sm flex items-center gap-1 transition-colors ${isLowest ? 'text-emerald-700 hover:text-emerald-800' : 'text-blue-600 hover:text-blue-700'}`}>
                                  {formatPrice(pr.price)} <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className={`font-bold text-sm ${isLowest ? 'text-emerald-700' : 'text-blue-600'}`}>{formatPrice(pr.price)}</span>
                              )}
                              {priceDiff > 0 && (
                                <p className="text-[10px] text-red-500 mt-0.5">+{formatPrice(priceDiff)} more</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {sorted.length > 1 && (
                      <p className="text-[10px] text-muted-foreground mt-2.5 text-center">
                        You save up to <span className="font-semibold text-emerald-600">{formatPrice(sorted[sorted.length - 1].price - lowestPrice)}</span> by choosing the best deal
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Price Tracker 2.0 summary */}
              {priceTracker && priceTracker.dataPoints > 0 && (
                <div className="card-premium p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-500" /> Price insights
                    </h3>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${priceTracker.trend === 'down' ? 'bg-emerald-50 text-emerald-700' : priceTracker.trend === 'up' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {priceTracker.trend === 'down' ? 'Price dropped' : priceTracker.trend === 'up' ? 'Price increased' : 'Price stable'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Lowest', priceTracker.lowestPrice],
                      ['Highest', priceTracker.highestPrice],
                      ['Average', priceTracker.averagePrice],
                      ['Saved vs high', priceTracker.savingsFromHigh],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl bg-[#F8FAFC] p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
                        <p className="mt-1 text-sm font-bold text-gray-900">{formatPrice(Number(value || 0))}</p>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-3 rounded-xl border p-3 ${
                    priceTracker.buyRecommendation === 'buy_now' ? 'border-emerald-200 bg-emerald-50' :
                    priceTracker.buyRecommendation === 'good_price' ? 'border-blue-200 bg-blue-50' :
                    priceTracker.buyRecommendation === 'wait' ? 'border-amber-200 bg-amber-50' :
                    'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold text-gray-900">
                        {priceTracker.buyRecommendation === 'buy_now' ? 'Best time to buy' :
                         priceTracker.buyRecommendation === 'good_price' ? 'Good price' :
                         priceTracker.buyRecommendation === 'wait' ? 'Consider waiting' :
                         'Price guidance pending'}
                      </p>
                      {priceTracker.discountFromAveragePct > 0 && (
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {priceTracker.discountFromAveragePct}% below average
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-gray-600">{priceTracker.buyRecommendationReason}</p>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">Based on {priceTracker.dataPoints} confirmed price update{priceTracker.dataPoints === 1 ? '' : 's'}.</p>
                </div>
              )}

              {/* Price Tracker Chart */}
              {priceTracker && priceTracker.history.length >= 2 ? (
                <div className="card-premium p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" /> Price Tracker
                  </h3>
                  <PriceTrackerChart history={priceTracker.history} />
                </div>
              ) : priceTracker && priceTracker.history.length < 2 ? (
                <div className="card-premium p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" /> Price Tracker
                  </h3>
                  <p className="text-xs text-muted-foreground text-center py-4">Price history not available yet</p>
                </div>
              ) : null}

              {/* Price History Chart (legacy — keep if tracker has no data) */}
              {!priceTracker && priceHistory.length >= 2 && (
                <div className="card-premium p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" /> Price History
                  </h3>
                  <div className="h-40">
                    <PriceHistoryChart history={priceHistory} />
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Details */}
            <div className="lg:col-span-2 space-y-5">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">{p.brand?.name}</p>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">{p.modelName}</h2>
                {p.description && <p className="text-muted-foreground mt-3 text-sm leading-relaxed max-w-3xl">{p.description}</p>}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5" aria-label="Phone highlights">
                  {[
                    { icon: Monitor, label: 'Display', value: p.specs?.display || p.specs?.displayType },
                    { icon: Cpu, label: 'Chipset', value: p.specs?.chipset },
                    { icon: HardDrive, label: 'Memory', value: [p.specs?.ram, p.specs?.storage].filter(Boolean).join(' / ') },
                    { icon: Battery, label: 'Battery', value: p.specs?.battery },
                  ].filter(item => item.value).map(({ icon: FactIcon, label, value }) => (
                    <div key={label} className="rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-sm">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        <FactIcon className="h-3.5 w-3.5 text-blue-500" /> {label}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-relaxed text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Verdict */}
              {p.reviewVerdict && (
                <div className="bg-white rounded-2xl border border-blue-100 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/25">
                          <div className="text-center">
                            {Number(p.overallRating) > 0 ? (<>
                              <span className="text-xl font-extrabold">{p.overallRating}</span>
                              <span className="text-[10px] block opacity-70">/ 10</span>
                            </>) : <span className="px-2 text-center text-[10px] font-bold leading-tight">Not rated yet</span>}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Trophy className="w-4 h-4 text-blue-500" />
                            <h3 className="font-bold text-sm sm:text-base text-gray-900">Quick Verdict</h3>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{p.reviewVerdict}</p>
                        </div>
                      </div>
                      <div className="sm:ml-auto sm:w-64 space-y-2">
                        <ScoreBar score={p.cameraScore} label="Camera" mini />
                        <ScoreBar score={p.performanceScore} label="Performance" mini />
                        <ScoreBar score={p.displayScore} label="Display" mini />
                        <ScoreBar score={p.batteryScore} label="Battery" mini />
                        <ScoreBar score={p.valueScore} label="Value" mini />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Reviews */}
              {p.videos && p.videos.length > 0 && (
                <div className="card-premium p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center"><Play className="w-4 h-4 text-red-500" fill="currentColor" /></div>
                    Video Review{p.videos.length > 1 ? 's' : ''}
                  </h3>
                  <div className="space-y-3">
                    {p.videos.map((v) => (
                      <div key={v.id || v.youtubeId} className="rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}`}
                          className="w-full aspect-video"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                          title={v.title}
                          aria-label={`Video review: ${v.title}`}
                        />
                        <p className="text-xs text-muted-foreground px-3 py-2 line-clamp-1">{v.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Camera Details */}
              {(p.specs?.mainCamera || p.specs?.mainCameraSensor) && (
                <div className="card-premium p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Camera className="w-4 h-4 text-blue-600" /></div>
                    Camera Details
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Sensor', value: p.specs?.mainCameraSensor },
                      { label: 'Aperture', value: p.specs?.aperture },
                      { label: 'OIS', value: p.specs?.ois },
                      { label: 'EIS', value: p.specs?.eis },
                      { label: 'Zoom', value: p.specs?.zoom },
                      { label: 'Video', value: p.specs?.videoRecording },
                      { label: 'Features', value: p.specs?.cameraFeatures },
                    ].filter(t => t.value && t.value !== 'No' && t.value !== '').map(tile => (
                      <div key={tile.label} className={`p-3 rounded-xl bg-[#F8FAFC] ${tile.label === 'Features' ? 'col-span-2 sm:col-span-3' : ''}`}>
                        <p className="text-xs text-muted-foreground">{tile.label}</p>
                        <p className="text-sm font-semibold mt-0.5 text-gray-900">{tile.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Performance Details */}
              {(p.specs?.chipset || p.specs?.cpu) && (
                <div className="card-premium p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Cpu className="w-4 h-4 text-blue-600" /></div>
                    Performance
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Process Node', value: p.specs?.process, span: '' },
                      { label: 'Chipset', value: p.specs?.chipset, span: 'sm:col-span-2' },
                      { label: 'CPU', value: p.specs?.cpu, span: 'sm:col-span-2' },
                      { label: 'GPU', value: p.specs?.gpu, span: 'sm:col-span-2' },
                      { label: 'RAM', value: p.specs?.ram, span: '' },
                      { label: 'RAM Type', value: p.specs?.ramType, span: '' },
                      { label: 'Storage', value: p.specs?.storage, span: '' },
                    ].filter(t => t.value && t.value !== 'No' && t.value !== '').map(tile => (
                      <div key={tile.label} className={`p-3 rounded-xl bg-[#F8FAFC] ${tile.span}`}>
                        <p className="text-xs text-muted-foreground">{tile.label}</p>
                        <p className="text-sm font-semibold mt-0.5 text-gray-900">{tile.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Battery Details */}
              {p.specs?.battery && (
                <div className="card-premium p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Battery className="w-4 h-4 text-blue-600" /></div>
                    Battery & Charging
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Capacity', value: p.specs?.battery },
                      { label: 'Charging Speed', value: p.specs?.chargingSpeed },
                      { label: 'Wireless Charging', value: p.specs?.wirelessCharge },
                      { label: 'Wireless Speed', value: p.specs?.wirelessSpeed },
                      { label: 'Reverse Charge', value: p.specs?.reverseCharge },
                      ...(p.benchmarks?.videoPlayback ? [{ label: 'Video Playback', value: p.benchmarks.videoPlayback }] : []),
                      ...(p.benchmarks?.gamingBattery ? [{ label: 'Gaming Battery', value: p.benchmarks.gamingBattery }] : []),
                      ...(p.benchmarks?.browsingBattery ? [{ label: 'Browsing Battery', value: p.benchmarks.browsingBattery }] : []),
                    ].filter(t => t.value && t.value !== 'No' && t.value !== '').map(tile => (
                      <div key={tile.label} className="p-3 rounded-xl bg-[#F8FAFC]">
                        <p className="text-xs text-muted-foreground">{tile.label}</p>
                        <p className="text-sm font-semibold mt-0.5 text-gray-900">{tile.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <BuyingInsight phone={p} />

              {/* Ratings & Scores */}
              <div className="card-premium p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Ratings & Scores</h3>
                  <div className="flex items-center gap-1.5">
                    {Number(p.overallRating) > 0 ? (<>
                      <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                      <span className="text-2xl font-extrabold text-gray-900">{p.overallRating}</span>
                      <span className="text-sm text-muted-foreground">/ 10</span>
                    </>) : <span className="text-sm font-semibold text-muted-foreground">Not rated yet</span>}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    <ScoreBar score={p.performanceScore} label="Performance" />
                    <ScoreBar score={p.cameraScore} label="Camera" />
                    <ScoreBar score={p.batteryScore} label="Battery" />
                    <ScoreBar score={p.displayScore} label="Display" />
                    <ScoreBar score={p.valueScore} label="Value" />
                  </div>
                  {[p.performanceScore, p.cameraScore, p.batteryScore, p.displayScore, p.valueScore].some(score => Number(score) > 0) ? <ScoreRadar phone={p} /> : (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-muted-foreground">Detailed score chart will appear after ratings are added.</div>
                  )}
                </div>
              </div>

              {/* Tabs: Specs / Benchmarks / Review */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="sticky top-16 z-30 -mx-1 px-1 py-2 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75">
                <TabsList className="glass-filter w-full justify-start rounded-2xl p-1.5 h-auto overflow-x-auto no-scrollbar shadow-sm border border-white/70">
                  <TabsTrigger value="specs" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-blue-500/25 rounded-xl text-xs sm:text-sm">Specifications</TabsTrigger>
                  <TabsTrigger value="benchmarks" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-blue-500/25 rounded-xl text-xs sm:text-sm">Benchmarks</TabsTrigger>
                  <TabsTrigger value="review" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-blue-500/25 rounded-xl text-xs sm:text-sm">Review</TabsTrigger>
                </TabsList>
                </div>

                <TabsContent value="specs" className="mt-5 space-y-4">
                  {specGroups.map(group => {
                    const validSpecs = group.specs.filter(s => s.value && s.value !== 'No' && s.value !== '' && s.value.trim() !== '');
                    if (validSpecs.length === 0) return null;
                    return (
                      <div key={group.title} className="card-premium overflow-hidden">
                        <div className="px-4 py-3 flex items-center gap-2.5 border-b border-gray-50">
                          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/20">
                            <group.icon className="w-4 h-4 text-white" />
                          </div>
                          <h3 className="text-sm font-semibold text-gray-900">{group.title}</h3>
                        </div>
                        <div className="divide-y divide-gray-50 px-4 py-1">
                          {validSpecs.map(s => (
                            <div key={s.label} className="flex justify-between py-3 text-sm">
                              <span className="text-muted-foreground">{s.label}</span>
                              <span className="font-medium text-right max-w-[60%] text-gray-900">{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>

                <TabsContent value="benchmarks" className="mt-5">
                  <div className="card-premium p-5 space-y-6">
                    {p.benchmarks ? (<>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { label: 'AnTuTu', value: p.benchmarks.antutu.toLocaleString(), max: 2500000, color: 'from-blue-500 to-blue-600' },
                          { label: 'Geekbench Single', value: p.benchmarks.geekbenchSingle.toLocaleString(), max: 3500, color: 'from-emerald-500 to-green-600' },
                          { label: 'Geekbench Multi', value: p.benchmarks.geekbenchMulti.toLocaleString(), max: 8000, color: 'from-violet-500 to-purple-600' },
                        ].map(b => (
                          <div key={b.label} className="text-center p-5 rounded-2xl bg-[#F8FAFC] border border-gray-100">
                            <p className="text-xs text-muted-foreground mb-2 font-medium">{b.label}</p>
                            <p className="text-3xl font-extrabold text-gray-900">{b.value}</p>
                            <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full bg-gradient-to-r ${b.color} transition-all duration-700`} style={{ width: `${Math.min((parseInt(b.value.replace(/,/g, '')) / b.max) * 100, 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {p.benchmarks.gamingScore > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            { label: 'PUBG Mobile', value: p.benchmarks.pubgFps },
                            { label: 'COD Mobile', value: p.benchmarks.codMobileFps },
                            { label: 'Genshin Impact', value: p.benchmarks.genshinFps },
                          ].map(g => g.value ? (
                            <div key={g.label} className="p-4 rounded-2xl border border-gray-100 text-center bg-white">
                              <p className="text-xs text-muted-foreground font-medium">{g.label}</p>
                              <p className="text-lg font-bold mt-1.5 text-gray-900">{g.value}</p>
                            </div>
                          ) : null).filter(Boolean)}
                        </div>
                      )}
                    </>) : (
                      <div className="text-center py-16 text-muted-foreground">
                        <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No benchmark data available</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="review" className="mt-5 space-y-4">
                  <div className="card-premium p-5 space-y-5">
                    {p.reviewSummary && <p className="text-sm leading-relaxed text-gray-700">{p.reviewSummary}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {p.pros && (
                        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                          <h4 className="font-semibold text-emerald-700 text-sm mb-3 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/25"><Check className="w-3.5 h-3.5 text-white" /></div>
                            Pros
                          </h4>
                          <ul className="space-y-2">{p.pros.split(',').filter(Boolean).map((pro, i) => <li key={i} className="text-sm text-emerald-700 flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />{pro.trim()}</li>)}</ul>
                        </div>
                      )}
                      {p.cons && (
                        <div className="p-5 rounded-2xl bg-red-50 border border-red-100">
                          <h4 className="font-semibold text-red-700 text-sm mb-3 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-sm shadow-red-500/25"><Minus className="w-3.5 h-3.5 text-white" /></div>
                            Cons
                          </h4>
                          <ul className="space-y-2">{p.cons.split(',').filter(Boolean).map((con, i) => <li key={i} className="text-sm text-red-700 flex items-start gap-2"><Minus className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />{con.trim()}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* User Reviews Section */}
              <UserReviewsSection slug={slug} />

              {/* Smart alternatives */}
              {recommendationGroups.length > 0 && (
                <section className="space-y-5 pt-4">
                  <SectionHeader title="Smart alternatives" icon={Smartphone} />
                  <div data-testid="smart-alternatives-grid" className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-4">
                    {recommendationGroups.map(({ label, phone: item }) => (
                      <div key={item.id} className="flex h-full min-w-0 flex-col gap-2">
                        <div className="flex h-6 min-h-6 items-center overflow-hidden">
                          <span className="truncate rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">{label}</span>
                        </div>
                        <div className="min-h-0 flex-1"><PhoneCard phone={item} /></div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/80 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-7xl gap-2">
            <Button variant="outline" className="h-11 flex-1 rounded-xl" asChild>
              <Link href={`/compare?phones=${encodeURIComponent(p.slug)}`}><GitCompare className="mr-2 h-4 w-4" /> Compare</Link>
            </Button>
            <PhoneShareMenu title={`${p.brand?.name || ''} ${p.modelName}`.trim()} text={`${p.modelName} price, full specifications and review in Pakistan`} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
