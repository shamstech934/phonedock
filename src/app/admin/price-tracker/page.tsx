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
}

interface PriceSource {
  id: string;
  name: string;
  type: PriceSourceType;
  status: 'active' | 'paused' | 'failed';
  trusted: boolean;
  priority: number;
  lastChecked: string | null;
  failures: number;
  baseUrl: string;
  verificationUrl: string;
  allowedDomains: string[];
  listingCount: number;
  enabledListings: number;
  verifiedListings: number;
  pendingListings: number;
  health: 'healthy' | 'setup' | 'paused' | 'attention' | 'no-listings';
  enabled: boolean;
  notes?: string;
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
  reason?: string;
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

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'phones', label: 'Phones', icon: Smartphone },
  { id: 'sources', label: 'Sources', icon: Globe },
  { id: 'matches', label: 'Source Gaps', icon: AlertTriangle },
  { id: 'changes', label: 'Price Changes', icon: Activity },
  { id: 'pending', label: 'Pending Review', icon: AlertCircle },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
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

function formatPKR(price: number): string {
  return `PKR ${price.toLocaleString('en-PK')}`;
}

function formatDiff(diff: number): string {
  const sign = diff > 0 ? '+' : '';
  return `${sign}PKR ${Math.abs(diff).toLocaleString('en-PK')}`;
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
  const [phonesTotal, setPhonesTotal] = useState(0);
  const [phonesPage, setPhonesPage] = useState(1);
  const [phonesSearch, setPhonesSearch] = useState('');
  const [phonesDebouncedSearch, setPhonesDebouncedSearch] = useState('');
  const [phonesModeFilter, setPhonesModeFilter] = useState('all');
  const [phonesSort, setPhonesSort] = useState('name-az');
  const searchTimer = useRef<NodeJS.Timeout>(undefined);

  // ── Sources Tab ──
  const [sources, setSources] = useState<PriceSource[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState<{ name: string; type: PriceSourceType; baseUrl: string; allowedDomains: string; priority: number }>({ name: '', type: 'retailer', baseUrl: '', allowedDomains: '', priority: 1 });
  const [editingSource, setEditingSource] = useState<PriceSource | null>(null);
  const [editSourceForm, setEditSourceForm] = useState<{ name: string; type: PriceSourceType; baseUrl: string; verificationUrl: string; allowedDomains: string; priority: number; status: 'active' | 'paused' | 'failed'; trusted: boolean; notes: string }>({ name: '', type: 'retailer', baseUrl: '', verificationUrl: '', allowedDomains: '', priority: 1, status: 'active', trusted: false, notes: '' });
  const [editSourceFieldErrors, setEditSourceFieldErrors] = useState<Record<string, string>>({});
  const [deletingSource, setDeletingSource] = useState<PriceSource | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([]);
  const [sourceTestModal, setSourceTestModal] = useState<PriceSource | null>(null);
  const [sourceTestUrl, setSourceTestUrl] = useState('');
  const [sourceTestResult, setSourceTestResult] = useState<{ reachable: boolean; title: string | null; detectedPrice: number | null; availability: string; matched: boolean; safeToEnable: boolean; extractionMethod: string | null; extractionConfidence: number; error: string | null } | null>(null);

  // ── Price Changes Tab ──
  const [changes, setChanges] = useState<PriceChange[]>([]);
  const [changesFilter, setChangesFilter] = useState('all');
  const [changesSourceType, setChangesSourceType] = useState('all');

  // ── Pending Tab ──
  const [pending, setPending] = useState<PriceChange[]>([]);

  // ── History Tab ──
  const [phoneOptions, setPhoneOptions] = useState<PhoneOption[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [selectedPhoneName, setSelectedPhoneName] = useState('');
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  // ── Modals ──
  const [editPriceModal, setEditPriceModal] = useState(false);
  const [editingPhone, setEditingPhone] = useState<PhonePrice | null>(null);
  const [editForm, setEditForm] = useState({ price: '', reason: '', ptaStatus: '', warrantyType: '' });

  const [addListingModal, setAddListingModal] = useState(false);
  const [listingPhoneId, setListingPhoneId] = useState('');
  const [listingForm, setListingForm] = useState({ source: '', url: '', ram: '', storage: '', ptaStatus: '', warrantyType: '' });

  // ── General ──
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    const body = await readApiResponse(response).catch(() => ({})) as { error?: string };
    return body.error || (response.status === 401 ? 'Authentication expired. Please sign in again.' : fallback);
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load price overview'); }
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load phones');
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
      })) as PriceSource[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load price sources'); }
  }, []);

  const fetchMatchCandidates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/price-tracker/match-queue?status=pending', { credentials: 'include' });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to load source gaps'));
      const data = await readApiResponse(res);
      setMatchCandidates(data.candidates || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load source gaps');
    }
  }, []);

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
      setPending(d.pending || d.data || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load pending price reviews'); }
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
      setActionMessage(`Sync batch complete: ${result.processed || 0} checked, ${result.updated || 0} updated, ${result.pending || 0} awaiting review, ${result.failed || 0} failed.${result.hasMore ? ' More eligible listings remain for the next run.' : ''}`);
      await fetchOverview();
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
      setActionMessage(`Catalog linked: ${result.linked} new, ${result.alreadyLinked} already ready, ${result.unmatched} need a supported retailer URL.`);
      await fetchOverview();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Automatic linking failed');
    } finally {
      setActionLoading('');
    }
  }, [fetchOverview]);

  // ── Load data on tab change ──
  useEffect(() => {
    switch (activeTab) {
      case 'overview': fetchOverview(); break;
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
          reason: editForm.reason,
          ptaStatus: editForm.ptaStatus,
          warrantyType: editForm.warrantyType,
        }),
      });
      const d = await readApiResponse(res);
      if (!res.ok) throw new Error(d.error || 'Failed to update price');
      setEditPriceModal(false);
      setEditForm({ price: '', reason: '', ptaStatus: '', warrantyType: '' });
      setEditingPhone(null);
      if (activeTab === 'phones') fetchPhones();
      else fetchOverview();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally { setActionLoading(''); }
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
          url: listingForm.url,
          ram: listingForm.ram,
          storage: listingForm.storage,
          ptaStatus: listingForm.ptaStatus,
          warrantyType: listingForm.warrantyType,
        }),
      });
      const d = await readApiResponse(res);
      if (!res.ok) throw new Error(d.error || 'Failed to add listing');
      setAddListingModal(false);
      setListingForm({ source: '', url: '', ram: '', storage: '', ptaStatus: '', warrantyType: '' });
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
          baseUrl: newSource.baseUrl,
          allowedDomains: newSource.allowedDomains.split(',').map(s => s.trim()).filter(Boolean),
          priority: newSource.priority,
        }),
      });
      const d = await readApiResponse(res);
      if (!res.ok) throw new Error(d.error || 'Failed to add source');
      setShowAddSource(false);
      setNewSource({ name: '', type: 'retailer', baseUrl: '', allowedDomains: '', priority: 1 });
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
      baseUrl: source.baseUrl || '',
      verificationUrl: source.verificationUrl || '',
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
          baseUrl: editSourceForm.baseUrl.trim(),
          verificationUrl,
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
      setActionMessage(`${source.name} verified at PKR ${Number(test.detectedPrice).toLocaleString('en-PK')} and marked trusted.`);
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

  const handleToggleTracking = async (phoneId: string) => {
    try {
      const res = await fetch(`/api/admin/price-tracker/phones/${phoneId}/toggle`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error(await responseError(res, 'Failed to update phone tracking'));
      fetchPhones();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to update phone tracking'); }
  };

  const openEditPriceModal = (phone: PhonePrice) => {
    setEditingPhone(phone);
    setEditForm({ price: String(phone.currentPrice), reason: '', ptaStatus: '', warrantyType: '' });
    setEditPriceModal(true);
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
        <h1 className="text-xl font-bold text-gray-900">Price Tracker</h1>
        <p className="text-sm text-gray-500 mt-0.5">Automatic multi-brand price checks, discounts and review safety</p>
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
    </div>
  );

  const renderTabs = () => (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-6 no-scrollbar">
      {TABS.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setError(''); }}
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
                  Review {s.pendingSourceGaps || 0} source gaps
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
                      <td className="px-5 py-3 text-gray-600">{formatPKR(c.oldPrice)}</td>
                      <td className="px-5 py-3 text-gray-900 font-medium">{formatPKR(c.newPrice)}</td>
                      <td className="px-5 py-3">
                        <span className={c.changeType === 'decrease' ? 'text-green-600' : 'text-red-600'}>
                          {formatDiff(c.difference)} ({c.changeType === 'decrease' ? '' : '+'}{c.percentChange.toFixed(1)}%)
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

    const manualCount = phones.filter(p => p.mode === 'manual').length;
    const autoCount = phones.filter(p => p.mode === 'automatic').length;

    return (
      <div>
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-sm font-bold text-gray-900">{phonesTotal}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">Manual</p>
            <p className="text-sm font-bold text-blue-600">{manualCount}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <p className="text-xs text-gray-500">Automatic</p>
            <p className="text-sm font-bold text-purple-600">{autoCount}</p>
          </div>
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

        {/* Table */}
        {phones.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-sm text-gray-400">
            No phones found. Start monitoring by adding phone listings.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium">Phone</th>
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
                        {p.percentChange !== 0 ? (
                          <span className={p.percentChange < 0 ? 'text-green-600' : 'text-red-600'}>
                            {p.percentChange < 0 ? '' : '+'}{p.percentChange.toFixed(1)}%
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={p.mode === 'manual' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                          {p.mode}
                        </Badge>
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
                          <button onClick={() => openEditPriceModal(p)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">Edit Price</button>
                          <button onClick={() => openViewHistory(p)} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">History</button>
                          <button
                            onClick={() => handleToggleTracking(p.phoneId)}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                            title={p.mode === 'automatic' ? 'Switch to manual' : 'Enable auto-tracking'}
                          >
                            {p.mode === 'automatic' ? <ToggleRight className="w-4 h-4 text-blue-500" /> : <ToggleLeft className="w-4 h-4" />}
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
                onChange={e => setNewSource(s => ({ ...s, name: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Type *</label>
              <select
                value={newSource.type}
                onChange={e => setNewSource(s => ({ ...s, type: normalizePriceSourceType(e.currentTarget.value) }))}
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
              <label className="text-xs text-gray-500 font-medium mb-1 block">Base URL {newSource.type === 'manual' ? '(optional)' : '*'}</label>
              <input
                type="text"
                placeholder="https://www.daraz.pk"
                value={newSource.baseUrl}
                onChange={e => setNewSource(s => ({ ...s, baseUrl: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Allowed Domains</label>
              <input
                type="text"
                placeholder="daraz.pk, mytech.pk (comma-separated)"
                value={newSource.allowedDomains}
                onChange={e => setNewSource(s => ({ ...s, allowedDomains: e.target.value }))}
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
                onChange={e => setNewSource(s => ({ ...s, priority: Number(e.target.value) }))}
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
              onClick={() => { setShowAddSource(false); setNewSource({ name: '', type: 'retailer', baseUrl: '', allowedDomains: '', priority: 1 }); }}
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
                            'font-medium text-amber-600'
                          }>
                            {src.type === 'manual' ? 'Manual source' :
                             src.type === 'rss_feed' ? 'Feed source' :
                             src.health === 'healthy' ? 'Ready' :
                             src.health === 'attention' ? 'Needs attention' :
                             src.health === 'setup' ? 'Test required' :
                             src.health === 'paused' ? 'Paused' : 'No verified links'}
                          </span>
                          <span className="text-gray-400">{src.verifiedListings}/{src.listingCount}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${src.health === 'healthy' ? 'bg-emerald-500' : 'bg-amber-400'}`}
                            style={{ width: `${src.listingCount > 0 ? Math.round((src.verifiedListings / src.listingCount) * 100) : 0}%` }}
                          />
                        </div>
                        {src.pendingListings > 0 && <p className="mt-1 text-[10px] text-amber-600">{src.pendingListings} pending review</p>}
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
        <p className="text-sm font-semibold text-blue-900">How this queue works</p>
        <p className="mt-1 text-xs leading-5 text-blue-700">
          Auto-link scans imported retailer URLs. Add and test the missing retailer in Sources, then run Auto-link again.
        </p>
      </div>
      {matchCandidates.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <CheckCircle className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-3 text-sm font-semibold text-gray-900">No unresolved source gaps</p>
          <p className="mt-1 text-xs text-gray-500">Run Auto-link catalog after importing phones to refresh this queue.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
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
      )}
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
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{c.phoneName}</td>
                    <td className="px-4 py-3 text-gray-500 text-right">{formatPKR(c.oldPrice)}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium text-right">{formatPKR(c.newPrice)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={c.changeType === 'decrease' ? 'text-green-600' : 'text-red-600'}>
                        {formatDiff(c.difference)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={c.changeType === 'decrease' ? 'text-green-600' : 'text-red-600'}>
                        {c.changeType === 'decrease' ? '' : '+'}{c.percentChange.toFixed(1)}%
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
          <p className="text-sm text-gray-500">All caught up! No pending price changes to review.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {pending.map((item) => (
          <div key={item.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{item.phoneName}</h3>
                  <Badge className="bg-yellow-100 text-yellow-700">pending</Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>Detected: <span className="font-medium text-gray-700">{formatPKR(item.newPrice)}</span></span>
                  <span>Current: <span className="font-medium text-gray-700">{formatPKR(item.oldPrice)}</span></span>
                  <span className={item.changeType === 'decrease' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                    {formatDiff(item.difference)} ({item.changeType === 'decrease' ? '' : '+'}{item.percentChange.toFixed(1)}%)
                  </span>
                  <span>Source: {item.source}</span>
                  <span>{formatDateTime(item.date)}</span>
                </div>
                {item.reason && (
                  <p className="text-xs text-gray-400 mt-1.5 italic">Reason: {item.reason}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
              </div>
            </div>
          </div>
        ))}
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
                    <th className="text-left px-4 py-2.5 font-medium">Source</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {priceHistory.map((h) => (
                    <tr key={h.id} className="text-sm hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-xs text-gray-500">{formatDateTime(h.date)}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-right">{formatPKR(h.oldPrice)}</td>
                      <td className="px-4 py-2.5 text-gray-900 font-medium text-right">{formatPKR(h.newPrice)}</td>
                      <td className={`px-4 py-2.5 text-right ${h.changeType === 'decrease' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatDiff(h.difference)}
                      </td>
                      <td className={`px-4 py-2.5 text-right ${h.changeType === 'decrease' ? 'text-green-600' : 'text-red-600'}`}>
                        {h.changeType === 'decrease' ? '' : '+'}{h.percentChange.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={h.changeType === 'decrease' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {h.changeType}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{h.source}</td>
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Edit Price</h2>
            <button onClick={() => setEditPriceModal(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            {editingPhone.phoneName} — Current: {formatPKR(editingPhone.currentPrice)}
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">New Price (PKR) *</label>
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
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">PTA Status</label>
              <select
                value={editForm.ptaStatus}
                onChange={e => setEditForm(f => ({ ...f, ptaStatus: e.target.value }))}
                className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
              >
                <option value="">No Change</option>
                <option value="approved">PTA Approved</option>
                <option value="non-pta">Non-PTA</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
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
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => { setEditPriceModal(false); setEditingPhone(null); }}
              className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdatePrice}
              disabled={actionLoading === 'update-price' || !editForm.price}
              className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === 'update-price' ? 'Saving...' : 'Save Price'}
            </button>
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
                  <option key={s.id} value={s.id}>{s.name}</option>
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
                <label className="text-xs text-gray-500 font-medium mb-1 block">PTA Status</label>
                <select
                  value={listingForm.ptaStatus}
                  onChange={e => setListingForm(f => ({ ...f, ptaStatus: e.target.value }))}
                  className="w-full h-10 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 bg-white"
                >
                  <option value="">Select</option>
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
              <label className="mb-1 block text-xs font-semibold text-slate-600">Verification product URL</label>
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
              {editSourceFieldErrors.verificationUrl ? <p className="mt-1 text-[11px] font-medium text-red-600">{editSourceFieldErrors.verificationUrl}</p> : <p className="mt-1 text-[11px] text-slate-400">Use a real phone product page, not a homepage or category URL. Test & trust will reuse this URL.</p>}
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
                <span className="block text-xs text-slate-500">Only enable after testing a real product page and confirming reliable PKR extraction.</span>
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
            <div><h2 className="text-base font-bold text-slate-900">Test & trust {sourceTestModal.name}</h2><p className="mt-1 text-xs text-slate-500">Verify one real product page and preview the detected PKR price.</p></div>
            <button onClick={() => { setSourceTestModal(null); setSourceTestResult(null); setError(''); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          <label className="mt-5 mb-1 block text-xs font-semibold text-slate-600">Real phone product URL *</label>
          <input type="url" value={sourceTestUrl} onChange={e => setSourceTestUrl(e.currentTarget.value)} placeholder="https://priceoye.pk/mobiles/brand-phone-model" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20" />
          {sourceTestResult && <div className={`mt-4 rounded-xl border p-4 ${sourceTestResult.safeToEnable ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="grid grid-cols-2 gap-3 text-xs"><span>Reachable</span><strong>{sourceTestResult.reachable ? 'Yes' : 'No'}</strong><span>Page title</span><strong className="truncate">{sourceTestResult.title || 'Not detected'}</strong><span>Detected price</span><strong>{sourceTestResult.detectedPrice ? formatPKR(sourceTestResult.detectedPrice) : 'Not detected'}</strong><span>Availability</span><strong>{sourceTestResult.availability}</strong><span>Method</span><strong>{sourceTestResult.extractionMethod || 'None'}</strong><span>Confidence</span><strong>{Math.round(Math.max(0, Math.min(1, sourceTestResult.extractionConfidence || 0)) * 100)}%</strong></div>
            {sourceTestResult.safeToEnable ? <p className="mt-3 text-xs font-semibold text-emerald-800">Reliable PKR price detected. This source is trusted and ready for tracking.</p> : sourceTestResult.error && <p className="mt-3 text-xs font-medium text-amber-800">{sourceTestResult.error}</p>}
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
    </div>
  );
}
