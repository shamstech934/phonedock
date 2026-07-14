'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Smartphone, Layers, TrendingUp, Star, Tag, Newspaper,
  Upload, RefreshCw, Eye, BarChart3, Activity, Database, Plus, Edit, Trash2,
} from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';
import { formatPrice } from '@/components/shared/formatPrice';

export default function AdminDashboardPage() {
  const { admin } = useAdmin();
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats', { credentials: 'include' })
      .then(r => r.json()).then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Total Phones', value: stats.totalPhones ?? 0, icon: Smartphone, bg: 'bg-blue-50', iconColor: 'text-blue-500' },
    { label: 'Brands', value: stats.totalBrands ?? 0, icon: Layers, bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
    { label: 'Trending', value: stats.trendingCount ?? 0, icon: TrendingUp, bg: 'bg-red-50', iconColor: 'text-red-500' },
    { label: 'Featured', value: stats.featuredCount ?? 0, icon: Star, bg: 'bg-amber-50', iconColor: 'text-amber-500' },
    { label: 'Avg Price', value: stats.avgPrice ? formatPrice(stats.avgPrice) : 'N/A', icon: Tag, bg: 'bg-violet-50', iconColor: 'text-violet-500' },
    { label: 'News', value: stats.newsCount ?? 0, icon: Newspaper, bg: 'bg-cyan-50', iconColor: 'text-cyan-500' },
  ];

  const quickActions = [
    { label: 'Import', icon: Upload, href: '/admin/import' },
    { label: 'Sync', icon: RefreshCw, href: '/admin/sync' },
    { label: 'Phones', icon: Smartphone, href: '/admin/phones' },
    { label: 'Brands', icon: Layers, href: '/admin/brands' },
    { label: 'News', icon: Newspaper, href: '/admin/news' },
    { label: 'Activity', icon: Activity, href: '/admin/activity' },
  ];

  const priceDist = stats.priceDistribution || [
    { range: 'Under 20K', count: 0 }, { range: '20K - 40K', count: 0 }, { range: '40K - 60K', count: 0 },
    { range: '60K - 100K', count: 0 }, { range: 'Above 100K', count: 0 },
  ];
  const maxPriceCount = Math.max(...priceDist.map((d: any) => d.count || 0), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">Welcome back, {admin?.name || 'Admin'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s what&apos;s happening with PhoneDock</p>
        </div>
        <Link href="/" className="self-start bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 h-9 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
          <Eye className="w-4 h-4" /> View Site
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="card-premium p-4">
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}><s.icon className={`w-4 h-4 ${s.iconColor}`} /></div>
            <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {(stats.totalPhones === 0 || stats.totalPhones === undefined) && (
        <div className="card-premium p-6 border-2 border-dashed border-emerald-300 bg-emerald-50/50">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
              <Database className="w-7 h-7 text-emerald-600" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-bold text-gray-900 text-base">Database is Empty</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Click below to seed 35+ verified real phones with specs, benchmarks & Pakistani prices</p>
            </div>
            <button onClick={async () => {
              try {
                const r = await fetch('/api/admin/seed', { method: 'POST', credentials: 'include' });
                const d = await r.json();
                if (d.success) { alert(`Seed complete!\n${d.phones} phones, ${d.brands} brands added.`); window.location.reload(); }
                else { alert('Seed failed: ' + (d.error || 'Unknown error')); }
              } catch (e: any) { alert('Seed failed: ' + e.message); }
            }} className="shrink-0 flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/25">
              <Database className="w-5 h-5" /> Seed Database Now
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {quickActions.map(a => (
          <Link key={a.label} href={a.href} className="card-premium p-3 sm:p-4 text-center group">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-50 transition-colors"><a.icon className="w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors" /></div>
            <p className="text-xs font-semibold text-gray-700">{a.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-premium p-5">
          <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-500" /> Price Distribution</h3>
          <div className="space-y-3">
            {priceDist.map((d: any, i: number) => (
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
          <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" /> Recent Activity</h3>
          <div className="space-y-3">
            {(stats.recentActivity || []).slice(0, 6).map((log: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                  {log.action?.includes('delete') ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : log.action?.includes('update') ? <Edit className="w-3.5 h-3.5 text-amber-500" /> : <Plus className="w-3.5 h-3.5 text-emerald-500" />}
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