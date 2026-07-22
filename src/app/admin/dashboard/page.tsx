'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Smartphone, Layers, TrendingUp, Star, Tag, Newspaper,
  Upload, RefreshCw, Eye, BarChart3, Activity, Database, Plus, Edit, Trash2,
  Video, MessageSquare, HandCoins, ShieldCheck, Cog, Webhook, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';
import { formatPrice } from '@/components/shared/formatPrice';

interface DashboardStats {
  totalPhones: number;
  totalBrands: number;
  trendingCount: number;
  featuredCount: number;
  avgPrice: number;
  newsCount: number;
  totalVideos: number;
  totalReviews: number;
  totalSponsors: number;
  totalAdmins: number;
  priceDistribution: Array<{ range: string; count: number }>;
  dataHealth?: {
    publishedPhones: number;
    phonesMissingPrice: number;
    phonesMissingThumbnail: number;
    phonesMissingSpecs: number;
    phonesMissingImages: number;
    completenessPercent: number;
  };
  recentActivity: Array<{
    action?: string;
    details?: string;
    admin?: { name: string };
    createdAt?: string;
  }>;
}

export default function AdminDashboardPage() {
  const { admin } = useAdmin();
  const [stats, setStats] = useState<DashboardStats>({} as DashboardStats);
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`Request failed (${r.status})`); return r.json(); })
      .then(d => { setStats(d); setLoading(false); })
      .catch((err) => { setError(err instanceof Error ? err.message : 'Failed to load dashboard stats'); setLoading(false); });
  }, []);

  const statCards = [
    { label: 'Total Phones', value: stats.totalPhones ?? 0, icon: Smartphone, bg: 'bg-blue-50', iconColor: 'text-blue-500' },
    { label: 'Brands', value: stats.totalBrands ?? 0, icon: Layers, bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
    { label: 'Trending', value: stats.trendingCount ?? 0, icon: TrendingUp, bg: 'bg-red-50', iconColor: 'text-red-500' },
    { label: 'Featured', value: stats.featuredCount ?? 0, icon: Star, bg: 'bg-amber-50', iconColor: 'text-amber-500' },
    { label: 'Avg Price', value: stats.avgPrice ? formatPrice(stats.avgPrice) : 'N/A', icon: Tag, bg: 'bg-violet-50', iconColor: 'text-violet-500' },
    { label: 'News', value: stats.newsCount ?? 0, icon: Newspaper, bg: 'bg-cyan-50', iconColor: 'text-cyan-500' },
    { label: 'Videos', value: stats.totalVideos ?? 0, icon: Video, bg: 'bg-rose-50', iconColor: 'text-rose-500' },
    { label: 'Reviews', value: stats.totalReviews ?? 0, icon: MessageSquare, bg: 'bg-sky-50', iconColor: 'text-sky-500' },
    { label: 'Sponsors', value: stats.totalSponsors ?? 0, icon: HandCoins, bg: 'bg-orange-50', iconColor: 'text-orange-500' },
    { label: 'Admin Users', value: stats.totalAdmins ?? 0, icon: ShieldCheck, bg: 'bg-teal-50', iconColor: 'text-teal-500' },
  ];

  const quickActions = [
    { label: 'Import', icon: Upload, href: '/admin/import' },
    { label: 'Sync', icon: RefreshCw, href: '/admin/sync' },
    { label: 'Phones', icon: Smartphone, href: '/admin/phones' },
    { label: 'Brands', icon: Layers, href: '/admin/brands' },
    { label: 'News', icon: Newspaper, href: '/admin/news' },
    { label: 'Activity', icon: Activity, href: '/admin/activity' },
    { label: 'Collector', icon: Webhook, href: '/admin/collector' },
    { label: 'Settings', icon: Cog, href: '/admin/settings' },
  ];

  const priceDist: Array<{ range: string; count: number }> = stats.priceDistribution || [
    { range: 'Under 20K', count: 0 }, { range: '20K - 40K', count: 0 }, { range: '40K - 60K', count: 0 },
    { range: '60K - 100K', count: 0 }, { range: 'Above 100K', count: 0 },
  ];
  const maxPriceCount = Math.max(...priceDist.map(d => d.count || 0), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">Welcome back, {admin?.name || 'Admin'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s what&apos;s happening with PhoneDock</p>
        </div>
        <Link href="/" className="self-start bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 h-9 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
          <Eye className="w-4 h-4 shrink-0" /> View Site
        </Link>
      </div>

      {error && (
        <div className="card-premium p-4 border-red-200 bg-red-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4 text-red-500 shrink-0" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800">Failed to load dashboard</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button onClick={() => { setError(null); setLoading(true); fetch('/api/admin/stats', { credentials: 'include' }).then(r => r.json()).then(d => { setStats(d); setLoading(false); }).catch((err) => { setError(err instanceof Error ? err.message : 'Failed to load dashboard stats'); setLoading(false); }); }} className="text-xs font-medium text-red-700 hover:text-red-900 underline shrink-0">Retry</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="card-premium p-4">
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}><s.icon className={`w-4 h-4 ${s.iconColor} shrink-0`} /></div>
            <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {(stats.totalPhones === 0 || stats.totalPhones === undefined) && (
        <div className="card-premium p-6 border-2 border-dashed border-gray-200 bg-gray-50/50">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center shrink-0">
              <Database className="w-7 h-7 text-gray-400" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-bold text-gray-900 text-base">No Phones Yet</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Use the Import feature or add phones manually to get started.</p>
            </div>
          </div>
        </div>
      )}

      <div className="card-premium p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Production Data Health</h3>
            <p className="text-xs text-muted-foreground mt-1">Published phone records that are ready for visitors, search and recommendations.</p>
          </div>
          <Link href="/admin/data-quality" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">Open Data Quality <ArrowRight className="w-3 h-3" /></Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <p className="text-2xl font-extrabold text-emerald-700">{stats.dataHealth?.completenessPercent ?? 0}%</p>
            <p className="text-xs font-medium text-emerald-800 mt-1">Overall completeness</p>
          </div>
          {[
            { label: 'Missing prices', value: stats.dataHealth?.phonesMissingPrice ?? 0, icon: CircleDollarSign, href: '/admin/data-quality?tab=missing-prices' },
            { label: 'Missing thumbnails', value: stats.dataHealth?.phonesMissingThumbnail ?? 0, icon: ImageOff, href: '/admin/data-quality?tab=missing-images' },
            { label: 'Missing specs', value: stats.dataHealth?.phonesMissingSpecs ?? 0, icon: FileWarning, href: '/admin/data-quality?tab=missing-specs' },
            { label: 'Missing gallery', value: stats.dataHealth?.phonesMissingImages ?? 0, icon: ImageOff, href: '/admin/data-quality?tab=missing-images' },
          ].map(item => (
            <Link key={item.label} href={item.href} className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
              <div className="flex items-center justify-between gap-2"><item.icon className="w-4 h-4 text-gray-500" /><span className={`text-xs font-semibold ${(item.value || 0) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{(item.value || 0) > 0 ? 'Needs work' : 'Clear'}</span></div>
              <p className="text-xl font-extrabold text-gray-900 mt-3">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
        {quickActions.map(a => (
          <Link key={a.label} href={a.href} className="card-premium p-3 sm:p-4 text-center group">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-50 transition-colors"><a.icon className="w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors shrink-0" /></div>
            <p className="text-xs font-semibold text-gray-700">{a.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-premium p-5">
          <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-500 shrink-0" /> Price Distribution</h3>
          <div className="space-y-3">
            {priceDist.map((d, i: number) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{d.range}</span><span className="font-semibold text-gray-900">{d.count || 0}</span></div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-700" style={{ width: `${((d.count || 0) / maxPriceCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-premium p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500 shrink-0" /> Recent Activity</h3>
            <Link href="/admin/activity" className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0">View All <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="space-y-3">
            {(stats.recentActivity || []).slice(0, 6).map((log, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                {log.action?.includes('delete') ? <Trash2 className="w-3.5 h-3.5 text-red-500 shrink-0" /> : log.action?.includes('update') ? <Edit className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <Plus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900">{log.details || log.action}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{log.admin?.name || 'Admin'} · {log.createdAt ? new Date(log.createdAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                </div>
              </div>
            ))}
            {(!stats.recentActivity || stats.recentActivity.length === 0) && <p className="text-xs text-muted-foreground text-center py-6">No recent activity</p>}
          </div>
        </div>
      </div>
    </div>
  );
}