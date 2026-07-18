'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '@/lib/useAdmin';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck, AlertTriangle, AlertCircle, Info, XCircle,
  Smartphone, Image, DollarSign, Copy, Ghost, Clock, Upload,
  ScanSearch, FileCheck, History, BarChart3,
  CheckCircle, X, Download, Play, Eye, EyeOff, Wrench,
  ChevronRight, Loader2, RefreshCw, Search, Trash2, Tag,
} from 'lucide-react';

type TabId = 'overview' | 'issues' | 'missing-specs' | 'missing-images' | 'missing-prices' | 'duplicates' | 'orphans' | 'stale-prices' | 'import-warnings' | 'low-confidence' | 'price-issues' | 'brand-issues' | 'scan-history';

interface SummaryData {
  health: {
    score: number;
    categories: Array<{ name: string; score: number; deduction: number; maxDeduction: number; details: string }>;
    totals: { totalPhones: number; publishedPhones: number; draftPhones: number };
  } | null;
  totals: { totalPhones: number; publishedPhones: number; draftPhones: number; archivedPhones: number; totalBrands: number };
  specs: { withSpecs: number; completeSpecs: number; publishedPhones: number };
  queues: { missingSpecs: number; missingImages: number; missingPrices: number; duplicates: number; orphans: number; stalePrices: number; failedImports: number };
  severity: { critical: number; high: number; medium: number; low: number; info: number; total: number };
  trends: { discoveredToday: number; fixedToday: number; newLast7Days: number };
}

const TABS: { id: TabId; label: string; icon: any; queueFilter?: string; issueTypeFilter?: string; entityTypeFilter?: string }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'issues', label: 'All Issues', icon: AlertTriangle },
  { id: 'missing-specs', label: 'Missing Specs', icon: Smartphone, issueTypeFilter: 'PHONE_MISSING_SPECS' },
  { id: 'missing-images', label: 'Missing Images', icon: Image, issueTypeFilter: 'PHONE_MISSING_PRIMARY_IMAGE' },
  { id: 'missing-prices', label: 'Missing Prices', icon: DollarSign, issueTypeFilter: 'PHONE_MISSING_PRICE' },
  { id: 'duplicates', label: 'Duplicates', icon: Copy },
  { id: 'orphans', label: 'Orphans', icon: Ghost, issueTypeFilter: 'ORPHAN_SPECS' },
  { id: 'stale-prices', label: 'Stale Prices', icon: Clock, issueTypeFilter: 'PHONE_STALE_PRICE' },
  { id: 'import-warnings', label: 'Import Warnings', icon: Upload, entityTypeFilter: 'import' },
  { id: 'low-confidence', label: 'Low Confidence', icon: Tag, issueTypeFilter: 'IMPORT_LOW_CONFIDENCE' },
  { id: 'price-issues', label: 'Price Issues', icon: DollarSign, issueTypeFilter: 'PRICE_OUTLIER,PRICE_MISMATCH,PRICE_STALE_TRACKED,PRICE_SOURCE_INACTIVE' },
  { id: 'brand-issues', label: 'Brand Issues', icon: ShieldCheck, issueTypeFilter: 'BRAND_DUPLICATE_NORMALIZED,BRAND_MISSING_LOGO' },
  { id: 'scan-history', label: 'Scan History', icon: History },
];

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  critical: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle, label: 'Critical' },
  high: { color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: AlertTriangle, label: 'High' },
  medium: { color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', icon: AlertCircle, label: 'Medium' },
  low: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Info, label: 'Low' },
  info: { color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', icon: Info, label: 'Info' },
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  ignored: 'bg-gray-50 text-gray-600',
  resolved: 'bg-green-50 text-green-700',
  auto_fixed: 'bg-emerald-50 text-emerald-700',
  needs_review: 'bg-amber-50 text-amber-700',
  false_positive: 'bg-purple-50 text-purple-700',
};

export default function DataQualityPage() {
  const { admin, loading } = useAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId) || 'overview';

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [scanStatus, setScanStatus] = useState<{ running: boolean; scanId?: string; progress?: any }>({ running: false });

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/data-quality/summary', { credentials: 'include' });
      if (res.ok) setSummary(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoadingSummary(false); }
  }, []);

  useEffect(() => { if (admin) fetchSummary(); }, [admin, fetchSummary]);

  // Poll scan status if running
  useEffect(() => {
    if (!scanStatus.running || !scanStatus.scanId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/data-quality/scans/${scanStatus.scanId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setScanStatus(prev => ({ ...prev, progress: data.scan }));
          if (data.scan.status === 'completed' || data.scan.status === 'failed' || data.scan.status === 'completed_with_errors') {
            setScanStatus({ running: false });
            fetchSummary();
            clearInterval(interval);
          }
        }
      } catch (e) { clearInterval(interval); }
    }, 3000);
    return () => clearInterval(interval);
  }, [scanStatus.running, scanStatus.scanId, fetchSummary]);

  const startScan = async (type: string = 'full', dryRun: boolean = false) => {
    try {
      const res = await fetch('/api/admin/data-quality/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, dryRun, execute: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setScanStatus({ running: true, scanId: data.scanId });
      }
    } catch (e) { console.error(e); }
  };

  const setTab = (tab: TabId) => {
    router.push(`/admin/data-quality?tab=${tab}`);
  };

  if (loading || !admin) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Data Quality Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Detect, review, and fix data quality issues</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startScan('full', false)}
            disabled={scanStatus.running}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanStatus.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
            {scanStatus.running ? 'Scanning...' : 'Full Scan'}
          </button>
          <button
            onClick={() => startScan('full', true)}
            disabled={scanStatus.running}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Eye className="w-4 h-4" /> Dry Run
          </button>
          <button
            onClick={fetchSummary}
            className="p-2 bg-white border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={async () => {
              if (!confirm('Delete resolved/auto-fixed issues older than 30 days? This cannot be undone.')) return;
              try {
                const res = await fetch('/api/admin/data-quality/cleanup', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ olderThanDays: 30, status: 'resolved' }),
                });
                if (res.ok) {
                  const data = await res.json();
                  alert(`Cleaned up ${data.deleted} issues`);
                  fetchSummary();
                }
              } catch (e) { console.error(e); }
            }}
            className="p-2 bg-white border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors"
            title="Cleanup old resolved issues"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scan Progress */}
      {scanStatus.running && scanStatus.progress && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-sm font-medium text-blue-800">
                Scan {scanStatus.progress.status === 'running' ? 'in progress' : scanStatus.progress.status}
              </span>
            </div>
            <span className="text-xs text-blue-600">
              {scanStatus.progress.processed || 0} / {scanStatus.progress.total || '?'}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${scanStatus.progress.total ? ((scanStatus.progress.processed / scanStatus.progress.total) * 100) : 0}%` }}
            />
          </div>
          {scanStatus.progress.issuesFound > 0 && (
            <p className="text-xs text-blue-600 mt-1">{scanStatus.progress.issuesFound} issues found so far</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 pb-1 border-b border-gray-100">
        {TABS.map(tab => {
          const count = tab.issueTypeFilter
            ? summary?.queues?.[getQueueCountKey(tab.issueTypeFilter)] || 0
            : tab.id === 'issues' ? summary?.severity?.total || 0
            : tab.id === 'orphans' ? summary?.queues?.orphans || 0
            : tab.id === 'import-warnings' ? summary?.queues?.failedImports || 0
            : tab.id === 'stale-prices' ? summary?.queues?.stalePrices || 0
            : 0;

          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {count > 0 && (
                <span className={`ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                  count > 10 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}>{count > 99 ? '99+' : count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab summary={summary} loading={loadingSummary} onRefresh={fetchSummary} />}
      {activeTab === 'issues' && <IssuesTab summary={summary} onRefresh={fetchSummary} />}
      {activeTab === 'missing-specs' && <IssuesTab summary={summary} onRefresh={fetchSummary} defaultFilter={{ issueType: 'PHONE_MISSING_SPECS' }} />}
      {activeTab === 'missing-images' && <IssuesTab summary={summary} onRefresh={fetchSummary} defaultFilter={{ issueType: 'PHONE_MISSING_PRIMARY_IMAGE' }} />}
      {activeTab === 'missing-prices' && <IssuesTab summary={summary} onRefresh={fetchSummary} defaultFilter={{ issueType: 'PHONE_MISSING_PRICE' }} />}
      {activeTab === 'orphans' && <IssuesTab summary={summary} onRefresh={fetchSummary} defaultFilter={{ issueType: 'ORPHAN_SPECS,ORPHAN_IMAGE,ORPHAN_PRICE,ORPHAN_BENCHMARK' }} />}
      {activeTab === 'stale-prices' && <IssuesTab summary={summary} onRefresh={fetchSummary} defaultFilter={{ issueType: 'PHONE_STALE_PRICE' }} />}
      {activeTab === 'import-warnings' && <IssuesTab summary={summary} onRefresh={fetchSummary} defaultFilter={{ entityType: 'import' }} />}
      {activeTab === 'low-confidence' && <IssuesTab summary={summary} onRefresh={fetchSummary} defaultFilter={{ issueType: 'IMPORT_LOW_CONFIDENCE' }} />}
      {activeTab === 'price-issues' && <IssuesTab summary={summary} onRefresh={fetchSummary} defaultFilter={{ issueType: 'PRICE_OUTLIER,PRICE_MISMATCH,PRICE_STALE_TRACKED,PRICE_SOURCE_INACTIVE' }} />}
      {activeTab === 'brand-issues' && <IssuesTab summary={summary} onRefresh={fetchSummary} defaultFilter={{ issueType: 'BRAND_DUPLICATE_NORMALIZED,BRAND_MISSING_LOGO' }} />}
      {activeTab === 'duplicates' && <DuplicatesTab onRefresh={fetchSummary} />}
      {activeTab === 'scan-history' && <ScanHistoryTab />}
    </div>
  );
}

function getQueueCountKey(issueType: string): keyof NonNullable<SummaryData['queues']> {
  const map: Record<string, keyof NonNullable<SummaryData['queues']>> = {
    'PHONE_MISSING_SPECS': 'missingSpecs',
    'PHONE_MISSING_PRIMARY_IMAGE': 'missingImages',
    'PHONE_MISSING_PRICE': 'missingPrices',
    'PHONE_DUPLICATE_SLUG': 'duplicates',
    'PHONE_DUPLICATE_NORMALIZED': 'duplicates',
    'PHONE_STALE_PRICE': 'stalePrices',
    'ORPHAN_SPECS': 'orphans',
    'IMPORT_LOW_CONFIDENCE': 'missingSpecs',
  };
  return map[issueType] || 'missingSpecs';
}

// ═══════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════

function OverviewTab({ summary, loading, onRefresh }: { summary: SummaryData | null; loading: boolean; onRefresh: () => void }) {
  if (loading) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>;
  if (!summary) return <div className="text-center py-12 text-gray-500">Unable to load summary</div>;

  const health = summary.health;
  const scoreColor = health ? (health.score >= 80 ? 'text-green-600' : health.score >= 60 ? 'text-yellow-600' : health.score >= 40 ? 'text-orange-600' : 'text-red-600') : 'text-gray-400';
  const scoreRingColor = health ? (health.score >= 80 ? 'stroke-green-500' : health.score >= 60 ? 'stroke-yellow-500' : health.score >= 40 ? 'stroke-orange-500' : 'stroke-red-500') : 'stroke-gray-300';

  return (
    <div className="space-y-6">
      {/* Health Score + Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Health Score */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-4">Overall Health</h2>
          <div className="flex items-center justify-center">
            <div className="relative w-36 h-36">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none" className={scoreRingColor} strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - (health?.score || 0) / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${scoreColor}`}>{health?.score || '—'}</span>
                <span className="text-xs text-gray-400">out of 100</span>
              </div>
            </div>
          </div>
          {health?.categories && (
            <div className="mt-4 space-y-2">
              {health.categories.filter(c => c.deduction > 0).map(c => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{c.name}</span>
                  <span className="text-red-500 font-medium">-{c.deduction} pts</span>
                </div>
              ))}
              {health.categories.every(c => c.deduction === 0) && (
                <p className="text-xs text-green-600 text-center">No deductions</p>
              )}
            </div>
          )}
        </div>

        {/* Summary Cards Grid */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Phones" value={summary.totals.totalPhones} icon={Smartphone} />
          <StatCard label="Published" value={summary.totals.publishedPhones} icon={CheckCircle} color="text-green-600" />
          <StatCard label="Draft / Review" value={summary.totals.draftPhones} icon={AlertCircle} color="text-amber-600" />
          <StatCard label="Brands" value={summary.totals.totalBrands} icon={ShieldCheck} />
          <StatCard label="Complete Specs" value={summary.specs.completeSpecs} icon={FileCheck} color="text-blue-600" sub={`${summary.specs.withSpecs} with specs doc`} />
          <StatCard label="Missing Specs" value={summary.queues.missingSpecs} icon={Smartphone} color="text-red-600" />
          <StatCard label="Missing Images" value={summary.queues.missingImages} icon={Image} color="text-red-600" />
          <StatCard label="Missing Prices" value={summary.queues.missingPrices} icon={DollarSign} color="text-red-600" />
        </div>
      </div>

      {/* Severity + Queue Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Severity Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">Open Issues by Severity</h2>
          <div className="space-y-2">
            {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => {
              const cfg = SEVERITY_CONFIG[sev];
              const count = summary.severity[sev];
              return (
                <div key={sev} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                    <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{cfg.label}</span>
                      <span className={`text-sm font-semibold ${cfg.color}`}>{count}</span>
                    </div>
                    {summary.severity.total > 0 && (
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                        <div className={`h-1.5 rounded-full transition-all ${cfg.color.replace('text-', 'bg-')}`}
                          style={{ width: `${(count / Math.max(1, summary.severity.total)) * 100}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Queues */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">Data Queues</h2>
          <div className="space-y-2">
            {[
              { label: 'Missing Specs', count: summary.queues.missingSpecs, icon: Smartphone, tab: 'missing-specs' },
              { label: 'Missing Images', count: summary.queues.missingImages, icon: Image, tab: 'missing-images' },
              { label: 'Missing Prices', count: summary.queues.missingPrices, icon: DollarSign, tab: 'missing-prices' },
              { label: 'Duplicate Candidates', count: summary.queues.duplicates, icon: Copy, tab: 'duplicates' },
              { label: 'Orphan Records', count: summary.queues.orphans, icon: Ghost, tab: 'orphans' },
              { label: 'Stale Prices', count: summary.queues.stalePrices, icon: Clock, tab: 'stale-prices' },
              { label: 'Failed Imports', count: summary.queues.failedImports, icon: Upload, tab: 'import-warnings' },
            ].map(q => (
              <button
                key={q.tab}
                onClick={() => { const url = new URL(window.location.href); url.searchParams.set('tab', q.tab); window.history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')); }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                  <q.icon className="w-4 h-4 text-gray-500" />
                </div>
                <span className="flex-1 text-sm text-gray-700">{q.label}</span>
                <div className="flex items-center gap-2">
                  {q.count > 0 && <span className="text-sm font-semibold text-gray-900">{q.count}</span>}
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trends */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">Trends</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-red-50 rounded-xl">
            <p className="text-2xl font-bold text-red-600">{summary.trends.discoveredToday}</p>
            <p className="text-xs text-red-500 mt-1">Discovered Today</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-xl">
            <p className="text-2xl font-bold text-green-600">{summary.trends.fixedToday}</p>
            <p className="text-xs text-green-500 mt-1">Fixed Today</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-xl">
            <p className="text-2xl font-bold text-blue-600">{summary.trends.newLast7Days}</p>
            <p className="text-xs text-blue-500 mt-1">New Last 7 Days</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = 'text-gray-600', sub }: { label: string; value: number; icon: any; color?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ISSUES TAB (reusable for all queues)
// ═══════════════════════════════════════════════════════════════════

function IssuesTab({ summary, onRefresh, defaultFilter }: { summary: SummaryData | null; onRefresh: () => void; defaultFilter?: Record<string, any> }) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [detailIssue, setDetailIssue] = useState<any>(null);

  const fetchIssues = useCallback(async (p: number = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50', status: statusFilter });
      if (search) params.set('search', search);
      if (severityFilter) params.set('severity', severityFilter);
      if (defaultFilter?.issueType) params.set('issueType', defaultFilter.issueType);
      if (defaultFilter?.entityType) params.set('entityType', defaultFilter.entityType);

      const res = await fetch(`/api/admin/data-quality/issues?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
        setTotal(data.total);
        setPage(data.page);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search, severityFilter, statusFilter, defaultFilter]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const handleBulkAction = async () => {
    if (!bulkAction || selected.size === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/data-quality/bulk-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ issueIds: Array.from(selected), action: bulkAction, dryRun: false }),
      });
      if (res.ok) {
        const result = await res.json();
        setSelected(new Set());
        setBulkAction('');
        fetchIssues(1);
        onRefresh();
        alert(`Bulk action complete: ${result.succeeded} succeeded, ${result.failed} failed`);
      }
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  };

  const handleResolveIssue = async (issueId: string) => {
    try {
      await fetch(`/api/admin/data-quality/issues/${issueId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolution: 'Manually resolved' }),
      });
      setDetailIssue(null);
      fetchIssues();
      onRefresh();
    } catch (e) { console.error(e); }
  };

  const handleIgnoreIssue = async (issueId: string) => {
    try {
      await fetch(`/api/admin/data-quality/issues/${issueId}/ignore`, {
        method: 'POST', credentials: 'include',
      });
      setDetailIssue(null);
      fetchIssues();
      onRefresh();
    } catch (e) { console.error(e); }
  };

  const handleExport = () => {
    const params = new URLSearchParams({ status: statusFilter });
    if (severityFilter) params.set('severity', severityFilter);
    if (defaultFilter?.issueType) params.set('issueType', defaultFilter.issueType);
    window.open(`/api/admin/data-quality/export.csv?${params}`, '_blank');
  };

  const handleReScan = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      const entityIds = [...new Set(issues.filter(i => selected.has(i.id)).map(i => i.entityId))];
      const res = await fetch('/api/admin/data-quality/re-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entityIds }),
      });
      if (res.ok) alert('Re-scan started');
    } catch (e) { console.error(e); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === issues.length) setSelected(new Set());
    else setSelected(new Set(issues.map(i => i.id)));
  };

  const pages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" placeholder="Search issues..." value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchIssues(1)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none"
            />
          </div>
          <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none">
            <option value="">All Severity</option>
            {['critical', 'high', 'medium', 'low', 'info'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none">
            <option value="open">Open</option>
            <option value="all">All</option>
            <option value="ignored">Ignored</option>
            <option value="resolved">Resolved</option>
            <option value="auto_fixed">Auto-fixed</option>
            <option value="needs_review">Needs Review</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-blue-700 font-medium">{selected.size} selected</span>
          <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
            className="h-8 px-2 rounded-lg border border-blue-200 text-sm bg-white">
            <option value="">Actions...</option>
            <option value="ignore">Ignore</option>
            <option value="resolve">Resolve</option>
          </select>
          <button onClick={handleBulkAction} disabled={!bulkAction || actionLoading}
            className="h-8 px-3 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
          </button>
          <button onClick={handleReScan} className="h-8 px-3 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
            Re-scan
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-blue-500 hover:text-blue-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Issues List */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}</div>
      ) : issues.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No issues found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Header Row (desktop) */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-gray-500">
            <div className="col-span-1"><input type="checkbox" checked={selected.size === issues.length && issues.length > 0} onChange={toggleAll} className="rounded" /></div>
            <div className="col-span-2">Type</div>
            <div className="col-span-3">Entity</div>
            <div className="col-span-2">Field</div>
            <div className="col-span-1">Severity</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Actions</div>
          </div>

          {issues.map(issue => {
            const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info;
            const SevIcon = sev.icon;
            return (
              <div key={issue.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center px-4 py-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                <div className="sm:col-span-1">
                  <input type="checkbox" checked={selected.has(issue.id)} onChange={() => toggleSelect(issue.id)} className="rounded" />
                </div>
                <div className="sm:col-span-2">
                  <span className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded">{issue.issueType}</span>
                </div>
                <div className="sm:col-span-3">
                  <p className="text-sm font-medium text-gray-900 truncate">{issue.entityName || issue.entityId}</p>
                  <p className="text-[10px] text-gray-400">{issue.entityType} · {issue.entityId.slice(0, 8)}...</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm text-gray-600 truncate">{issue.field || '—'}</p>
                  {issue.currentValue != null && issue.currentValue !== '' && (
                    <p className="text-[10px] text-gray-400 truncate">{typeof issue.currentValue === 'object' ? JSON.stringify(issue.currentValue) : String(issue.currentValue)}</p>
                  )}
                </div>
                <div className="sm:col-span-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sev.bg} ${sev.color}`}>
                    <SevIcon className="w-3 h-3" />{issue.severity}
                  </span>
                </div>
                <div className="sm:col-span-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[issue.status] || STATUS_COLORS.open}`}>{issue.status}</span>
                </div>
                <div className="sm:col-span-2 flex items-center gap-1">
                  <button onClick={() => setDetailIssue(issue)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View Details">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {issue.status === 'open' && (
                    <>
                      <button onClick={() => handleResolveIssue(issue.id)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Resolve">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleIgnoreIssue(issue.id)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg" title="Ignore">
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                      {issue.suggestedValue && (
                        <a href={`/admin/phones/${issue.entityId}/edit`} target="_blank" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit Phone">
                          <Wrench className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => fetchIssues(Math.max(1, page - 1))} disabled={page <= 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {pages}</span>
          <button onClick={() => fetchIssues(Math.min(pages, page + 1))} disabled={page >= pages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
        </div>
      )}

      {/* Detail Drawer */}
      {detailIssue && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={() => setDetailIssue(null)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Issue Details</h3>
              <button onClick={() => setDetailIssue(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Issue Type" value={detailIssue.issueType} />
                <DetailField label="Severity" value={detailIssue.severity} />
                <DetailField label="Entity Type" value={detailIssue.entityType} />
                <DetailField label="Entity ID" value={detailIssue.entityId} mono />
                <DetailField label="Field" value={detailIssue.field || '—'} />
                <DetailField label="Status" value={detailIssue.status} />
                <DetailField label="Confidence" value={`${Math.round((detailIssue.confidence || 0) * 100)}%`} />
                <DetailField label="Detected" value={new Date(detailIssue.detectedAt).toLocaleString()} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Current Value</p>
                <pre className="text-sm bg-gray-50 rounded-lg p-3 overflow-auto max-h-32">{typeof detailIssue.currentValue === 'object' ? JSON.stringify(detailIssue.currentValue, null, 2) : String(detailIssue.currentValue ?? 'null')}</pre>
              </div>
              {detailIssue.suggestedValue && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Suggested Value</p>
                  <p className="text-sm bg-blue-50 rounded-lg p-3 text-blue-800">{typeof detailIssue.suggestedValue === 'object' ? JSON.stringify(detailIssue.suggestedValue, null, 2) : String(detailIssue.suggestedValue)}</p>
                </div>
              )}
              {detailIssue.metadata && Object.keys(detailIssue.metadata).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Metadata</p>
                  <pre className="text-sm bg-gray-50 rounded-lg p-3 overflow-auto max-h-32">{JSON.stringify(detailIssue.metadata, null, 2)}</pre>
                </div>
              )}
              {detailIssue.resolution && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Resolution</p>
                  <p className="text-sm text-green-700">{detailIssue.resolution}</p>
                </div>
              )}
              {detailIssue.status === 'open' && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => handleResolveIssue(detailIssue.id)} className="flex-1 h-9 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600">Resolve</button>
                  <button onClick={() => handleIgnoreIssue(detailIssue.id)} className="flex-1 h-9 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Ignore</button>
                  <a href={`/admin/phones/${detailIssue.entityId}/edit`} target="_blank" className="flex-1 h-9 border border-blue-200 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 text-center flex items-center justify-center">Edit Phone</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-gray-400 uppercase">{label}</p>
      <p className={`text-sm text-gray-800 mt-0.5 ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DUPLICATES TAB
// ═══════════════════════════════════════════════════════════════════

function DuplicatesTab({ onRefresh }: { onRefresh: () => void }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);
  const isMerging = merging !== null;
  const [mergeModal, setMergeModal] = useState<{ groupId: string; entities: any[] } | null>(null);

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/data-quality/duplicates', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [onRefresh]);

  useEffect(() => { fetchDuplicates(); }, [fetchDuplicates]);

  const handleMerge = async (keepId: string, mergeIntoId: string) => {
    setMerging(keepId);
    try {
      const res = await fetch(`/api/admin/data-quality/duplicates/${keepId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ keepId, mergeIntoId, dryRun: false }),
      });
      if (res.ok) {
        setMergeModal(null);
        fetchDuplicates();
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Merge failed');
      }
    } catch (e) { console.error(e); }
    finally { setMerging(null); }
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-gray-50 rounded-xl animate-pulse" />)}</div>;
  if (groups.length === 0) return <div className="text-center py-16"><CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" /><p className="text-gray-500 text-sm">No duplicate candidates found</p></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{groups.length} duplicate group{groups.length !== 1 ? 's' : ''} found</p>
      {groups.map((group, idx) => (
        <div key={idx} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">{group.type} · {group.entities.length} records</span>
          </div>
          <div className="divide-y divide-gray-50">
            {group.entities.map((entity: any) => (
              <div key={entity.id} className="px-5 py-3 flex items-center gap-4">
                {entity.thumbnail && <img src={entity.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{entity.modelName || entity.name}</p>
                  <p className="text-xs text-gray-400">
                    {entity.brandName ? `${entity.brandName} · ` : ''}
                    {entity.slug || '—'}
                    {entity.pricePKR ? ` · PKR ${entity.pricePKR.toLocaleString()}` : ''}
                    {entity.status ? ` · ${entity.status}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`/admin/phones/${entity.id}/edit`} target="_blank" className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg"><Wrench className="w-3.5 h-3.5" /></a>
                </div>
              </div>
            ))}
          </div>
          {group.entities.length === 2 && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">Merge one into the other (moves images, prices, specs)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMergeModal({ groupId: group.entities[0].id, entities: group.entities })}
                  className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100"
                >
                  Review Merge
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Merge Modal */}
      {mergeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setMergeModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Merge Duplicates</h3>
              <p className="text-xs text-gray-500 mt-0.5">Choose which phone to keep. The other will be archived and its child records moved.</p>
            </div>
            <div className="p-5 space-y-3">
              {mergeModal.entities.map((entity: any) => (
                <div key={entity.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl">
                  <input type="radio" name="keep" id={`keep-${entity.id}`} className="mt-1" />
                  <label htmlFor={`keep-${entity.id}`} className="flex-1 cursor-pointer">
                    <p className="text-sm font-medium">{entity.modelName || entity.name}</p>
                    <p className="text-xs text-gray-400">ID: {entity.id?.slice(0, 8)}...</p>
                  </label>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => {
                const keep = mergeModal.entities[0];
                const merge = mergeModal.entities[1];
                handleMerge(keep.id, merge.id);
              }} disabled={isMerging} className="flex-1 h-9 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50">
                {isMerging ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Merge (Keep First)'}
              </button>
              <button onClick={() => {
                const keep = mergeModal.entities[1];
                const merge = mergeModal.entities[0];
                handleMerge(keep.id, merge.id);
              }} disabled={isMerging} className="flex-1 h-9 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50">
                {isMerging ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Merge (Keep Second)'}
              </button>
              <button onClick={() => setMergeModal(null)} className="h-9 px-4 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SCAN HISTORY TAB
// ═══════════════════════════════════════════════════════════════════

function ScanHistoryTab() {
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchScans = useCallback(async (p: number = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/data-quality/scans?page=${p}&limit=20`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setScans(data.scans || []);
        setTotal(data.total);
        setPage(data.page);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchScans(); }, [fetchScans]);

  const statusColor: Record<string, string> = {
    queued: 'bg-gray-100 text-gray-600',
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    completed_with_errors: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-4">
      {scans.length === 0 ? (
        <div className="text-center py-16"><History className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 text-sm">No scans yet. Run your first scan.</p></div>
      ) : (
        <div className="space-y-2">
          {scans.map(scan => (
            <div key={scan._id} className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-100 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{scan.type} scan</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor[scan.status] || statusColor.queued}`}>{scan.status}</span>
                  {scan.dryRun && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700">dry run</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {scan.total} records · {scan.issuesFound} issues found · {scan.issuesCreated} created
                  {scan.completedAt ? ` · Finished ${new Date(scan.completedAt).toLocaleString()}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {Math.ceil(total / 20) > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => fetchScans(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
          <button onClick={() => fetchScans(page + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}