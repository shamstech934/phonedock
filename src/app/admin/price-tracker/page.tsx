'use client';
import { readApiResponse } from '@/lib/client/api-response';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Smartphone, TrendingDown, TrendingUp, Clock, AlertTriangle,
  XCircle, CheckCircle, RefreshCw, Plus, ChevronLeft,
  ChevronRight, X, BarChart3, Globe, ShieldCheck,
  Settings, DollarSign, Activity, AlertCircle,
  History, Play, Pause, ToggleLeft, ToggleRight, Pencil, Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';
import { PRICE_SOURCE_TYPE_OPTIONS, getPriceSourceTypeLabel, normalizePriceSourceType, priceSourceSupportsAutomatedPriceTest, type PriceSourceType } from '@/lib/price-source-types';

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface OverviewStats {
  monitoredPhones: number;
  manualPrices: number;
  automaticPrices: number;
  dropsToday: number;
  increasesToday: number;
  pendingReview: number;
  failedChecks: number;
  lastSuccessfulUpdate: string | null;
  totalPublishedPhones: number;
  trackingReadyPhones: number;
  trackingCoveragePct: number;
  totalSources: number;
  enabledSources: number;
  readySources: number;
  pendingSourceGaps: number;
  unlinkedPhones?: number;
}

interface PhonePrice {
  id: string;
  phoneId: string;
  phoneName: string;
  brand: string;
  currentPrice: number;
  previousPrice: number;
  difference: number;
  percentChange: number;
  mode: 'manual' | 'automatic';
  source: string;
  lastUpdated: string;
  status: 'active' | 'inactive';
  linked?: boolean;
  verificationStatus?: 'pending' | 'verified' | 'rejected' | 'failed' | 'unlinked';
  manualOverrideCount?: number;
  lockedOverrideCount?: number;
}

interface PriceSource {
  id: string;
  name: string;
  type: PriceSourceType;
  market: 'PK' | 'US';
  currency: 'PKR' | 'USD';
  defaultPriceType: 'pta-approved' | 'non-pta' | 'us-retail' | 'unknown';
  status: 'active' | 'paused' | 'failed';
  trusted: boolean;
  priority: number;
  lastChecked: string | null;
  failures: number;
  baseUrl: string;
  verificationUrl: string;
  discoveryEnabled: boolean;
  discoveryMode: 'manual' | 'sitemap' | 'catalog' | 'feed' | 'api';
  catalogUrls: string[];
  sitemapUrls: string[];
  feedUrl: string;
  syncFrequency: 'manual' | 'hourly' | 'daily' | 'weekly';
  productsFound: number;
  productsAdded: number;
  productsUpdated: number;
  productsRemoved: number;
  allowedDomains: string[];
  listingCount: number;
  enabledListings: number;
  verifiedListings: number;
  pendingListings: number;
  health: 'healthy' | 'setup' | 'paused' | 'attention' | 'no-listings' | 'blocked';
  enabled: boolean;
  notes?: string;
  accessMode?: 'direct' | 'challenge_blocked' | 'manual_verified' | 'feed_api';
  automaticFetchEnabled?: boolean;
  lastHttpStatus?: number | null;
  lastFailureType?: string;
  lastFetchDurationMs?: number;
  lastFinalUrl?: string;
  lastResponsePreview?: string;
}

interface PriceChange {
  id: string;
  phoneId: string;
  phoneName: string;
  oldPrice: number;
  newPrice: number;
  difference: number;
  percentChange: number;
  changeType: 'increase' | 'decrease';
  sourceType: 'manual' | 'retailer' | 'marketplace' | 'official';
  source: string;
  date: string;
  status: 'approved' | 'rejected' | 'pending';
  reviewType?: 'price-change' | 'listing-verification';
  listingId?: string;
  sourceUrl?: string;
  ptaStatus?: string;
  reason?: string;
  priceClass?: 'pta-approved' | 'non-pta' | 'us-retail' | 'unknown';
  market?: 'PK' | 'US';
  currency?: 'PKR' | 'USD';
  priceType?: 'pta-approved' | 'non-pta' | 'us-retail' | 'unknown';
  ram?: string;
  storage?: string;
  color?: string;
  condition?: string;
  warrantyType?: string;
  variantKey?: string;
}

interface PriceHistoryEntry {
  id: string;
  phoneId: string;
  phoneName: string;
  oldPrice: number;
  newPrice: number;
  difference: number;
  percentChange: number;
  changeType: 'increase' | 'decrease';
  source: string;
  sourceType: string;
  date: string;
  status: string;
  priceClass?: 'pta-approved' | 'non-pta' | 'us-retail' | 'unknown';
  market?: 'PK' | 'US';
  currency?: 'PKR' | 'USD';
  priceType?: 'pta-approved' | 'non-pta' | 'us-retail' | 'unknown';
  ram?: string;
  storage?: string;
  color?: string;
  condition?: string;
  warrantyType?: string;
  variantKey?: string;
}

interface PhoneOption {
  id: string;
  name: string;
  brand: string;
}

interface MatchCandidate {
  id: string;
  phoneName: string;
  phoneSlug: string;
  sourceUrl: string;
  hostname: string;
  reason: string;
  createdAt: string | null;
}

interface UnlinkedPhone {
  id: string;
  phoneName: string;
  phoneSlug: string;
  brand: string;
  thumbnail: string;
  currentPrice: number;
}

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'overview', label: 'Control Center', icon: BarChart3 },
  { id: 'phones', label: 'Phone Prices', icon: Smartphone },
  { id: 'sources', label: 'Sources', icon: Globe },
  { id: 'matches', label: 'Unlinked', icon: AlertTriangle },
  { id: 'changes', label: 'Price Changes', icon: Activity },
  { id: 'pending', label: 'Review Queue', icon: AlertCircle },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Automation', icon: Settings },
];

const SOURCE_TYPES = PRICE_SOURCE_TYPE_OPTIONS;

const SORT_OPTIONS = [
  { value: 'name-az', label: 'Name A-Z' },
  { value: 'name-za', label: 'Name Z-A' },
  { value: 'price-low', label: 'Price Low→High' },
  { value: 'price-high', label: 'Price High→Low' },
  { value: 'change-desc', label: 'Biggest Drop' },
  { value: 'change-asc', label: 'Biggest Increase' },
  { value: 'updated', label: 'Recently Updated' },
];

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function sourceTypeBadgeClass(type: PriceSourceType): string {
  const classes: Record<PriceSourceType, string> = {
    retailer: 'bg-blue-100 text-blue-700',
    marketplace: 'bg-purple-100 text-purple-700',
    official: 'bg-emerald-100 text-emerald-700',
    official_brand: 'bg-green-100 text-green-700',
    reference_site: 'bg-cyan-100 text-cyan-700',
    distributor: 'bg-orange-100 text-orange-700',
    api: 'bg-indigo-100 text-indigo-700',
    rss_feed: 'bg-amber-100 text-amber-700',
    manual: 'bg-slate-100 text-slate-700',
  };
  return classes[type];
}

function toFiniteNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function variantLabel(item: { market?: string; currency?: string; priceType?: string; priceClass?: string; ram?: string; storage?: string; color?: string; condition?: string; warrantyType?: string }): string {
  const market = item.market === 'US' ? 'USA' : 'PK';
  const bucket = item.priceType === 'us-retail' || item.priceClass === 'us-retail' ? 'Retail' : item.priceClass === 'pta-approved' ? 'PTA' : item.priceClass === 'non-pta' ? 'Non-PTA' : '';
  return [market, bucket, item.ram, item.storage, item.color, item.condition && item.condition !== 'new' ? item.condition : '', item.warrantyType].filter(Boolean).join(' • ');
}

function formatMoney(price: unknown, currency: string = 'PKR'): string {
  const numericPrice = toFiniteNumber(price);
  if (numericPrice === null) return '—';
  return currency === 'USD' ? `$${numericPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `PKR ${numericPrice.toLocaleString('en-PK')}`;
}

function formatPKR(price: unknown): string {
  const numericPrice = toFiniteNumber(price);
  return numericPrice === null ? '—' : `PKR ${numericPrice.toLocaleString('en-PK')}`;
}

function formatDiff(diff: unknown): string {
  const numericDiff = toFiniteNumber(diff);
  if (numericDiff === null) return '—';
  const sign = numericDiff > 0 ? '+' : '';
  return `${sign}PKR ${Math.abs(numericDiff).toLocaleString('en-PK')}`;
}

function formatPercentChange(percentChange: unknown): string {
  const numericPercent = toFiniteNumber(percentChange);
  if (numericPercent === null) return '—';
  const sign = numericPercent > 0 ? '+' : '';
  return `${sign}${numericPercent.toFixed(1)}%`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return 'Never';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function AdminPriceTrackerPage() {
  useAdmin();

  // ── Active Tab ──
  const [activeTab, setActiveTab] = useState('overview');

  // ── Overview ──
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [recentChanges, setRecentChanges] = useState<PriceChange[]>([]);

  // ── Phones Tab ──
  const [phones, setPhones] = useState<PhonePrice[]>([]);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]);
  const [phonesTotal, setPhonesTotal] = useState(0);
  const [phoneModeTotals, setPhoneModeTotals] = useState({ manual: 0, automatic: 0 });
  const [phonesPage, setPhonesPage] = useState(1);
  const [phonesSearch, setPhonesSearch] = useState('');
  const [phonesDebouncedSearch, setPhonesDebouncedSearch] = useState('');
  const [phonesModeFilter, setPhonesModeFilter] = useState('all');
  const [phonesSort, setPhonesSort] = useState('name-az');
  const searchTimer = useRef<NodeJS.Timeout>(undefined);

  // ── Sources Tab ──
  const [sources, setSources] = useState<PriceSource[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState<{ name: string; type: PriceSourceType; market: 'PK' | 'US'; currency: 'PKR' | 'USD'; defaultPriceType: 'pta-approved' | 'non-pta' | 'us-retail' | 'unknown'; baseUrl: string; allowedDomains: string; priority: number }>({ name: '', type: 'retailer', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', baseUrl: '', allowedDomains: '', priority: 1 });
  const [editingSource, setEditingSource] = useState<PriceSource | null>(null);
  const [editSourceForm, setEditSourceForm] = useState<{ name: string; type: PriceSourceType; market: 'PK' | 'US'; currency: 'PKR' | 'USD'; defaultPriceType: 'pta-approved' | 'non-pta' | 'us-retail' | 'unknown'; baseUrl: string; verificationUrl: string; discoveryEnabled: boolean; discoveryMode: 'manual' | 'sitemap' | 'catalog' | 'feed' | 'api'; catalogUrls: string; sitemapUrls: string; feedUrl: string; syncFrequency: 'manual' | 'hourly' | 'daily' | 'weekly'; allowedDomains: string; priority: number; status: 'active' | 'paused' | 'failed'; trusted: boolean; notes: string }>({ name: '', type: 'retailer', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', baseUrl: '', verificationUrl: '', discoveryEnabled: false, discoveryMode: 'manual', catalogUrls: '', sitemapUrls: '', feedUrl: '', syncFrequency: 'daily', allowedDomains: '', priority: 1, status: 'active', trusted: false, notes: '' });
  const [editSourceFieldErrors, setEditSourceFieldErrors] = useState<Record<string, string>>({});
  const [deletingSource, setDeletingSource] = useState<PriceSource | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([]);
  const [unlinkedPhones, setUnlinkedPhones] = useState<UnlinkedPhone[]>([]);
  const [unlinkedTotal, setUnlinkedTotal] = useState(0);
  const [sourceGapsPage, setSourceGapsPage] = useState(1);
  const [sourceGapsTotalPages, setSourceGapsTotalPages] = useState(1);
  const [sourceTestModal, setSourceTestModal] = useState<PriceSource | null>(null);
  const [sourceTestUrl, setSourceTestUrl] = useState('');
  const [sourceTestResult, setSourceTestResult] = useState<{ reachable: boolean; title: string | null; detectedPrice: number | null; availability: string; matched: boolean; safeToEnable: boolean; extractionMethod: string | null; extractionConfidence: number; error: string | null; httpStatus?: number | null; finalUrl?: string; contentType?: string; fetchDurationMs?: number; failureType?: string; responsePreview?: string; accessMode?: string; automaticFetchEnabled?: boolean; market?: 'PK' | 'US'; currency?: 'PKR' | 'USD'; priceType?: string } | null>(null);

  // ── Price Changes Tab ──
  const [changes, setChanges] = useState<PriceChange[]>([]);
  const [changesFilter, setChangesFilter] = useState('all');
  const [changesSourceType, setChangesSourceType] = useState('all');

  // ── Pending Tab ──
  const [pending, setPending] = useState<PriceChange[]>([]);
  const [pendingCounts, setPendingCounts] = useState({ priceChanges: 0, listingVerification: 0, total: 0 });
  const [reviewListing, setReviewListing] = useState<PriceChange | null>(null);
  const [reviewListingForm, setReviewListingForm] = useState({ ram: '', storage: '', color: '', condition: 'new', ptaStatus: '', warrantyType: '' });

  // ── History Tab ──
  const [phoneOptions, setPhoneOptions] = useState<PhoneOption[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [selectedPhoneName, setSelectedPhoneName] = useState('');
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  // ── Modals ──
  const [editPriceModal, setEditPriceModal] = useState(false);
  const [editingPhone, setEditingPhone] = useState<PhonePrice | null>(null);
  const [editForm, setEditForm] = useState({ price: '', regularPrice: '', discountStartAt: '', discountEndAt: '', reason: '', market: 'PK' as 'PK' | 'US', currency: 'PKR' as 'PKR' | 'USD', priceType: 'pta-approved' as 'pta-approved' | 'non-pta' | 'us-retail', ptaStatus: 'PTA Approved', warrantyType: '', ram: '', storage: '', color: '', condition: 'new', lockOverride: true });
  const [priceControlRows, setPriceControlRows] = useState<{ manual: Array<Record<string, any>>; automatic: Array<Record<string, any>> }>({ manual: [], automatic: [] });
  const [priceControlLoading, setPriceControlLoading] = useState(false);

  const [addListingModal, setAddListingModal] = useState(false);
  const [listingPhoneId, setListingPhoneId] = useState('');
  const [listingForm, setListingForm] = useState({ source: '', url: '', ram: '', storage: '', color: '', condition: 'new', ptaStatus: '', warrantyType: '' });

  // ── General ──
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  // ── Settings Tab ──
  const [settings, setSettings] = useState({ autoApproveThreshold: 2, reviewThreshold: 15, batchSize: 10, checkFrequency: 'daily' });
  const [, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [cronConfigured, setCronConfigured] = useState(false);
  const [cronSchedule, setCronSchedule] = useState('0 1 * * *');

  const responseError = async (response: Response, fallback: string) => {
    try {
      const body = await readApiResponse(response) as { error?: string };
      return body.error || fallback;
    } catch (cause) {
      if (cause instanceof Error && cause.message) return cause.message;
      return response.status === 401 ? 'Authentication expired. Please sign in again.' : fallback;
    }
  };

  const networkError = (cause: unknown, area: string) => {
    if (cause instanceof TypeError && /failed to fetch/i.test(cause.message)) {
      return `${area} could not reach the Price Control API. Retry once; if it persists, check the deployment Function logs.`;
    }
    return cause instanceof Error ? cause.message : `${area} failed`;
  };

  /* ── Debounced search for phones ── */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPhonesDebouncedSearch(phonesSearch);
      setPhonesPage(1);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [phonesSearch]);

  /* ═══════════════════════════════════════════════════════════
     DATA FETCHING
     ═══════════════════════════════════════════════════════════ */

  const fetchOverview = useCallback(async () => {
    try {
      const [statsRes, changesRes] = await Promise.all([
        fetch('/api/admin/price-tracker/overview', { credentials: 'include' }),
        fetch('/api/admin/price-tracker/changes?limit=10', { credentials: 'include' }),
      ]);
      if (!statsRes.ok) throw new Error(await responseError(statsRes, 'Failed to load price overview'));
      if (!changesRes.ok) throw new Error(await responseError(changesRes, 'Failed to load recent price changes'));
      if (statsRes.ok) {
        const d = await readApiResponse(statsRes);
        setOverviewStats(d.stats || d);
      }
      if (changesRes.ok) {
        const d = await readApiResponse(changesRes);
        setRecentChanges(d.changes || d.data || []);
      }
    } catch (e) { setError(networkError(e, 'Price overview')); }
  }, []);

  const fetchPhones = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({
        page: String(phonesPage), limit: '20', sort: phonesSort,
      });
      if (phonesDebouncedSearch.length >= 2) params.set('search', phonesDebouncedSearch);
      if (phonesModeFilter !== 'all') params.set('mode', phonesModeFilter);
      const res = await fetch(`/api/admin/price-tracker/phones?${params}`, { credentials: 'include' });
      const d = await readApiResponse(res);
      if (!res.ok) throw new Error(d.error || 'Failed to fetch phones');
      setPhones(d.phones || d.data || []);
      setPhonesTotal(d.total || 0);
      setPhoneModeTotals({
        manual: Number(d.modeTotals?.manual || 0),
        automatic: Number(d.modeTotals?.automatic || 0),
      });
    } catch (e: unknown) {
      setError(networkError(e, 'Phone prices'));
    } finally { setLoading(false); }
  }, [phonesPage, phonesSort, phonesDebouncedSearch, phonesModeFilter]);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/price-tracker/sources', { credentials: 'include' });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to load price sources'));
      const d = await readApiResponse(res);
      const rows = d.sources || d.data || [];
      setSources(rows.map((source: Record<string, unknown>) => ({
        ...source,
        type: normalizePriceSourceType(source.sourceType || source.type),
        lastChecked: source.lastCheckedAt || source.lastChecked || null,
        failures: source.failureCount ?? source.failures ?? 0,
        accessMode: source.accessMode || 'direct',
        automaticFetchEnabled: source.automaticFetchEnabled !== false,
        lastHttpStatus: source.lastHttpStatus ?? null,
        lastFailureType: source.lastFailureType || '',
        lastFetchDurationMs: source.lastFetchDurationMs || 0,
        lastFinalUrl: source.lastFinalUrl || '',
        lastResponsePreview: source.lastResponsePreview || '',
      })) as PriceSource[]);
    } catch (e) { setError(networkError(e, 'Price sources')); }
  }, []);

  const fetchMatchCandidates = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: 'pending',
        includeUnlinked: '1',
        page: String(sourceGapsPage),
        limit: '25',
      });
      const res = await fetch(`/api/admin/price-tracker/match-queue?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to load source gaps'));
      const data = await readApiResponse(res);
      setMatchCandidates(data.candidates || []);
      setUnlinkedPhones(data.unlinkedPhones || []);
      setUnlinkedTotal(Number(data.unlinkedTotal || 0));
      setSourceGapsTotalPages(Math.max(1, Number(data.totalPages || 1)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load source gaps');
    }
  }, [sourceGapsPage]);

  const fetchChanges = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (changesFilter !== 'all') params.set('changeType', changesFilter);
      if (changesSourceType !== 'all') params.set('sourceType', changesSourceType);
      const res = await fetch(`/api/admin/price-tracker/changes?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to load price changes'));
      const d = await readApiResponse(res);
      setChanges(d.changes || d.data || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load price changes'); }
  }, [changesFilter, changesSourceType]);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/price-tracker/pending', { credentials: 'include' });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to load pending price reviews'));
      const d = await readApiResponse(res);
      const rows = d.pending || d.data || [];
      setPending(rows);
      setPendingCounts(d.counts || { priceChanges: rows.filter((item: PriceChange) => item.reviewType !== 'listing-verification').length, listingVerification: rows.filter((item: PriceChange) => item.reviewType === 'listing-verification').length, total: rows.length });
    } catch (e) { setError(networkError(e, 'Review queue')); }
  }, []);

  const fetchPhoneOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/price-tracker/phones?limit=200&fields=name,brand', { credentials: 'include' });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to load phone options'));
      const d = await readApiResponse(res);
      setPhoneOptions(d.phones || d.data || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load phone options'); }
  }, []);

  const fetchPriceHistory = useCallback(async (phoneId: string) => {
    if (!phoneId) { setPriceHistory([]); return; }
    try {
      const res = await fetch(`/api/admin/price-tracker/history/${phoneId}`, { credentials: 'include' });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to load price history'));
      const d = await readApiResponse(res);
      setPriceHistory(d.history || d.data || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load price history'); }
  }, []);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/admin/price-tracker/settings', { credentials: 'include' });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to load price tracker settings'));
      const d = await readApiResponse(res);
      setSettings({ autoApproveThreshold: d.autoApproveThreshold ?? 2, reviewThreshold: d.reviewThreshold ?? 15, batchSize: d.batchSize ?? 10, checkFrequency: d.checkFrequency ?? 'daily' });
      setCronConfigured(Boolean(d.cronConfigured));
      setCronSchedule(typeof d.cronSchedule === 'string' && d.cronSchedule ? d.cronSchedule : '0 1 * * *');
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load price tracker settings'); } finally { setSettingsLoading(false); }
  }, []);

  const saveSettings = useCallback(async () => {
    setSettingsSaving(true);
    setSettingsSaved(false);
    try {
      const res = await fetch('/api/admin/price-tracker/settings', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to save price tracker settings'));
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save price tracker settings'); } finally { setSettingsSaving(false); }
  }, [settings]);

  const runPriceSync = useCallback(async () => {
    setActionLoading('run-sync'); setError(''); setActionMessage('');
    try {
      const response = await fetch('/api/admin/price-tracker/run-sync', {
        method: 'POST', credentials: 'include',
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || 'Price sync failed');
      setActionMessage(`Sync complete: ${result.discoveredListings || 0} catalog links added, ${result.autoVerifiedListings || 0} auto-verified, ${result.processed || 0} prices checked, ${result.updated || 0} updated, ${result.pendingPriceChanges || 0} price change${Number(result.pendingPriceChanges || 0) === 1 ? '' : 's'} awaiting approval, ${result.pendingListings || 0} listing${Number(result.pendingListings || 0) === 1 ? '' : 's'} awaiting verification, ${result.failed || 0} failed.${result.hasMore ? ' More eligible listings remain for the next run.' : ''}`);
      await Promise.all([fetchOverview(), fetchPhones(), fetchSources(), fetchChanges(), fetchPending()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Price sync failed');
    } finally {
      setActionLoading('');
    }
  }, [fetchOverview]);

  const bootstrapPakistanSources = useCallback(async () => {
    setActionLoading('bootstrap'); setError(''); setActionMessage('');
    try {
      const response = await fetch('/api/admin/price-tracker/bootstrap', { method: 'POST', credentials: 'include' });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || 'Pakistan source setup failed');
      setActionMessage(`Pakistan source setup complete: ${result.created || 0} created, ${result.refreshed || 0} refreshed. Test a real product URL before trusting each source.`);
      await Promise.all([fetchOverview(), fetchSources()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pakistan source setup failed');
    } finally {
      setActionLoading('');
    }
  }, [fetchOverview, fetchSources]);

  const autoLinkListings = useCallback(async () => {
    setActionLoading('auto-link'); setError(''); setActionMessage('');
    try {
      const response = await fetch('/api/admin/price-tracker/auto-link', {
        method: 'POST', credentials: 'include',
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || 'Automatic linking failed');
      setActionMessage(`Catalog discovery: ${result.discovered || 0} product links found, ${result.discoveryLinked || 0} safely matched for review. Existing imports: ${result.linked || 0} new, ${result.alreadyLinked || 0} already linked. ${result.discoveryUnmatched || 0} discovered links need review or better phone data.`);
      await Promise.all([fetchOverview(), fetchPhones(), fetchSources(), fetchMatchCandidates()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Automatic linking failed');
    } finally {
      setActionLoading('');
    }
  }, [fetchOverview]);

  // ── Load data on tab change ──
  useEffect(() => {
    switch (activeTab) {
      case 'overview': fetchOverview(); fetchPhones(); fetchSources(); fetchPending(); break;
      case 'phones': fetchPhones(); break;
      case 'sources': fetchSources(); break;
      case 'matches': fetchMatchCandidates(); break;
      case 'changes': fetchChanges(); break;
      case 'pending': fetchPending(); break;
      case 'history': fetchPhoneOptions(); break;
      case 'settings': fetchSettings(); break;
    }
  }, [activeTab, fetchOverview, fetchPhones, fetchSources, fetchMatchCandidates, fetchChanges, fetchPending, fetchPhoneOptions, fetchSettings]);

  // Re-fetch phones when filters change (only on phones tab)
  useEffect(() => {
    if (activeTab === 'phones') fetchPhones();
  }, [phonesPage, phonesSort, phonesDebouncedSearch, phonesModeFilter, fetchPhones, activeTab]);

  // Re-fetch changes when filters change
  useEffect(() => {
    if (activeTab === 'changes') fetchChanges();
  }, [changesFilter, changesSourceType, fetchChanges, activeTab]);

  // Fetch history when phone selected
  useEffect(() => {
    fetchPriceHistory(selectedPhone);
  }, [selectedPhone, fetchPriceHistory]);

  /* ═══════════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════════ */

  const handleBulkOverrides = async (action: 'unlock' | 'reset-to-auto') => {
    if (selectedPhoneIds.length === 0) return;
    const warning = action === 'reset-to-auto' ? 'Remove ALL admin price overrides for the selected phones and return them to automatic pricing? Price history will remain.' : 'Unlock ALL admin overrides for the selected phones? Automatic verified prices may then become public.';
    if (!window.confirm(warning)) return;
    setActionLoading(`bulk-${action}`); setError('');
    try {
      const res = await fetch('/api/admin/price-tracker/bulk-overrides', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneIds: selectedPhoneIds, action }) });
      const d = await readApiResponse(res);
      if (!res.ok) throw new Error(d.error || 'Bulk price control failed');
      setActionMessage(`${d.modified || 0} price override record${Number(d.modified || 0) === 1 ? '' : 's'} updated.`);
      setSelectedPhoneIds([]);
      await Promise.all([fetchPhones(), fetchOverview()]);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Bulk price control failed'); }
    finally { setActionLoading(''); }
  };

  const handleUpdatePrice = async () => {
    if (!editingPhone || !editForm.price) return;
    setActionLoading('update-price');
    try {
      const res = await fetch('/api/admin/price-tracker/update-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phoneId: editingPhone.phoneId,
          newPrice: Number(editForm.price),
          regularPrice: editForm.regularPrice ? Number(editForm.regularPrice) : 0,
          discountStartAt: editForm.discountStartAt || '',
          discountEndAt: editForm.discountEndAt || '',
          reason: editForm.reason,
          market: editForm.market,
          currency: editForm.currency,
          priceType: editForm.priceType,
          ptaStatus: editForm.ptaStatus,
          warrantyType: editForm.warrantyType,
          ram: editForm.ram,
          storage: editForm.storage,
          color: editForm.color,
          condition: editForm.condition,
          lockOverride: editForm.lockOverride,
        }),
      });
      const d = await readApiResponse(res);
      if (!res.ok) throw new Error(d.error || 'Failed to update price');
      setEditPriceModal(false);
      setEditForm({ price: '', regularPrice: '', discountStartAt: '', discountEndAt: '', reason: '', market: 'PK', currency: 'PKR', priceType: 'pta-approved', ptaStatus: 'PTA Approved', warrantyType: '', ram: '', storage: '', color: '', condition: 'new', lockOverride: true });
      setEditingPhone(null);
      if (activeTab === 'phones') fetchPhones();
      else fetchOverview();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally { setActionLoading(''); }
  };

  const handleResetOverride = async () => {
    if (!editingPhone) return;
    if (!window.confirm('Reset this exact variant to automatic pricing? The admin override will be removed, but price history will remain.')) return;
    setActionLoading('reset-override');
    try {
      const res = await fetch('/api/admin/price-tracker/reset-override', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          phoneId: editingPhone.phoneId, market: editForm.market, currency: editForm.currency, priceType: editForm.priceType,
          ptaStatus: editForm.ptaStatus, warrantyType: editForm.warrantyType, ram: editForm.ram, storage: editForm.storage, color: editForm.color, condition: editForm.condition,
        }),
      });
      const d = await readApiResponse(res);
      if (!res.ok) throw new Error(d.error || 'Failed to reset manual override');
      setActionMessage(d.removed ? 'Manual override removed. Automatic verified pricing is active for this exact variant.' : 'No manual override existed for this exact variant.');
      setEditPriceModal(false); setEditingPhone(null);
      if (activeTab === 'phones') fetchPhones(); else fetchOverview();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Reset failed'); }
    finally { setActionLoading(''); }
  };

  const handleAddListing = async () => {
    if (!listingPhoneId || !listingForm.url || !listingForm.source) return;
    // Client-side URL validation
    try { new URL(listingForm.url); } catch {
      setError('Please enter a valid URL');
      return;
    }
    setActionLoading('add-listing');
    try {
      const res = await fetch('/api/admin/price-tracker/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phoneId: listingPhoneId,
          sourceId: listingForm.source,
          productUrl: listingForm.url,
          ram: listingForm.ram,
          storage: listingForm.storage,
          color: listingForm.color,
          condition: listingForm.condition,
          ptaStatus: listingForm.ptaStatus,
          warrantyType: listingForm.warrantyType,
        }),
      });
      const d = await readApiResponse(res);
      if (!res.ok) throw new Error(d.error || 'Failed to add listing');
      setAddListingModal(false);
      setListingForm({ source: '', url: '', ram: '', storage: '', color: '', condition: 'new', ptaStatus: '', warrantyType: '' });
      setListingPhoneId('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally { setActionLoading(''); }
  };

  const handleAddSource = async () => {
    if (!newSource.name || !newSource.baseUrl) return;
    setActionLoading('add-source');
    try {
      const res = await fetch('/api/admin/price-tracker/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newSource.name,
          sourceType: newSource.type,
          market: newSource.market,
          currency: newSource.currency,
          defaultPriceType: newSource.defaultPriceType,
          baseUrl: newSource.baseUrl,
          allowedDomains: newSource.allowedDomains.split(',').map(s => s.trim()).filter(Boolean),
          priority: newSource.priority,
        }),
      });
      const d = await readApiResponse(res);
      if (!res.ok) throw new Error(d.error || 'Failed to add source');
      setShowAddSource(false);
      setNewSource({ name: '', type: 'retailer', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', baseUrl: '', allowedDomains: '', priority: 1 });
      fetchSources();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally { setActionLoading(''); }
  };

  const handleToggleSource = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/price-tracker/sources/${id}/toggle`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to update source'));
      fetchSources();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to update source'); }
  };

  const openEditSource = (source: PriceSource) => {
    setEditingSource(source);
    setEditSourceForm({
      name: source.name,
      type: source.type,
      market: source.market || 'PK',
      currency: source.currency || (source.market === 'US' ? 'USD' : 'PKR'),
      defaultPriceType: source.defaultPriceType || (source.market === 'US' ? 'us-retail' : 'pta-approved'),
      baseUrl: source.baseUrl || '',
      verificationUrl: source.verificationUrl || '',
      discoveryEnabled: Boolean(source.discoveryEnabled),
      discoveryMode: source.discoveryMode || 'manual',
      catalogUrls: (source.catalogUrls || []).join('\n'),
      sitemapUrls: (source.sitemapUrls || []).join('\n'),
      feedUrl: source.feedUrl || '',
      syncFrequency: source.syncFrequency || 'daily',
      allowedDomains: (source.allowedDomains || []).join(', '),
      priority: source.priority || 1,
      status: source.status,
      trusted: source.trusted,
      notes: source.notes || '',
    });
    setError('');
    setEditSourceFieldErrors({});
    setActionMessage('');
  };

  const handleUpdateSource = async () => {
    if (!editingSource) return;
    setActionLoading(`edit-${editingSource.id}`);
    setError('');
    setEditSourceFieldErrors({});
    setActionMessage('');
    try {
      const allowedDomains = editSourceForm.allowedDomains
        .split(',')
        .map(domain => domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''))
        .filter(Boolean);
      const verificationUrl = editSourceForm.verificationUrl.trim();
      if (verificationUrl) {
        let host = '';
        try {
          const parsed = new URL(verificationUrl);
          if (parsed.protocol !== 'https:') throw new Error('Verification product URL must use HTTPS.');
          host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        } catch (urlError) {
          const message = urlError instanceof Error ? urlError.message : 'Verification product URL is invalid.';
          setEditSourceFieldErrors({ verificationUrl: message });
          throw new Error(message);
        }
        if (allowedDomains.length > 0 && !allowedDomains.some(domain => host === domain || host.endsWith(`.${domain}`))) {
          const message = `Verification URL must belong to ${allowedDomains.join(' or ')}. Current URL belongs to ${host}.`;
          setEditSourceFieldErrors({ verificationUrl: message });
          throw new Error(message);
        }
      }
      const response = await fetch(`/api/admin/price-tracker/sources/${editingSource.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editSourceForm.name.trim(),
          sourceType: editSourceForm.type,
          market: editSourceForm.market,
          currency: editSourceForm.currency,
          defaultPriceType: editSourceForm.defaultPriceType,
          baseUrl: editSourceForm.baseUrl.trim(),
          verificationUrl,
          discoveryEnabled: editSourceForm.discoveryEnabled,
          discoveryMode: editSourceForm.discoveryMode,
          catalogUrls: editSourceForm.catalogUrls.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean),
          sitemapUrls: editSourceForm.sitemapUrls.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean),
          feedUrl: editSourceForm.feedUrl.trim(),
          syncFrequency: editSourceForm.syncFrequency,
          allowedDomains,
          priority: Number(editSourceForm.priority),
          status: editSourceForm.status,
          enabled: editSourceForm.status === 'active',
          trusted: editSourceForm.trusted,
          notes: editSourceForm.notes.trim(),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, 'Failed to update source'));
      setEditingSource(null);
      setActionMessage(`${editSourceForm.name.trim()} updated successfully.`);
      await fetchSources();
      await fetchOverview();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to update source';
      setError(message);
      if (/verification/i.test(message) || /domain/i.test(message)) {
        setEditSourceFieldErrors(current => ({ ...current, verificationUrl: message }));
      } else if (/base URL/i.test(message)) {
        setEditSourceFieldErrors(current => ({ ...current, baseUrl: message }));
      } else if (/name/i.test(message)) {
        setEditSourceFieldErrors(current => ({ ...current, name: message }));
      } else if (/priority/i.test(message)) {
        setEditSourceFieldErrors(current => ({ ...current, priority: message }));
      }
    } finally {
      setActionLoading('');
    }
  };

  const handleDeleteSource = async () => {
    if (!deletingSource) return;
    const needsTypedConfirmation = deletingSource.listingCount > 0;
    if (needsTypedConfirmation && deleteConfirmText.trim() !== deletingSource.name) {
      setError(`Type "${deletingSource.name}" to confirm deletion.`);
      return;
    }
    setActionLoading(`delete-${deletingSource.id}`);
    setError('');
    setActionMessage('');
    try {
      const response = await fetch(`/api/admin/price-tracker/sources/${deletingSource.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(await responseError(response, 'Failed to delete source'));
      const deletedName = deletingSource.name;
      setDeletingSource(null);
      setDeleteConfirmText('');
      setActionMessage(`${deletedName} deleted successfully.`);
      await fetchSources();
      await fetchOverview();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to delete source');
    } finally {
      setActionLoading('');
    }
  };

  const openSourceTest = (source: PriceSource) => {
    setSourceTestModal(source);
    setSourceTestUrl(source.verificationUrl || '');
    setSourceTestResult(null);
    setError('');
    setActionMessage('');
  };

  const handleTestAndTrustSource = async () => {
    const source = sourceTestModal;
    const productUrl = sourceTestUrl.trim();
    if (!source || !productUrl) {
      setError('Paste a real phone product page URL first.');
      return;
    }
    setActionLoading(`test-${source.id}`); setError(''); setActionMessage(''); setSourceTestResult(null);
    try {
      const testResponse = await fetch('/api/admin/price-tracker/test-source', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl, sourceId: source.id }),
      });
      const test = await readApiResponse(testResponse);
      setSourceTestResult(test);
      if (!testResponse.ok) throw new Error(test.error || 'Source test failed');
      if (!test.safeToEnable) {
        // Keep the detailed validation result inside the modal instead of
        // replacing it with a generic page-level error.
        return;
      }
      setActionMessage(`${source.name} verified at ${test.currency || source.currency || 'PKR'} ${Number(test.detectedPrice).toLocaleString('en-US')} and marked trusted.`);
      await fetchSources();
      await fetchOverview();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Source test failed');
    } finally {
      setActionLoading('');
    }
  };

  const handleApproveReject = async (changeId: string, action: 'approve' | 'reject') => {
    setActionLoading(changeId);
    try {
      const res = await fetch(`/api/admin/price-tracker/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ changeId, action }),
      });
      if (!res.ok) throw new Error(await responseError(res, `Failed to ${action} price change`));
      fetchPending();
      if (activeTab === 'overview') fetchOverview();
    } catch (e) { setError(e instanceof Error ? e.message : `Failed to ${action} price change`); } finally { setActionLoading(''); }
  };

  const openListingReview = (item: PriceChange) => {
    setReviewListing(item);
    setReviewListingForm({
      ram: item.ram || '', storage: item.storage || '', color: item.color || '',
      condition: item.condition || 'new', ptaStatus: item.ptaStatus || '', warrantyType: item.warrantyType || '',
    });
  };

  const saveListingReview = async (verify: boolean) => {
    if (!reviewListing?.listingId) return;
    setActionLoading(`listing-${reviewListing.listingId}`);
    setActionError('');
    try {
      const payload = verify
        ? { ...reviewListingForm, verificationStatus: 'verified', enabled: true }
        : { verificationStatus: 'rejected', enabled: false };
      if (verify && reviewListing.market === 'PK' && !['PTA Approved', 'Non-PTA'].includes(reviewListingForm.ptaStatus)) {
        throw new Error('Choose PTA Approved or Non-PTA before verifying a Pakistan listing.');
      }
      const res = await fetch(`/api/admin/price-tracker/listings/${reviewListing.listingId}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await responseError(res, verify ? 'Failed to verify listing' : 'Failed to reject listing'));
      setActionMessage(verify ? 'Retail listing verified. It can now participate in automatic price checks.' : 'Retail listing rejected and disabled.');
      setReviewListing(null);
      await Promise.all([fetchPending(), fetchOverview(), fetchSources(), fetchPhones()]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to review listing');
    } finally {
      setActionLoading('');
    }
  };

  const handleToggleTracking = async (phoneId: string) => {
    setActionLoading(`toggle-phone-${phoneId}`);
    setActionError('');
    setActionMessage('');
    try {
      const res = await fetch(`/api/admin/price-tracker/phones/${phoneId}/toggle`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to update phone tracking'));
      const result = await readApiResponse(res) as { mode?: string };
      setActionMessage(`Phone switched to ${result.mode || 'updated'} price tracking.`);
      await Promise.all([fetchPhones(), fetchOverview()]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update phone tracking');
    } finally {
      setActionLoading('');
    }
  };

  const handleEnableEligibleTracking = async () => {
    setActionLoading('enable-eligible');
    setActionError('');
    setActionMessage('');
    try {
      const res = await fetch('/api/admin/price-tracker/phones/enable-eligible', {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to enable linked phones'));
      const result = await readApiResponse(res) as { eligible?: number; enabled?: number; alreadyEnabled?: number; skippedLocked?: number };
      const eligible = Number(result.eligible || 0);
      const enabled = Number(result.enabled || 0);
      const alreadyEnabled = Number(result.alreadyEnabled || 0);
      const skippedLocked = Number(result.skippedLocked || 0);
      if (eligible === 0) {
        setActionMessage('No verified phone links are ready yet. Run Auto-link catalog, then Run sync now to verify product pages.');
      } else if (enabled === 0) {
        setActionMessage(`${alreadyEnabled} verified linked phone${alreadyEnabled === 1 ? ' was' : 's were'} already enabled. No changes were needed.${skippedLocked ? ` ${skippedLocked} manual lock${skippedLocked === 1 ? ' was' : 's were'} preserved.` : ''}`);
      } else {
        setActionMessage(`${enabled} verified linked phone${enabled === 1 ? ' was' : 's were'} enabled for automatic tracking.${alreadyEnabled ? ` ${alreadyEnabled} already enabled.` : ''}${skippedLocked ? ` ${skippedLocked} manual lock${skippedLocked === 1 ? ' was' : 's were'} preserved.` : ''}`);
      }
      // The mutation has completed, so release the action button immediately.
      // Slow dashboard refresh queries must not leave it stuck on “Enabling…”.
      setActionLoading('');
      void Promise.allSettled([fetchPhones(), fetchOverview()]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to enable linked phones');
    } finally {
      setActionLoading('');
    }
  };

  const openEditPriceModal = async (phone: PhonePrice) => {
    setEditingPhone(phone);
    setEditForm({ price: String(phone.currentPrice), regularPrice: '', discountStartAt: '', discountEndAt: '', reason: '', market: 'PK', currency: 'PKR', priceType: 'pta-approved', ptaStatus: 'PTA Approved', warrantyType: '', ram: '', storage: '', color: '', condition: 'new', lockOverride: true });
    setPriceControlRows({ manual: [], automatic: [] });
    setEditPriceModal(true);
    setPriceControlLoading(true);
    try {
      const res = await fetch(`/api/admin/price-tracker/price-control/${phone.phoneId}`, { credentials: 'include' });
      const data = await readApiResponse(res) as { manual?: Array<Record<string, any>>; automatic?: Array<Record<string, any>>; error?: string };
      if (res.ok) setPriceControlRows({ manual: data.manual || [], automatic: data.automatic || [] });
    } finally { setPriceControlLoading(false); }
  };

  // openAddListingModal is available for future use when adding listing buttons to phone rows

  const openViewHistory = (phone: PhonePrice) => {
    setSelectedPhone(phone.phoneId);
    setSelectedPhoneName(phone.phoneName);
    setActiveTab('history');
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER HELPERS
     ═══════════════════════════════════════════════════════════ */

  const phonesTotalPages = Math.ceil(phonesTotal / 20);
  const filteredPhoneOptions = phoneOptions.filter(p =>
    p.name.toLowerCase().includes(historySearch.toLowerCase()) ||
    p.brand.toLowerCase().includes(historySearch.toLowerCase())
  );

  /* ═══════════════════════════════════════════════════════════
     PAGE HEADER
     ═══════════════════════════════════════════════════════════ */

  const renderHeader = () => (
    <div className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Price Control</h1>
        <p className="text-sm text-gray-500 mt-0.5">One place to control public prices, variants, discounts, sources and automatic updates</p>
      </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={bootstrapPakistanSources}
            disabled={Boolean(actionLoading)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {actionLoading === 'bootstrap' ? 'Setting up...' : 'Setup Pakistan sources'}
          </button>
          <button
            type="button"
            onClick={autoLinkListings}
            disabled={Boolean(actionLoading)}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            <Globe className="h-4 w-4" />
            {actionLoading === 'auto-link' ? 'Linking...' : 'Auto-link catalog'}
          </button>
          <button
            type="button"
            onClick={runPriceSync}
            disabled={Boolean(actionLoading)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${actionLoading === 'run-sync' ? 'animate-spin' : ''}`} />
            {actionLoading === 'run-sync' ? 'Checking prices...' : 'Run sync now'}
          </button>
        </div>
      </div>
      {actionMessage && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">{actionMessage}</div>}
      {actionError && <div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">{actionError}</div>}
    </div>
  );

  const renderTabs = () => (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-6 no-scrollbar">
      {TABS.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setError(''); setActionError(''); }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0 ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     TAB 1: OVERVIEW
     ═══════════════════════════════════════════════════════════ */

  const renderOverview = () => {
    const s = overviewStats;
    const stats = s ? [
      { label: 'Monitored Phones', value: s.monitoredPhones, icon: Smartphone, color: 'blue', bg: 'bg-blue-50', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
      { label: 'Manual Prices', value: s.manualPrices, icon: DollarSign, color: 'green', bg: 'bg-green-50', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
      { label: 'Automatic Prices', value: s.automaticPrices, icon: RefreshCw, color: 'purple', bg: 'bg-purple-50', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
      { label: 'Price Drops Today', value: s.dropsToday, icon: TrendingDown, color: 'green', bg: 'bg-green-50', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
      { label: 'Price Increases Today', value: s.increasesToday, icon: TrendingUp, color: 'red', bg: 'bg-red-50', iconBg: 'bg-red-100', iconColor: 'text-red-600' },
      { label: 'Pending Review', value: s.pendingReview, icon: AlertTriangle, color: 'yellow', bg: 'bg-yellow-50', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600' },
      { label: 'Failed Checks', value: s.failedChecks, icon: XCircle, color: 'red', bg: 'bg-red-50', iconBg: 'bg-red-100', iconColor: 'text-red-600' },
      { label: 'Last Successful Update', value: s.lastSuccessfulUpdate ? timeAgo(s.lastSuccessfulUpdate) : 'Never', icon: Clock, color: 'gray', bg: 'bg-gray-50', iconBg: 'bg-gray-100', iconColor: 'text-gray-600', isText: true },
    ] : [];

    return (
      <div>
        <div className="mb-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-600">Admin final authority</p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">Public Price Control Center</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-600">Every public price belongs to one exact identity: market + PTA bucket + RAM + storage + color + condition + warranty. Automatic offers may update in the background; a locked admin override always wins for that exact identity.</p>
            </div>
            <button onClick={() => setActiveTab('phones')} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700"><Pencil className="h-4 w-4"/>Control a phone</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button onClick={() => setActiveTab('phones')} className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-left hover:bg-emerald-100"><p className="text-xs font-bold text-emerald-900">Pakistan PTA</p><p className="mt-1 text-[11px] text-emerald-700">PKR · exact RAM/storage/color</p></button>
            <button onClick={() => setActiveTab('phones')} className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-left hover:bg-amber-100"><p className="text-xs font-bold text-amber-900">Pakistan Non-PTA</p><p className="mt-1 text-[11px] text-amber-700">PKR · never overwrites PTA</p></button>
            <button onClick={() => setActiveTab('phones')} className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-left hover:bg-indigo-100"><p className="text-xs font-bold text-indigo-900">USA Retail</p><p className="mt-1 text-[11px] text-indigo-700">USD · separate US market bucket</p></button>
            <button onClick={() => setActiveTab('pending')} className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-left hover:bg-rose-100"><p className="text-xs font-bold text-rose-900">Conflicts & Review</p><p className="mt-1 text-[11px] text-rose-700">Suspicious changes require approval</p></button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3"><p className="text-xs font-bold text-gray-900">Manual override</p><p className="mt-1 text-[11px] leading-4 text-gray-600">Correct any wrong automatic price. Save & Lock protects only the selected variant.</p></div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3"><p className="text-xs font-bold text-gray-900">Discount control</p><p className="mt-1 text-[11px] leading-4 text-gray-600">Sale price + regular price + optional start/end dates stay attached to the same variant.</p></div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3"><p className="text-xs font-bold text-gray-900">Duplicate protection</p><p className="mt-1 text-[11px] leading-4 text-gray-600">Saving the same identity updates it. A different market/storage/color remains a separate record.</p></div>
          </div>
        </div>

        {phones.length > 0 && <div className="mb-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="text-sm font-bold text-gray-900">Quick price control</h2><p className="text-xs text-gray-500">Open any phone and manage exact market/variant prices.</p></div><button onClick={() => setActiveTab('phones')} className="text-xs font-semibold text-blue-600">View all →</button></div>
          <div className="divide-y divide-gray-50">{phones.slice(0,6).map(p => <div key={p.phoneId} className="flex items-center justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900">{p.phoneName}</p><p className="text-[11px] text-gray-500">{p.brand} · {p.lockedOverrideCount || 0} locked · {p.mode}</p></div><div className="flex items-center gap-3"><span className="text-sm font-bold text-gray-900">{formatPKR(p.currentPrice)}</span><button onClick={() => openEditPriceModal(p)} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">Control</button></div></div>)}</div>
        </div>}

        {s && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-slate-950 to-blue-950 text-white shadow-sm">
            <div className="grid gap-5 p-5 lg:grid-cols-[1.25fr_.75fr]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-sky-300">Automatic tracking readiness</p>
                <div className="mt-2 flex items-end gap-3">
                  <span className="text-3xl font-black">{s.trackingCoveragePct}%</span>
                  <span className="pb-1 text-xs text-slate-300">{s.trackingReadyPhones} of {s.totalPublishedPhones} published phones linked</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all" style={{ width: `${Math.min(100, s.trackingCoveragePct)}%` }} />
                </div>
                <p className="mt-3 max-w-2xl text-xs leading-5 text-slate-300">
                  SpecsDekh checks only verified product pages from trusted domains. Add a retailer in Sources, test it, mark it trusted, then use Auto-link catalog. Daily Vercel cron handles every linked brand automatically.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xl font-black">{s.readySources ?? 0}</p><p className="text-[10px] text-slate-300">Ready sources</p></div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xl font-black">{s.pendingReview}</p><p className="text-[10px] text-slate-300">Need approval</p></div>
                <button onClick={() => setActiveTab('matches')} className="col-span-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15">
                  Review {s.unlinkedPhones ?? s.pendingSourceGaps ?? 0} unlinked phones
                </button>
                <button onClick={() => setActiveTab('sources')} className="col-span-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-50">Configure sources</button>
              </div>
            </div>
          </div>
        )}
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, i) => (
            <div key={i} className={`${stat.bg} rounded-xl p-4 border border-gray-100`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">
                    {stat.isText ? stat.value : stat.value.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Price Changes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent Price Changes</h2>
            <p className="text-xs text-gray-500 mt-0.5">Last 10 detected price changes</p>
          </div>
          {recentChanges.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No recent price changes</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-50">
                    <th className="text-left px-5 py-3 font-medium">Phone</th>
                    <th className="text-left px-5 py-3 font-medium">Old Price</th>
                    <th className="text-left px-5 py-3 font-medium">New Price</th>
                    <th className="text-left px-5 py-3 font-medium">Change</th>
                    <th className="text-left px-5 py-3 font-medium">Source</th>
                    <th className="text-left px-5 py-3 font-medium">Date</th>
                    <th className="text-left px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentChanges.map((c) => (
                    <tr key={c.id} className="text-sm hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-gray-900">{c.phoneName}</td>
                      <td className="px-5 py-3 text-gray-600">{formatMoney(c.oldPrice, c.currency)}</td>
                      <td className="px-5 py-3 text-gray-900 font-medium">{formatMoney(c.newPrice, c.currency)}</td>
                      <td className="px-5 py-3">
                        <span className={c.changeType === 'decrease' ? 'text-green-600' : 'text-red-600'}>
                          {formatDiff(c.difference)} ({formatPercentChange(c.percentChange)})
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{c.source}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(c.date)}</td>
                      <td className="px-5 py-3">
                        <Badge className={c.status === 'approved' ? 'bg-green-100 text-green-700' : c.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}>
                          {c.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     TAB 2: PHONES
     ═══════════════════════════════════════════════════════════ */

  const renderPhones = () => {
    if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>;
    if (error) return (
      <div className="text-center py-8">
        <p className="text-sm text-red-500 mb-3">{error}</p>
        <button onClick={fetchPhones} className="px-4 py-2 bg-blue-600 text-white text-xs rounded-xl hover:bg-blue-700 transition-colors">Retry</button>
      </div>
    );

    const manualCount = phoneModeTotals.manual;
    const autoCount = phoneModeTotals.automatic;

    return (
      <div>
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-sm font-bold text-gray-900">{phonesTotal}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">Manual (all)</p>
            <p className="text-sm font-bold text-blue-600">{manualCount}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">Automatic (all)</p>
            <p className="text-sm font-bold text-purple-600">{autoCount}</p>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Automatic tracking</p>
            <p className="text-xs text-gray-600">Only phones with a verified product page on an enabled trusted source will be enabled. Manual locks stay unchanged.</p>
          </div>
          <button
            type="button"
            onClick={handleEnableEligibleTracking}
            disabled={Boolean(actionLoading)}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${actionLoading === 'enable-eligible' ? 'animate-spin' : ''}`} />
            {actionLoading === 'enable-eligible' ? 'Enabling...' : 'Enable verified phones'}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search phones..."
                value={phonesSearch}
                onChange={e => setPhonesSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
            </div>
            <select
              value={phonesModeFilter}
              onChange={e => { setPhonesModeFilter(e.target.value); setPhonesPage(1); }}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
            >
              <option value="all">All Modes</option>
              <option value="manual">Manual</option>
              <option value="automatic">Automatic</option>
            </select>
            <select
              value={phonesSort}
              onChange={e => { setPhonesSort(e.target.value); setPhonesPage(1); }}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedPhoneIds.length > 0 && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3"><div><p className="text-xs font-bold text-blue-900">{selectedPhoneIds.length} phone{selectedPhoneIds.length === 1 ? '' : 's'} selected</p><p className="text-[11px] text-blue-700">Bulk reset removes admin overrides for selected phones; history remains.</p></div><div className="flex gap-2"><button onClick={() => handleBulkOverrides('unlock')} disabled={Boolean(actionLoading)} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700">Unlock overrides</button><button onClick={() => handleBulkOverrides('reset-to-auto')} disabled={Boolean(actionLoading)} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white">Reset selected to Auto</button><button onClick={() => setSelectedPhoneIds([])} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600">Clear</button></div></div>}

        {/* Table */}
        {phones.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-sm text-gray-400">
            No published phones matched the current filters.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                    <th className="w-10 px-4 py-3"><input aria-label="Select all visible phones" type="checkbox" checked={phones.length > 0 && phones.every(p => selectedPhoneIds.includes(p.phoneId))} onChange={e => setSelectedPhoneIds(e.target.checked ? Array.from(new Set([...selectedPhoneIds, ...phones.map(p => p.phoneId)])) : selectedPhoneIds.filter(id => !phones.some(p => p.phoneId === id)))} /></th><th className="text-left px-4 py-3 font-medium">Phone</th>
                    <th className="text-left px-4 py-3 font-medium">Brand</th>
                    <th className="text-right px-4 py-3 font-medium">Current Price</th>
                    <th className="text-right px-4 py-3 font-medium">Previous Price</th>
                    <th className="text-right px-4 py-3 font-medium">Difference</th>
                    <th className="text-right px-4 py-3 font-medium">% Change</th>
                    <th className="text-left px-4 py-3 font-medium">Mode</th>
                    <th className="text-left px-4 py-3 font-medium">Source</th>
                    <th className="text-left px-4 py-3 font-medium">Updated</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {phones.map((p) => (
                    <tr key={p.id} className="text-sm hover:bg-gray-50/50">
                      <td className="px-4 py-3"><input aria-label={`Select ${p.phoneName}`} type="checkbox" checked={selectedPhoneIds.includes(p.phoneId)} onChange={e => setSelectedPhoneIds(ids => e.target.checked ? Array.from(new Set([...ids, p.phoneId])) : ids.filter(id => id !== p.phoneId))} /></td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{p.phoneName}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.brand}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium text-right">{formatPKR(p.currentPrice)}</td>
                      <td className="px-4 py-3 text-gray-500 text-right">{p.previousPrice ? formatPKR(p.previousPrice) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {p.difference !== 0 ? (
                          <span className={p.difference < 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatDiff(p.difference)}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {toFiniteNumber(p.percentChange) !== null && Number(p.percentChange) !== 0 ? (
                          <span className={Number(p.percentChange) < 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatPercentChange(p.percentChange)}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge className={p.mode === 'manual' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>{p.mode}</Badge>
                          {Number(p.lockedOverrideCount || 0) > 0 && <span className="text-[10px] font-medium text-amber-700">{p.lockedOverrideCount} locked override{Number(p.lockedOverrideCount) === 1 ? '' : 's'}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate">{p.source || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(p.lastUpdated)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${p.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-xs text-gray-500">{p.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditPriceModal(p)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">Price Control</button>
                          <button onClick={() => openViewHistory(p)} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">History</button>
                          <button
                            onClick={() => handleToggleTracking(p.phoneId)}
                            disabled={Boolean(actionLoading) || (p.mode !== 'automatic' && p.verificationStatus !== 'verified')}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                            title={p.mode === 'automatic'
                              ? 'Switch to manual'
                              : p.verificationStatus === 'verified'
                                ? 'Enable auto-tracking'
                                : 'A verified product link from a trusted source is required'}
                          >
                            {actionLoading === `toggle-phone-${p.phoneId}`
                              ? <RefreshCw className="h-4 w-4 animate-spin" />
                              : p.mode === 'automatic'
                                ? <ToggleRight className="h-4 w-4 text-blue-500" />
                                : <ToggleLeft className="h-4 w-4" />}
                            {p.mode === 'automatic' ? 'Auto' : p.verificationStatus === 'verified' ? 'Enable' : 'Link required'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {phonesTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Showing {((phonesPage - 1) * 20) + 1}–{Math.min(phonesPage * 20, phonesTotal)} of {phonesTotal}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPhonesPage(p => Math.max(1, p - 1))}
                    disabled={phonesPage === 1}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, phonesTotalPages) }, (_, i) => {
                    let pageNum: number;
                    if (phonesTotalPages <= 5) {
                      pageNum = i + 1;
                    } else if (phonesPage <= 3) {
                      pageNum = i + 1;
                    } else if (phonesPage >= phonesTotalPages - 2) {
                      pageNum = phonesTotalPages - 4 + i;
                    } else {
                      pageNum = phonesPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPhonesPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                          phonesPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPhonesPage(p => Math.min(phonesTotalPages, p + 1))}
                    disabled={phonesPage === phonesTotalPages}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     TAB 3: SOURCES
     ═══════════════════════════════════════════════════════════ */

  const renderSources = () => (
    <div>
      <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <h2 className="text-sm font-bold text-slate-900">Source setup — one time only</h2>
        <div className="mt-3 grid gap-3 text-xs leading-5 text-slate-600 md:grid-cols-3">
          <div><strong className="block text-slate-900">1. Choose a real retailer</strong>Use an official store or Pakistani retailer that permits automated access and shows prices on stable product pages.</div>
          <div><strong className="block text-slate-900">2. Add and test domain</strong>Enter its HTTPS base URL and exact allowed domain. Test a product URL before trusting the source.</div>
          <div><strong className="block text-slate-900">3. Link once, sync daily</strong>Imported phones carrying that retailer URL can be bulk-linked. After that, daily cron checks all brands.</div>
        </div>
        <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-[11px] text-slate-600">
          Recommended source order: official brand store/API first, authorised retailer feed second, marketplace last. SpecsDekh cannot reliably invent product URLs; each tracked phone needs a genuine product page or feed record.
        </p>
      </div>
      {/* Add Source Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAddSource(!showAddSource)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Source
        </button>
      </div>

      {/* Add Source Form */}
      {showAddSource && (
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">New Price Source</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Source Name *</label>
              <input
                type="text"
                placeholder="e.g. Daraz"
                value={newSource.name}
                onChange={event => { const name = event.currentTarget.value; setNewSource(current => ({ ...current, name })); }}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Type *</label>
              <select
                value={newSource.type}
                onChange={event => { const type = normalizePriceSourceType(event.currentTarget.value); setNewSource(current => ({ ...current, type })); }}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              >
                {SOURCE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                {SOURCE_TYPES.find(type => type.value === newSource.type)?.description}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Market *</label>
              <select value={newSource.market} onChange={event => { const market = event.currentTarget.value as 'PK' | 'US'; setNewSource(current => ({ ...current, market, currency: market === 'US' ? 'USD' : 'PKR', defaultPriceType: market === 'US' ? 'us-retail' : 'pta-approved' })); }} className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white">
                <option value="PK">Pakistan</option><option value="US">USA</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Price bucket</label>
              <select value={newSource.defaultPriceType} onChange={event => setNewSource(current => ({ ...current, defaultPriceType: event.currentTarget.value as typeof current.defaultPriceType }))} className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white">
                {newSource.market === 'US' ? <option value="us-retail">USA Retail (USD)</option> : <><option value="pta-approved">Pakistan PTA</option><option value="non-pta">Pakistan Non-PTA</option><option value="unknown">Mixed / classify per listing</option></>}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Base URL {newSource.type === 'manual' ? '(optional)' : '*'}</label>
              <input
                type="text"
                placeholder="https://www.daraz.pk"
                value={newSource.baseUrl}
                onChange={event => { const baseUrl = event.currentTarget.value; setNewSource(current => ({ ...current, baseUrl })); }}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Allowed Domains</label>
              <input
                type="text"
                placeholder="daraz.pk, mytech.pk (comma-separated)"
                value={newSource.allowedDomains}
                onChange={event => { const allowedDomains = event.currentTarget.value; setNewSource(current => ({ ...current, allowedDomains })); }}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Priority</label>
              <input
                type="number"
                min={1}
                max={100}
                value={newSource.priority}
                onChange={event => { const priority = Number(event.currentTarget.value); setNewSource(current => ({ ...current, priority })); }}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddSource}
              disabled={actionLoading === 'add-source' || !newSource.name || (newSource.type !== 'manual' && !newSource.baseUrl)}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === 'add-source' ? 'Saving...' : 'Save Source'}
            </button>
            <button
              onClick={() => { setShowAddSource(false); setNewSource({ name: '', type: 'retailer', market: 'PK', currency: 'PKR', defaultPriceType: 'pta-approved', baseUrl: '', allowedDomains: '', priority: 1 }); }}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sources Table */}
      {sources.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-sm text-gray-400">
          No price sources configured. Add a source to begin tracking prices.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Trusted</th>
                  <th className="text-left px-4 py-3 font-medium">Coverage</th>
                  <th className="text-right px-4 py-3 font-medium">Priority</th>
                  <th className="text-left px-4 py-3 font-medium">Last Checked</th>
                  <th className="text-right px-4 py-3 font-medium">Failures</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sources.map((src) => (
                  <tr key={src.id} className="text-sm hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{src.name}</p>
                      <p className={`mt-0.5 max-w-[180px] truncate text-[10px] ${src.allowedDomains.length ? 'text-gray-400' : 'font-medium text-amber-600'}`}>
                        {src.allowedDomains.length ? src.allowedDomains.join(', ') : src.type === 'manual' ? 'Manual source' : 'No allowed domain'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={sourceTypeBadgeClass(src.type)}>
                        {getPriceSourceTypeLabel(src.type)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${src.status === 'active' ? 'bg-green-500' : src.status === 'paused' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                        <span className="text-xs capitalize">{src.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {src.trusted ? (
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-[110px]">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className={
                            src.health === 'healthy' ? 'font-semibold text-emerald-700' :
                            src.health === 'attention' ? 'font-semibold text-red-600' :
                            src.health === 'blocked' ? 'font-semibold text-violet-700' :
                            'font-medium text-amber-600'
                          }>
                            {src.type === 'manual' ? 'Manual source' :
                             src.type === 'rss_feed' ? 'Feed source' :
                             src.health === 'healthy' ? 'Ready' :
                             src.health === 'attention' ? 'Needs attention' :
                             src.health === 'blocked' ? 'Server blocked' :
                             src.health === 'setup' ? 'Test required' :
                             src.health === 'paused' ? 'Paused' : 'No verified links'}
                          </span>
                          <span className="text-gray-400">{src.verifiedListings}/{src.listingCount}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${src.health === 'healthy' ? 'bg-emerald-500' : src.health === 'blocked' ? 'bg-violet-500' : 'bg-amber-400'}`}
                            style={{ width: `${src.listingCount > 0 ? Math.round((src.verifiedListings / src.listingCount) * 100) : 0}%` }}
                          />
                        </div>
                        {src.pendingListings > 0 && <p className="mt-1 text-[10px] text-amber-600">{src.pendingListings} pending review</p>}
                        {src.health === 'blocked' && <p className="mt-1 max-w-[150px] text-[10px] leading-4 text-violet-700">Automatic server checks disabled; use a feed/API or manual verified price.</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{src.priority}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{src.lastChecked ? timeAgo(src.lastChecked) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={src.failures > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{src.failures}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleSource(src.id)}
                          className={`p-1.5 rounded-lg transition-colors ${src.status === 'active' ? 'text-yellow-500 hover:bg-yellow-50' : 'text-green-500 hover:bg-green-50'}`}
                          title={src.status === 'active' ? 'Pause source' : 'Activate source'}
                          aria-label={src.status === 'active' ? `Pause ${src.name}` : `Activate ${src.name}`}
                        >
                          {src.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditSource(src)}
                          disabled={Boolean(actionLoading)}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                          title="Edit source"
                          aria-label={`Edit ${src.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDeletingSource(src); setDeleteConfirmText(''); setError(''); }}
                          disabled={Boolean(actionLoading)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                          title="Delete source"
                          aria-label={`Delete ${src.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                        {priceSourceSupportsAutomatedPriceTest(src.type) ? (
                          <button
                            type="button"
                            onClick={() => openSourceTest(src)}
                            disabled={Boolean(actionLoading)}
                            className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {actionLoading === `test-${src.id}` ? 'Testing...' : src.trusted ? 'Retest' : 'Test & trust'}
                          </button>
                        ) : (
                          <span className="px-2 py-1 text-[11px] font-medium text-slate-400">
                            {src.type === 'manual' ? 'Manual review' : 'Feed validation'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     TAB 4: PRICE CHANGES
     ═══════════════════════════════════════════════════════════ */

  const handleIgnoreMatchCandidate = async (id: string) => {
    setActionLoading(`ignore-match-${id}`);
    setError('');
    try {
      const response = await fetch(`/api/admin/price-tracker/match-queue/${id}/ignore`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(await responseError(response, 'Failed to ignore source gap'));
      setMatchCandidates(current => current.filter(candidate => candidate.id !== id));
      setActionMessage('Source gap ignored.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to ignore source gap');
    } finally {
      setActionLoading('');
    }
  };

  const renderMatchCandidates = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-900">Source Gaps</p>
        <p className="mt-1 text-xs font-medium text-blue-800">How this queue works</p>
        <p className="mt-1 text-xs leading-5 text-blue-700">
          Auto-link scans imported retailer URLs. Add and test the missing retailer in Sources, then run Auto-link again.
        </p>
      </div>
      {unlinkedPhones.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Unlinked catalog phones</p>
              <p className="text-xs text-gray-500">{unlinkedTotal} published phones still need a verified retailer product page.</p>
            </div>
            <p className="text-xs font-medium text-gray-500">Page {sourceGapsPage} of {sourceGapsTotalPages}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50/70 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-left font-medium">Brand</th>
                  <th className="px-4 py-3 text-left font-medium">Current price</th>
                  <th className="px-4 py-3 text-left font-medium">Required action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {unlinkedPhones.map(phone => (
                  <tr key={phone.id} className="text-sm">
                    <td className="px-4 py-3 font-medium text-gray-900">{phone.phoneName}</td>
                    <td className="px-4 py-3 text-gray-600">{phone.brand}</td>
                    <td className="px-4 py-3 text-gray-600">{phone.currentPrice > 0 ? `PKR ${phone.currentPrice.toLocaleString()}` : 'Price unavailable'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPhonesSearch(phone.phoneName);
                            setPhonesDebouncedSearch(phone.phoneName);
                            setPhonesPage(1);
                            setActiveTab('phones');
                          }}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Link retailer page
                        </button>
                        <a href={`/phones/${phone.phoneSlug}`} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                          View phone
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sourceGapsTotalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <button type="button" disabled={sourceGapsPage <= 1} onClick={() => setSourceGapsPage(page => Math.max(1, page - 1))} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40">Previous</button>
              <span className="text-xs text-gray-500">Showing {(sourceGapsPage - 1) * 25 + 1}–{Math.min(sourceGapsPage * 25, unlinkedTotal)} of {unlinkedTotal}</span>
              <button type="button" disabled={sourceGapsPage >= sourceGapsTotalPages} onClick={() => setSourceGapsPage(page => Math.min(sourceGapsTotalPages, page + 1))} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}
      {matchCandidates.length === 0 && unlinkedPhones.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <CheckCircle className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-3 text-sm font-semibold text-gray-900">No unresolved source gaps</p>
          <p className="mt-1 text-xs text-gray-500">Run Auto-link catalog after importing phones to refresh this queue.</p>
        </div>
      ) : matchCandidates.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">Imported URL match issues</p>
            <p className="text-xs text-gray-500">These URLs could not be safely matched to a catalog phone.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50/70 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-left font-medium">Missing source</th>
                  <th className="px-4 py-3 text-left font-medium">Reason</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {matchCandidates.map(candidate => (
                  <tr key={candidate.id} className="text-sm">
                    <td className="px-4 py-3 font-medium text-gray-900">{candidate.phoneName}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-700">{candidate.hostname}</p>
                      <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="block max-w-[280px] truncate text-xs text-blue-600 hover:underline">
                        {candidate.sourceUrl}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{candidate.reason}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setActiveTab('sources')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                          Configure source
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIgnoreMatchCandidate(candidate.id)}
                          disabled={actionLoading === `ignore-match-${candidate.id}`}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {actionLoading === `ignore-match-${candidate.id}` ? 'Ignoring...' : 'Ignore'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderChanges = () => (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={changesFilter}
            onChange={e => setChangesFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
          >
            <option value="all">All Changes</option>
            <option value="increase">Increases Only</option>
            <option value="decrease">Decreases Only</option>
          </select>
          <select
            value={changesSourceType}
            onChange={e => setChangesSourceType(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
          >
            <option value="all">All Sources</option>
            <option value="manual">Manual</option>
            <option value="retailer">Retailer</option>
            <option value="marketplace">Marketplace</option>
            <option value="official">Official</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {changes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-sm text-gray-400">
          No price changes found.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-medium">Phone</th>
                  <th className="text-right px-4 py-3 font-medium">Old Price</th>
                  <th className="text-right px-4 py-3 font-medium">New Price</th>
                  <th className="text-right px-4 py-3 font-medium">Difference</th>
                  <th className="text-right px-4 py-3 font-medium">% Change</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Source</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {changes.map((c) => (
                  <tr key={c.id} className="text-sm hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-900 max-w-[220px]"><div className="font-medium truncate">{c.phoneName}</div>{variantLabel(c) ? <div className="mt-0.5 text-[10px] text-blue-600">{variantLabel(c)}</div> : null}</td>
                    <td className="px-4 py-3 text-gray-500 text-right">{formatMoney(c.oldPrice, c.currency)}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium text-right">{formatMoney(c.newPrice, c.currency)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={c.changeType === 'decrease' ? 'text-green-600' : 'text-red-600'}>
                        {formatDiff(c.difference)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={c.changeType === 'decrease' ? 'text-green-600' : 'text-red-600'}>
                        {formatPercentChange(c.percentChange)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={c.changeType === 'increase' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                        {c.changeType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.source}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.date)}</td>
                    <td className="px-4 py-3">
                      <Badge className={
                        c.status === 'approved' ? 'bg-green-100 text-green-700' :
                        c.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {c.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleApproveReject(c.id, 'approve')}
                            disabled={actionLoading === c.id}
                            className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApproveReject(c.id, 'reject')}
                            disabled={actionLoading === c.id}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     TAB 5: PENDING REVIEW
     ═══════════════════════════════════════════════════════════ */

  const renderPending = () => {
    if (pending.length === 0) {
      return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">All caught up! No pending price changes or retail listings need review.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge className="bg-amber-100 text-amber-800">{pendingCounts.priceChanges} price changes</Badge>
          <Badge className="bg-blue-100 text-blue-800">{pendingCounts.listingVerification} listing verifications</Badge>
          <span className="self-center text-gray-500">Admin approval remains final authority. Automatic sync cannot publish an unverified listing.</span>
        </div>
        {pending.map((item) => {
          const listingReview = item.reviewType === 'listing-verification';
          return (
          <div key={item.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{item.phoneName}</h3>
                  <Badge className="bg-yellow-100 text-yellow-700">pending</Badge>
                  <Badge className={listingReview ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                    {listingReview ? 'Listing verification' : 'Price change'}
                  </Badge>
                </div>
                {variantLabel(item) ? <p className="mb-1 text-[10px] font-medium text-blue-600">{variantLabel(item)}</p> : null}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {listingReview ? (
                    <>
                      <span>Listing price: <span className="font-medium text-gray-700">{formatMoney(item.newPrice, item.currency)}</span></span>
                      <span>Source: {item.source || 'Unknown source'}</span>
                    </>
                  ) : (
                    <>
                      <span>Detected: <span className="font-medium text-gray-700">{formatMoney(item.newPrice, item.currency)}</span></span>
                      <span>Current: <span className="font-medium text-gray-700">{formatMoney(item.oldPrice, item.currency)}</span></span>
                      <span className={item.changeType === 'decrease' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {formatDiff(item.difference)} ({formatPercentChange(item.percentChange)})
                      </span>
                      <span>Source: {item.source}</span>
                    </>
                  )}
                  <span>{formatDateTime(item.date)}</span>
                </div>
                {item.reason && <p className="text-xs text-gray-500 mt-1.5">Reason: {item.reason}</p>}
                {listingReview && item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-blue-600 hover:underline">Open retailer page ↗</a>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {listingReview ? (
                  <button
                    onClick={() => openListingReview(item)}
                    disabled={actionLoading === `listing-${item.listingId}`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Review listing
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleApproveReject(item.id, 'approve')}
                      disabled={actionLoading === item.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleApproveReject(item.id, 'reject')}
                      disabled={actionLoading === item.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <XCircle className="w-3 h-3" />
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )})}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     TAB 6: HISTORY
     ═══════════════════════════════════════════════════════════ */

  const renderHistory = () => {
    // Build chart data from price history
    const chartData = priceHistory.length > 0
      ? (() => {
          const entries = [...priceHistory].reverse();
          // Start with the oldest "oldPrice" and build a price timeline
          const points: { date: string; price: number; changeType: string }[] = [];
          if (entries.length > 0) {
            points.push({
              date: entries[0].date,
              price: entries[0].oldPrice,
              changeType: 'initial',
            });
            entries.forEach(e => {
              points.push({ date: e.date, price: e.newPrice, changeType: e.changeType });
            });
          }
          return points;
        })()
      : [];

    const maxPrice = chartData.length > 0 ? Math.max(...chartData.map(p => p.price)) : 0;
    const minPrice = chartData.length > 0 ? Math.min(...chartData.map(p => p.price)) : 0;
    const priceRange = maxPrice - minPrice || 1;
    const chartHeight = 200;
    const chartWidth = Math.min(chartData.length * 60, 800);
    const barWidth = Math.max(20, Math.min(40, (chartWidth - 40) / chartData.length - 8));

    return (
      <div>
        {/* Phone Selector */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-4">
          <label className="text-xs text-gray-500 font-medium mb-2 block">Select a phone to view price history</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search phones..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white mb-2"
            />
          </div>
          {historySearch.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
              {filteredPhoneOptions.length === 0 ? (
                <div className="p-3 text-xs text-gray-400 text-center">No phones found</div>
              ) : (
                filteredPhoneOptions.slice(0, 20).map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedPhone(p.id); setSelectedPhoneName(p.name); setHistorySearch(''); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${selectedPhone === p.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{p.brand}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {selectedPhone && !historySearch && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 rounded-lg">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">{selectedPhoneName || 'Selected Phone'}</span>
              <button onClick={() => { setSelectedPhone(''); setSelectedPhoneName(''); setPriceHistory([]); }} className="ml-auto text-blue-400 hover:text-blue-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Chart */}
        {selectedPhone && chartData.length > 0 && (
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Price Trend</h3>
            <div className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
                className="w-full min-w-[400px]"
                style={{ maxHeight: '280px' }}
              >
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                  const y = 10 + (chartHeight * (1 - pct));
                  return (
                    <g key={pct}>
                      <line x1="30" y1={y} x2={chartWidth - 10} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                      <text x="25" y={y + 3} textAnchor="end" fill="#94a3b8" fontSize="9">
                        {`PKR ${Math.round(minPrice + priceRange * pct).toLocaleString()}`}
                      </text>
                    </g>
                  );
                })}
                {/* Bars */}
                {chartData.map((point, i) => {
                  const x = 35 + i * ((chartWidth - 70) / Math.max(chartData.length - 1, 1));
                  const barHeight = ((point.price - minPrice) / priceRange) * chartHeight;
                  const y = 10 + chartHeight - barHeight;
                  const color = point.changeType === 'decrease' ? '#22c55e' : point.changeType === 'increase' ? '#ef4444' : '#3b82f6';
                  return (
                    <g key={i}>
                      <rect
                        x={x - barWidth / 2}
                        y={y}
                        width={barWidth}
                        height={Math.max(barHeight, 2)}
                        rx={3}
                        fill={color}
                        opacity={0.85}
                      />
                      {chartData.length <= 12 && (
                        <text
                          x={x}
                          y={chartHeight + 22}
                          textAnchor="middle"
                          fill="#94a3b8"
                          fontSize="8"
                          transform={`rotate(-30, ${x}, ${chartHeight + 22})`}
                        >
                          {formatDate(point.date)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {selectedPhone && chartData.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-sm text-gray-400">
            No price history available for this phone.
          </div>
        )}

        {/* History Table */}
        {selectedPhone && priceHistory.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">All Price Changes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-50">
                    <th className="text-left px-4 py-2.5 font-medium">Date</th>
                    <th className="text-right px-4 py-2.5 font-medium">Old Price</th>
                    <th className="text-right px-4 py-2.5 font-medium">New Price</th>
                    <th className="text-right px-4 py-2.5 font-medium">Change</th>
                    <th className="text-right px-4 py-2.5 font-medium">%</th>
                    <th className="text-left px-4 py-2.5 font-medium">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium">Variant</th><th className="text-left px-4 py-2.5 font-medium">Source</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {priceHistory.map((h) => (
                    <tr key={h.id} className="text-sm hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-xs text-gray-500">{formatDateTime(h.date)}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-right">{formatMoney(h.oldPrice, h.currency)}</td>
                      <td className="px-4 py-2.5 text-gray-900 font-medium text-right">{formatMoney(h.newPrice, h.currency)}</td>
                      <td className={`px-4 py-2.5 text-right ${h.changeType === 'decrease' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatDiff(h.difference)}
                      </td>
                      <td className={`px-4 py-2.5 text-right ${h.changeType === 'decrease' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentChange(h.percentChange)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={h.changeType === 'decrease' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {h.changeType}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-blue-600">{variantLabel(h) || "Base"}</td><td className="px-4 py-2.5 text-xs text-gray-500">{h.source}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={
                          h.status === 'approved' ? 'bg-green-100 text-green-700' :
                          h.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {h.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!selectedPhone && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Select a phone above to view its price history.</p>
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     TAB 7: SETTINGS
     ═══════════════════════════════════════════════════════════ */

  const renderSettings = () => (
    <div className="space-y-4">
      {/* Threshold Configuration */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Threshold Configuration</h3>
            <p className="text-xs text-gray-500 mt-0.5">Controls how automatic price changes are processed.</p>
          </div>
          {settingsSaved && (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/50">Saved</span>
          )}
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Auto-approve threshold (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={settings.autoApproveThreshold}
                onChange={e => setSettings(s => ({ ...s, autoApproveThreshold: Number(e.target.value) || 0 }))}
                className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
              <p className="text-xs text-gray-400 mt-1">Changes within this % are auto-approved silently</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Review threshold (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={settings.reviewThreshold}
                onChange={e => setSettings(s => ({ ...s, reviewThreshold: Number(e.target.value) || 0 }))}
                className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
              <p className="text-xs text-gray-400 mt-1">Changes above this % are flagged for mandatory review</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Batch size</label>
              <input
                type="number"
                min={1}
                max={100}
                value={settings.batchSize}
                onChange={e => setSettings(s => ({ ...s, batchSize: Number(e.target.value) || 10 }))}
                className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
              <p className="text-xs text-gray-400 mt-1">Number of phones checked per batch run</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Check frequency</label>
              <select
                value={settings.checkFrequency}
                onChange={e => setSettings(s => ({ ...s, checkFrequency: e.target.value }))}
                className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              >
                <option value="hourly">Hourly</option>
                <option value="twice-daily">Twice Daily</option>
                <option value="daily">Daily</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">How often prices are checked from all sources</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={saveSettings}
            disabled={settingsSaving || settings.autoApproveThreshold >= settings.reviewThreshold}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {settingsSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {settingsSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
        {settings.autoApproveThreshold >= settings.reviewThreshold && (
          <p className="mt-2 text-xs text-red-500">Auto-approve threshold must be less than review threshold.</p>
        )}
      </div>

      {/* Cron Configuration */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Cron Job</h3>
        <p className="text-xs text-gray-500 mb-4">Configure your server cron to trigger automatic price updates.</p>
        <div className="space-y-3">
          <div className="p-3 bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between">
              <code className="text-sm text-green-400 font-mono">/api/cron/update-prices</code>
              <button
                onClick={() => navigator.clipboard?.writeText('/api/cron/update-prices')}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 font-medium mb-1">Example crontab (daily at 6 AM PKT):</p>
            <code className="text-xs text-gray-800 font-mono">0 1 * * * curl -s -H &quot;x-cron-secret: $CRON_SECRET&quot; https://your-domain.com/api/cron/update-prices</code>
          </div>
        </div>
        <div className={`mt-3 flex items-start gap-2 rounded-lg border p-3 ${cronConfigured ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          {cronConfigured ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
          <div className="flex-1">
            <p className={`text-xs font-semibold ${cronConfigured ? 'text-emerald-800' : 'text-amber-800'}`}>
              {cronConfigured ? 'CRON_SECRET configured' : 'CRON_SECRET required'}
            </p>
            <p className={`mt-0.5 text-xs ${cronConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
              {cronConfigured
                ? `Protected price-sync endpoint is ready. Current schedule: ${cronSchedule}.`
                : 'Add CRON_SECRET in Vercel Environment Variables, then redeploy. The secret value is never exposed here.'}
            </p>
          </div>
          <button
            type="button"
            onClick={runPriceSync}
            disabled={!cronConfigured || actionLoading === 'run-sync'}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${actionLoading === 'run-sync' ? 'animate-spin' : ''}`} />
            {actionLoading === 'run-sync' ? 'Running…' : 'Run now'}
          </button>
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     MODALS
     ═══════════════════════════════════════════════════════════ */

  const renderEditPriceModal = () => {
    if (!editPriceModal || !editingPhone) return null;
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-4">
        <div className="mx-auto my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
            <h2 className="text-sm font-bold text-gray-900">Price Control</h2>
            <button onClick={() => setEditPriceModal(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-900">{editingPhone.phoneName} — Current public: {formatPKR(editingPhone.currentPrice)}</p>
            <p className="mt-1 text-[11px] leading-5 text-blue-700">Admin override has final authority for the exact market + PTA class + RAM + storage + color variant. Saving the same identity updates it; it does not create a duplicate.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">New Price ({editForm.currency}) *</label>
              <input
                type="number"
                required
                min={0}
                value={editForm.price}
                onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                placeholder="Enter new price"
                className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><label className="text-xs text-gray-500 font-medium mb-1 block">Regular Price</label><input type="number" value={editForm.regularPrice} onChange={e => setEditForm(f => ({ ...f, regularPrice: e.target.value }))} placeholder="Before discount" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm" /></div>
              <div><label className="text-xs text-gray-500 font-medium mb-1 block">Discount Starts</label><input type="date" value={editForm.discountStartAt} onChange={e => setEditForm(f => ({ ...f, discountStartAt: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm" /></div>
              <div><label className="text-xs text-gray-500 font-medium mb-1 block">Discount Ends</label><input type="date" value={editForm.discountEndAt} onChange={e => setEditForm(f => ({ ...f, discountEndAt: e.target.value }))} className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm" /></div>
            </div>
            {Number(editForm.regularPrice || 0) > Number(editForm.price || 0) && Number(editForm.price || 0) > 0 ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Discount: {Math.round(((Number(editForm.regularPrice) - Number(editForm.price)) / Number(editForm.regularPrice)) * 100)}% · Save {formatMoney(Number(editForm.regularPrice) - Number(editForm.price), editForm.currency)}</div> : null}
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Reason</label>
              <input
                type="text"
                value={editForm.reason}
                onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. New market price, PTA approved variant"
                className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500 font-medium mb-1 block">Market</label><select value={editForm.market} onChange={e => { const market = e.target.value as 'PK' | 'US'; setEditForm(f => ({ ...f, market, currency: market === 'US' ? 'USD' : 'PKR', priceType: market === 'US' ? 'us-retail' : 'pta-approved', ptaStatus: market === 'US' ? '' : 'PTA Approved' })); }} className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm bg-white"><option value="PK">Pakistan</option><option value="US">USA</option></select></div>
              <div><label className="text-xs text-gray-500 font-medium mb-1 block">Price Type</label><select value={editForm.priceType} onChange={e => { const priceType = e.target.value as 'pta-approved' | 'non-pta' | 'us-retail'; setEditForm(f => ({ ...f, priceType, ptaStatus: priceType === 'pta-approved' ? 'PTA Approved' : priceType === 'non-pta' ? 'Non-PTA' : '' })); }} className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm bg-white">{editForm.market === 'US' ? <option value="us-retail">USA Retail</option> : <><option value="pta-approved">PTA Approved</option><option value="non-pta">Non-PTA</option></>}</select></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><label className="text-xs text-gray-500 font-medium mb-1 block">RAM</label><input value={editForm.ram} onChange={e => setEditForm(f => ({ ...f, ram: e.target.value }))} placeholder="12GB" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm" /></div>
              <div><label className="text-xs text-gray-500 font-medium mb-1 block">Storage</label><input value={editForm.storage} onChange={e => setEditForm(f => ({ ...f, storage: e.target.value }))} placeholder="256GB" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm" /></div>
              <div><label className="text-xs text-gray-500 font-medium mb-1 block">Color</label><input value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} placeholder="Black" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm" /></div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Condition</label>
              <select value={editForm.condition} onChange={e => setEditForm(f => ({ ...f, condition: e.target.value }))} className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm bg-white"><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option><option value="open-box">Open Box</option></select>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <input type="checkbox" checked={editForm.lockOverride} onChange={e => setEditForm(f => ({ ...f, lockOverride: e.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
              <span><span className="block text-xs font-semibold text-amber-900">Lock this exact manual price</span><span className="mt-0.5 block text-[11px] leading-4 text-amber-700">Recommended when correcting a wrong automatic price. Auto sync may keep recording retailer prices, but cannot replace this public variant price until Reset to Auto is used.</span></span>
            </label>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Warranty Type</label>
              <select
                value={editForm.warrantyType}
                onChange={e => setEditForm(f => ({ ...f, warrantyType: e.target.value }))}
                className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              >
                <option value="">No Change</option>
                <option value="official">Official Warranty</option>
                <option value="shop">Shop Warranty</option>
                <option value="none">No Warranty</option>
              </select>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-gray-800">Existing price controls</span><span className="text-[10px] text-gray-500">{priceControlRows.manual.length} manual • {priceControlRows.automatic.length} auto</span></div>
            {priceControlLoading ? <div className="py-3 text-center text-xs text-gray-500">Loading price identities…</div> : (priceControlRows.manual.length === 0 && priceControlRows.automatic.length === 0) ? <div className="py-3 text-center text-xs text-gray-500">No existing price records yet.</div> : <div className="max-h-36 space-y-1.5 overflow-y-auto">
              {priceControlRows.manual.slice(0, 8).map((row, i) => <button type="button" key={`m-${row.id || i}`} onClick={() => setEditForm(f => ({ ...f, price: String(row.price || ''), regularPrice: String(row.regularPrice || ''), discountStartAt: row.discountStartAt ? String(row.discountStartAt).slice(0,10) : '', discountEndAt: row.discountEndAt ? String(row.discountEndAt).slice(0,10) : '', market: row.market === 'US' ? 'US' : 'PK', currency: row.currency === 'USD' ? 'USD' : 'PKR', priceType: row.priceType || 'pta-approved', ptaStatus: row.ptaStatus || '', ram: row.ram || '', storage: row.storage || '', color: row.color || '', condition: row.condition || 'new', warrantyType: row.warrantyType || '', reason: row.reason || '', lockOverride: row.locked !== false }))} className="flex w-full items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-2 text-left hover:bg-amber-100"><span className="text-[11px] text-amber-900"><b>MANUAL{row.locked ? ' • LOCKED' : ''}</b> · {row.market}/{row.priceType} · {[row.ram,row.storage,row.color].filter(Boolean).join(' / ') || 'base'}</span><span className="text-[11px] font-bold text-amber-900">{row.currency} {Number(row.price || 0).toLocaleString()}</span></button>)}
              {priceControlRows.automatic.slice(0, 8).map((row, i) => <div key={`a-${row.id || i}`} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-2.5 py-2"><span className="text-[11px] text-gray-600"><b>AUTO</b> · {row.source || 'source'} · {row.market}/{row.priceType} · {[row.ram,row.storage,row.color].filter(Boolean).join(' / ') || 'base'}</span><span className="text-[11px] font-semibold text-gray-800">{row.currency} {Number(row.price || 0).toLocaleString()}</span></div>)}
            </div>}
            <p className="mt-2 text-[10px] leading-4 text-gray-500">Click an existing manual row to edit that exact identity. Saving uses upsert, so the same variant is updated instead of duplicated.</p>
          </div>

          </div>
          <div className="grid shrink-0 grid-cols-1 gap-2 border-t border-gray-100 bg-white px-6 py-4 sm:grid-cols-3">
            <button onClick={() => { setEditPriceModal(false); setEditingPhone(null); }} className="h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={handleResetOverride} disabled={actionLoading === 'reset-override'} className="h-10 rounded-xl border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50">{actionLoading === 'reset-override' ? 'Resetting...' : 'Reset to Auto'}</button>
            <button onClick={handleUpdatePrice} disabled={actionLoading === 'update-price' || !editForm.price} className="h-10 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{actionLoading === 'update-price' ? 'Saving...' : (editForm.lockOverride ? 'Save & Lock' : 'Save Override')}</button>
          </div>
        </div>
      </div>
    );
  };

  const renderAddListingModal = () => {
    if (!addListingModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Add Listing</h2>
            <button onClick={() => setAddListingModal(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            {selectedPhoneName || 'Phone'} — Add a price listing from a source
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Source *</label>
              <select
                value={listingForm.source}
                onChange={e => setListingForm(f => ({ ...f, source: e.target.value }))}
                className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              >
                <option value="">Select a source</option>
                {sources.filter(s => s.status === 'active').map(s => (
                  <option key={s.id} value={s.id}>{s.name} · {s.market === 'US' ? 'USA/USD' : `PK/${s.defaultPriceType === 'non-pta' ? 'Non-PTA' : 'PTA'}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Product URL *</label>
              <input
                type="url"
                value={listingForm.url}
                onChange={e => setListingForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://www.example.com/phone-123"
                className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1 block">RAM</label>
                <input
                  type="text"
                  value={listingForm.ram}
                  onChange={e => setListingForm(f => ({ ...f, ram: e.target.value }))}
                  placeholder="e.g. 8GB"
                  className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1 block">Storage</label>
                <input
                  type="text"
                  value={listingForm.storage}
                  onChange={e => setListingForm(f => ({ ...f, storage: e.target.value }))}
                  placeholder="e.g. 256GB"
                  className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1 block">Color</label>
                <input type="text" value={listingForm.color} onChange={e => setListingForm(f => ({ ...f, color: e.target.value }))} placeholder="e.g. Titanium Black" className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1 block">Condition</label>
                <select value={listingForm.condition} onChange={e => setListingForm(f => ({ ...f, condition: e.target.value }))} className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white">
                  <option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option><option value="open-box">Open Box</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1 block">{sources.find(s => s.id === listingForm.source)?.market === 'US' ? 'Market Price Type' : 'PTA Status'}</label>
                <select
                  value={sources.find(s => s.id === listingForm.source)?.market === 'US' ? '' : listingForm.ptaStatus}
                  disabled={sources.find(s => s.id === listingForm.source)?.market === 'US'}
                  onChange={e => setListingForm(f => ({ ...f, ptaStatus: e.target.value }))}
                  className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
                >
                  <option value="">{sources.find(s => s.id === listingForm.source)?.market === 'US' ? 'USA Retail (USD)' : 'Select'}</option>
                  <option value="approved">PTA Approved</option>
                  <option value="non-pta">Non-PTA</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1 block">Warranty Type</label>
                <select
                  value={listingForm.warrantyType}
                  onChange={e => setListingForm(f => ({ ...f, warrantyType: e.target.value }))}
                  className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
                >
                  <option value="">Select</option>
                  <option value="official">Official</option>
                  <option value="shop">Shop</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => { setAddListingModal(false); setListingPhoneId(''); setError(''); }}
              className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddListing}
              disabled={actionLoading === 'add-listing' || !listingForm.url || !listingForm.source}
              className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === 'add-listing' ? 'Saving...' : 'Add Listing'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEditSourceModal = () => {
    if (!editingSource) return null;
    return (
      <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/50 p-4">
        <div className="mx-auto my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Edit price source</h2>
              <p className="mt-1 text-xs text-slate-500">Update retailer identity, domains, trust and availability.</p>
            </div>
            <button
              type="button"
              onClick={() => { setEditingSource(null); setError(''); }}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close edit source"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Source name *</label>
              <input
                value={editSourceForm.name}
                onChange={event => {
                  const name = event.currentTarget.value;
                  setEditSourceForm(current => ({ ...current, name }));
                }}
                className={`h-10 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 ${editSourceFieldErrors.name ? 'border-red-300 focus:border-red-400 focus:ring-red-500/20' : 'border-slate-200 focus:border-blue-400 focus:ring-blue-500/20'}`}
              />
              {editSourceFieldErrors.name && <p className="mt-1 text-[11px] text-red-600">{editSourceFieldErrors.name}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Source type</label>
              <select
                value={editSourceForm.type}
                onChange={event => {
                  const type = normalizePriceSourceType(event.currentTarget.value);
                  setEditSourceForm(current => ({ ...current, type }));
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              >
                {SOURCE_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                {SOURCE_TYPES.find(type => type.value === editSourceForm.type)?.description}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Market</label>
              <select value={editSourceForm.market} onChange={event => { const market = event.currentTarget.value as 'PK' | 'US'; setEditSourceForm(current => ({ ...current, market, currency: market === 'US' ? 'USD' : 'PKR', defaultPriceType: market === 'US' ? 'us-retail' : (current.defaultPriceType === 'us-retail' ? 'pta-approved' : current.defaultPriceType) })); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="PK">Pakistan</option><option value="US">USA</option></select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Price bucket / currency</label>
              <select value={editSourceForm.defaultPriceType} onChange={event => setEditSourceForm(current => ({ ...current, defaultPriceType: event.currentTarget.value as typeof current.defaultPriceType }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                {editSourceForm.market === 'US' ? <option value="us-retail">USA Retail · USD</option> : <><option value="pta-approved">Pakistan PTA · PKR</option><option value="non-pta">Pakistan Non-PTA · PKR</option><option value="unknown">Classify per listing · PKR</option></>}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">HTTPS base URL {editSourceForm.type === 'manual' ? '(optional)' : '*'}</label>
              <input
                type="url"
                value={editSourceForm.baseUrl}
                onChange={event => {
                  const baseUrl = event.currentTarget.value;
                  setEditSourceForm(current => ({ ...current, baseUrl }));
                }}
                placeholder="https://www.example.com"
                className={`h-10 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 ${editSourceFieldErrors.baseUrl ? 'border-red-300 focus:border-red-400 focus:ring-red-500/20' : 'border-slate-200 focus:border-blue-400 focus:ring-blue-500/20'}`}
              />
              {editSourceFieldErrors.baseUrl && <p className="mt-1 text-[11px] text-red-600">{editSourceFieldErrors.baseUrl}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Verification product URL <span className="font-normal text-slate-400">(optional test only)</span></label>
              <input
                type="url"
                value={editSourceForm.verificationUrl}
                onChange={event => {
                  const verificationUrl = event.currentTarget.value;
                  setEditSourceForm(current => ({ ...current, verificationUrl }));
                }}
                placeholder="https://retailer.example/phones/real-phone-product-page"
                className={`h-10 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 ${editSourceFieldErrors.verificationUrl ? 'border-red-300 focus:border-red-400 focus:ring-red-500/20' : 'border-slate-200 focus:border-blue-400 focus:ring-blue-500/20'}`}
              />
              {editSourceFieldErrors.verificationUrl ? <p className="mt-1 text-[11px] font-medium text-red-600">{editSourceFieldErrors.verificationUrl}</p> : <p className="mt-1 text-[11px] text-slate-400">Optional: use one real product page only to test extraction. Catalog discovery below handles multiple phones automatically.</p>}
            </div>
            <div className="sm:col-span-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-sm font-bold text-slate-900">Automatic catalog discovery</p><p className="mt-1 text-xs leading-5 text-slate-600">Configure the provider once. Product URLs can then be discovered from catalog, sitemap, feed or API sources instead of entering every phone manually.</p></div>
                <label className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={editSourceForm.discoveryEnabled} onChange={event => {
                  const discoveryEnabled = event.currentTarget.checked;
                  setEditSourceForm(current => ({ ...current, discoveryEnabled }));
                }} className="h-4 w-4 rounded border-slate-300"/>Enabled</label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Discovery mode</span><select value={editSourceForm.discoveryMode} onChange={event => {
                  const discoveryMode = event.currentTarget.value as 'manual' | 'sitemap' | 'catalog' | 'feed' | 'api';
                  setEditSourceForm(current => ({ ...current, discoveryMode }));
                }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="manual">Manual links</option><option value="catalog">Catalog pages</option><option value="sitemap">XML sitemap</option><option value="feed">Product feed</option><option value="api">Provider API</option></select></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Sync frequency</span><select value={editSourceForm.syncFrequency} onChange={event => {
                  const syncFrequency = event.currentTarget.value as 'manual' | 'hourly' | 'daily' | 'weekly';
                  setEditSourceForm(current => ({ ...current, syncFrequency }));
                }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="manual">Manual</option><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
                <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-slate-600">Catalog URLs</span><textarea rows={2} value={editSourceForm.catalogUrls} onChange={event => {
                  const catalogUrls = event.currentTarget.value;
                  setEditSourceForm(current => ({ ...current, catalogUrls }));
                }} placeholder="One catalog/category URL per line" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"/></label>
                <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-slate-600">Sitemap URLs</span><textarea rows={2} value={editSourceForm.sitemapUrls} onChange={event => {
                  const sitemapUrls = event.currentTarget.value;
                  setEditSourceForm(current => ({ ...current, sitemapUrls }));
                }} placeholder="https://example.com/product-sitemap.xml" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"/></label>
                <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-slate-600">Feed or API URL</span><input type="url" value={editSourceForm.feedUrl} onChange={event => {
                  const feedUrl = event.currentTarget.value;
                  setEditSourceForm(current => ({ ...current, feedUrl }));
                }} placeholder="https://example.com/products.json" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"/></label>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Allowed domains</label>
              <input
                value={editSourceForm.allowedDomains}
                onChange={event => {
                  const allowedDomains = event.currentTarget.value;
                  setEditSourceForm(current => ({ ...current, allowedDomains }));
                }}
                placeholder="priceoye.pk, example.com (comma-separated)"
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-1 text-[11px] text-slate-400">Use hostnames only. Protocol and www are cleaned automatically.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Priority</label>
              <input
                type="number"
                min={0}
                max={100}
                value={editSourceForm.priority}
                onChange={event => {
                  const priority = Number(event.currentTarget.value);
                  setEditSourceForm(current => ({ ...current, priority }));
                }}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Status</label>
              <select
                value={editSourceForm.status}
                onChange={event => {
                  const status = event.currentTarget.value as 'active' | 'paused' | 'failed';
                  setEditSourceForm(current => ({ ...current, status }));
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={editSourceForm.trusted}
                onChange={event => {
                  const trusted = event.currentTarget.checked;
                  setEditSourceForm(current => ({ ...current, trusted }));
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">Trusted source</span>
                <span className="block text-xs text-slate-500">Only enable after testing a real product page and confirming reliable price extraction in this source's configured currency.</span>
              </span>
            </label>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Internal notes</label>
              <textarea
                rows={3}
                maxLength={1000}
                value={editSourceForm.notes}
                onChange={event => {
                  const notes = event.currentTarget.value;
                  setEditSourceForm(current => ({ ...current, notes }));
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                placeholder="Access policy, contact, feed details or known limitations"
              />
            </div>
          </div>

          {error && <div className="mx-6 mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
            <button
              type="button"
              onClick={() => { setEditingSource(null); setError(''); }}
              className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateSource}
              disabled={!editSourceForm.name.trim() || !editSourceForm.baseUrl.trim() || actionLoading === `edit-${editingSource.id}`}
              className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading === `edit-${editingSource.id}` ? 'Saving...' : 'Save source'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSourceTestModal = () => {
    if (!sourceTestModal) return null;
    const testing = actionLoading === `test-${sourceTestModal.id}`;
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-base font-bold text-slate-900">Test & trust {sourceTestModal.name}</h2><p className="mt-1 text-xs text-slate-500">Verify one real product page and preview the detected price in this source's configured currency.</p></div>
            <button onClick={() => { setSourceTestModal(null); setSourceTestResult(null); setError(''); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          <label className="mt-5 mb-1 block text-xs font-semibold text-slate-600">Real phone product URL *</label>
          <input type="url" value={sourceTestUrl} onChange={e => setSourceTestUrl(e.currentTarget.value)} placeholder="https://priceoye.pk/mobiles/brand-phone-model" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20" />
          {sourceTestResult && <div className={`mt-4 rounded-xl border p-4 ${sourceTestResult.safeToEnable ? 'border-emerald-200 bg-emerald-50' : sourceTestResult.failureType === 'challenge' || sourceTestResult.failureType === 'rate_limit' ? 'border-violet-200 bg-violet-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <span>Reachable</span><strong>{sourceTestResult.reachable ? 'Yes' : 'No'}</strong>
              <span>HTTP status</span><strong>{sourceTestResult.httpStatus ?? '—'}</strong>
              <span>Page title</span><strong className="truncate">{sourceTestResult.title || 'Not detected'}</strong>
              <span>Detected price</span><strong>{sourceTestResult.detectedPrice ? formatMoney(sourceTestResult.detectedPrice, sourceTestResult.currency || sourceTestModal.currency) : 'Not detected'}</strong>
              <span>Availability</span><strong>{sourceTestResult.availability}</strong>
              <span>Method</span><strong>{sourceTestResult.extractionMethod || 'None'}</strong>
              <span>Confidence</span><strong>{Math.round(Math.max(0, Math.min(1, sourceTestResult.extractionConfidence || 0)) * 100)}%</strong>
              <span>Failure type</span><strong className="capitalize">{sourceTestResult.failureType || 'none'}</strong>
              <span>Fetch time</span><strong>{sourceTestResult.fetchDurationMs ? `${sourceTestResult.fetchDurationMs} ms` : '—'}</strong>
            </div>
            {sourceTestResult.finalUrl && <p className="mt-3 break-all text-[11px] text-slate-600"><strong>Final URL:</strong> {sourceTestResult.finalUrl}</p>}
            {sourceTestResult.responsePreview && <details className="mt-3 rounded-lg border border-current/20 bg-white/60 p-2 text-[11px]"><summary className="cursor-pointer font-semibold">Response preview</summary><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px]">{sourceTestResult.responsePreview}</pre></details>}
            {sourceTestResult.safeToEnable ? (
              <p className="mt-3 text-xs font-semibold text-emerald-800">Reliable {sourceTestResult.currency || sourceTestModal.currency} price detected. This source is ready for automatic tracking.</p>
            ) : sourceTestResult.failureType === 'challenge' || sourceTestResult.failureType === 'rate_limit' ? (
              <div className="mt-3 rounded-lg border border-violet-200 bg-white/70 p-3 text-xs text-violet-900">
                <p className="font-semibold">Retailer blocks server-side automation.</p>
                <p className="mt-1">The URL may work in your browser, but Vercel cannot fetch it automatically. Automatic retries are disabled to save CPU. Use an official feed/API, another retailer, or a manually verified locked price.</p>
              </div>
            ) : sourceTestResult.error ? <p className="mt-3 text-xs font-medium text-amber-800">{sourceTestResult.error}</p> : null}
          </div>}
          {error && <div className="mx-6 mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4"><button onClick={() => { setSourceTestModal(null); setSourceTestResult(null); setError(''); }} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium">Cancel</button><button onClick={handleTestAndTrustSource} disabled={testing || !sourceTestUrl.trim()} className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-50">{testing ? 'Testing product page...' : sourceTestResult?.safeToEnable ? 'Retest source' : 'Test & trust'}</button></div>
        </div>
      </div>
    );
  };

  const renderDeleteSourceModal = () => {
    if (!deletingSource) return null;
    const hasListings = deletingSource.listingCount > 0;
    return (
      <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-100 p-2 text-red-600"><Trash2 className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Delete {deletingSource.name}?</h2>
              <p className="mt-1 text-sm text-slate-600">
                {hasListings
                  ? `This will permanently delete the source and all ${deletingSource.listingCount} linked retailer listing${deletingSource.listingCount === 1 ? '' : 's'}.`
                  : 'This source has no linked retailer listings and will be permanently removed.'}
              </p>
            </div>
          </div>

          {hasListings && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <label className="block text-xs font-semibold text-amber-900">Type <strong>{deletingSource.name}</strong> to confirm</label>
              <input
                value={deleteConfirmText}
                onChange={event => setDeleteConfirmText(event.target.value)}
                className="mt-2 h-10 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-red-500/20"
                autoFocus
              />
            </div>
          )}
          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setDeletingSource(null); setDeleteConfirmText(''); setError(''); }}
              className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteSource}
              disabled={actionLoading === `delete-${deletingSource.id}` || (hasListings && deleteConfirmText.trim() !== deletingSource.name)}
              className="h-10 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionLoading === `delete-${deletingSource.id}` ? 'Deleting...' : 'Delete permanently'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderListingReviewModal = () => {
    if (!reviewListing?.listingId) return null;
    const saving = actionLoading === `listing-${reviewListing.listingId}`;
    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Review retail listing</h2>
              <p className="mt-1 text-xs text-slate-500">{reviewListing.phoneName} · {reviewListing.source || 'Unknown source'}</p>
            </div>
            <button onClick={() => { setReviewListing(null); setActionError(''); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          {reviewListing.reason && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><strong>Why it needs review:</strong> {reviewListing.reason}</div>}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">RAM<input value={reviewListingForm.ram} onChange={e=>setReviewListingForm(f=>({...f,ram:e.target.value}))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="12GB" /></label>
            <label className="text-xs font-semibold text-slate-600">Storage<input value={reviewListingForm.storage} onChange={e=>setReviewListingForm(f=>({...f,storage:e.target.value}))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="256GB" /></label>
            <label className="text-xs font-semibold text-slate-600">Color<input value={reviewListingForm.color} onChange={e=>setReviewListingForm(f=>({...f,color:e.target.value}))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-600">Condition<select value={reviewListingForm.condition} onChange={e=>setReviewListingForm(f=>({...f,condition:e.target.value}))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option><option value="open-box">Open box</option></select></label>
            <label className="text-xs font-semibold text-slate-600">PTA status<select value={reviewListingForm.ptaStatus} onChange={e=>setReviewListingForm(f=>({...f,ptaStatus:e.target.value}))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="">Unknown / not set</option><option value="PTA Approved">PTA Approved</option><option value="Non-PTA">Non-PTA</option><option value="N/A">N/A (non-Pakistan)</option></select></label>
            <label className="text-xs font-semibold text-slate-600">Warranty<input value={reviewListingForm.warrantyType} onChange={e=>setReviewListingForm(f=>({...f,warrantyType:e.target.value}))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="Official / shop / none" /></label>
          </div>
          {reviewListing.sourceUrl && <a href={reviewListing.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-semibold text-blue-600 hover:underline">Verify against retailer page ↗</a>}
          {actionError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</div>}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button onClick={() => void saveListingReview(false)} disabled={saving} className="h-10 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Reject & disable</button>
            <button onClick={() => { setReviewListing(null); setActionError(''); }} disabled={saving} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700">Cancel</button>
            <button onClick={() => void saveListingReview(true)} disabled={saving} className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save & verify'}</button>
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <div>
      {renderHeader()}
      {renderTabs()}

      {error && !editPriceModal && !addListingModal && !editingSource && !deletingSource && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'phones' && renderPhones()}
      {activeTab === 'sources' && renderSources()}
      {activeTab === 'matches' && renderMatchCandidates()}
      {activeTab === 'changes' && renderChanges()}
      {activeTab === 'pending' && renderPending()}
      {activeTab === 'history' && renderHistory()}
      {activeTab === 'settings' && renderSettings()}

      {renderEditPriceModal()}
      {renderAddListingModal()}
      {renderEditSourceModal()}
      {renderSourceTestModal()}
      {renderDeleteSourceModal()}
      {renderListingReviewModal()}
    </div>
  );
}
