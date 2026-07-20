'use client';

import { Fragment, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Upload, FileText, CheckCircle, XCircle, AlertTriangle, Download,
  ArrowLeft, RefreshCw, Pause, Play, Eye, Trash2, AlertCircle,
  Database, Clock, Loader2, ChevronRight, Zap, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useAdmin } from '@/lib/useAdmin';
import { safePost, safeFetch } from '@/lib/import/safe-fetch';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['json', 'csv', 'xlsx', 'zip'];
const POLL_INTERVAL = 2000;
const MAX_CONCURRENCY = 2;
const STORAGE_KEY = 'import-v2-active-job';

type TabValue = 'upload' | 'preview' | 'settings' | 'progress' | 'history';
type DuplicateMode = 'skip' | 'update' | 'replace' | 'review';
type PublishMode = 'immediate' | 'review';
type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled' | 'rolled_back';
type BatchStatus = 'pending' | 'running' | 'completed' | 'failed';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FieldInfo {
  name: string;
  status: 'recognized' | 'ignored' | 'missing';
  sample?: string;
}

interface PreviewRecord {
  row: number;
  brand: string;
  model: string;
  pricePKR: string | number | null;
  specsCount: number;
  status: 'valid' | 'warning' | 'error';
  warnings: string[];
  errors: string[];
}

interface BatchInfo {
  batchNumber: number;
  status: BatchStatus;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

interface JobProgress {
  jobId: string;
  status: JobStatus;
  totalRecords: number;
  processedRecords: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  currentBatch: number;
  totalBatches: number;
  batches: BatchInfo[];
  startedAt?: string;
  completedAt?: string;
  errors?: string[];
}

interface HistoryEntry {
  id: string;
  date: string;
  fileName: string;
  status: JobStatus;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  duration: string;
  rollbackStatus?: string;
  errorSummary?: string;
  batches?: BatchInfo[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

function estimateTimeRemaining(processed: number, total: number, elapsedMs: number): string {
  if (processed === 0 || elapsedMs === 0) return 'calculating...';
  const remaining = total - processed;
  const msPerRecord = elapsedMs / processed;
  const etaMs = remaining * msPerRecord;
  return formatDuration(etaMs);
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'completed': return 'default' as const;
    case 'running': return 'default' as const;
    case 'failed': return 'destructive' as const;
    case 'cancelled': return 'secondary' as const;
    case 'paused': return 'secondary' as const;
    case 'pending': return 'outline' as const;
    default: return 'outline' as const;
  }
}

function batchStatusColor(status: BatchStatus): string {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700';
    case 'running': return 'bg-blue-100 text-blue-700';
    case 'failed': return 'bg-red-100 text-red-700';
    case 'pending': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function saveJobToStorage(job: JobProgress) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(job)); } catch {}
}

function loadJobFromStorage(): JobProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearJobStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function toUiStatus(status: unknown): JobStatus {
  switch (status) {
    case 'queued':
    case 'processing':
    case 'uploaded':
    case 'parsing':
    case 'validating':
    case 'ready':
      return status === 'ready' ? 'pending' : 'running';
    case 'paused': return 'paused';
    case 'completed': return 'completed';
    case 'completed_with_errors': return 'completed_with_errors';
    case 'failed': return 'failed';
    case 'cancelled': return 'cancelled';
    case 'rolled_back': return 'rolled_back';
    default: return 'pending';
  }
}

function normalizeFields(data: Record<string, unknown>): FieldInfo[] {
  const fields = data.fields;
  if (Array.isArray(fields)) return fields as FieldInfo[];
  const source = (fields && typeof fields === 'object' ? fields : data) as Record<string, unknown>;
  const result: FieldInfo[] = [];
  for (const name of (source.recognizedFields as string[] | undefined) || []) result.push({ name, status: 'recognized' });
  for (const name of (source.ignoredFields as string[] | undefined) || []) result.push({ name, status: 'ignored' });
  for (const name of (source.missingFields as string[] | undefined) || []) result.push({ name, status: 'missing' });
  return result;
}

function normalizePreview(records: unknown): PreviewRecord[] {
  if (!Array.isArray(records)) return [];
  return records.map((item, index) => {
    const row = (item || {}) as Record<string, unknown>;
    const normalized = (row.normalized || row.normalizedData || row) as Record<string, unknown>;
    const errors = Array.isArray(row.errors) ? row.errors.map(String) : [];
    const warnings = Array.isArray(row.warnings) ? row.warnings.map(String) : [];
    const specs = normalized.specs && typeof normalized.specs === 'object' ? normalized.specs as Record<string, unknown> : {};
    return {
      row: Number(row.row ?? row.rowNumber ?? index + 1),
      brand: String(normalized.brand || ''),
      model: String(normalized.model || normalized.modelName || ''),
      pricePKR: (normalized.pricePKR ?? normalized.price ?? null) as string | number | null,
      specsCount: Object.keys(specs).length,
      status: errors.length ? 'error' : warnings.length ? 'warning' : 'valid',
      warnings,
      errors,
    };
  });
}

function normalizeBatches(value: unknown): BatchInfo[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const batch = (item || {}) as Record<string, unknown>;
    const created = Number(batch.created || 0);
    const updated = Number(batch.updated || 0);
    const skipped = Number(batch.skipped || 0);
    const failed = Number(batch.failed || 0);
    const rawStatus = String(batch.status || 'pending');
    const status: BatchStatus = rawStatus === 'completed' ? 'completed' : rawStatus === 'failed' ? 'failed' : rawStatus === 'processing' || rawStatus === 'retrying' ? 'running' : 'pending';
    return {
      batchNumber: Number(batch.batchNumber || 0),
      status,
      total: Number(batch.total || created + updated + skipped + failed),
      created,
      updated,
      skipped,
      failed,
      startedAt: typeof batch.startedAt === 'string' ? batch.startedAt : undefined,
      completedAt: typeof batch.completedAt === 'string' ? batch.completedAt : undefined,
      durationMs: typeof batch.durationMs === 'number' ? batch.durationMs : undefined,
    };
  });
}

function normalizeJob(data: Record<string, unknown>, fallbackJobId: string): JobProgress {
  return {
    jobId: String(data.importId || data.jobId || data.id || fallbackJobId),
    status: toUiStatus(data.status),
    totalRecords: Number(data.totalRecords || 0),
    processedRecords: Number(data.processedRecords || 0),
    createdCount: Number(data.createdRecords ?? data.createdCount ?? 0),
    updatedCount: Number(data.updatedRecords ?? data.updatedCount ?? 0),
    skippedCount: Number(data.skippedRecords ?? data.skippedCount ?? 0),
    failedCount: Number(data.failedRecords ?? data.failedCount ?? 0),
    currentBatch: Number(data.currentBatch || 0),
    totalBatches: Number(data.totalBatches || 0),
    batches: normalizeBatches(data.batches),
    startedAt: typeof data.startedAt === 'string' ? data.startedAt : undefined,
    completedAt: typeof data.completedAt === 'string' ? data.completedAt : undefined,
  };
}

function normalizeHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const job = (item || {}) as Record<string, unknown>;
    const durationMs = typeof job.duration === 'number' ? job.duration : 0;
    return {
      id: String(job.importId || job.id || ''),
      date: String(job.startedAt || job.createdAt || ''),
      fileName: String(job.fileName || ''),
      status: toUiStatus(job.status),
      total: Number(job.totalRecords ?? job.total ?? 0),
      created: Number(job.createdRecords ?? job.created ?? 0),
      updated: Number(job.updatedRecords ?? job.updated ?? 0),
      skipped: Number(job.skippedRecords ?? job.skipped ?? 0),
      failed: Number(job.failedRecords ?? job.failed ?? 0),
      duration: durationMs > 0 ? formatDuration(durationMs) : '-',
      rollbackStatus: typeof job.rollbackStatus === 'string' ? job.rollbackStatus : undefined,
      errorSummary: typeof job.errorSummary === 'string' ? job.errorSummary : undefined,
      batches: normalizeBatches(job.batches),
    };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ImportV2Page() {
  useAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabValue) || 'upload';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload state ──────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // ── Job state ─────────────────────────────────────────────────────────
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);

  // ── Preview state ─────────────────────────────────────────────────────
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [previewRecords, setPreviewRecords] = useState<PreviewRecord[]>([]);
  const [duplicateEstimate, setDuplicateEstimate] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Settings state ────────────────────────────────────────────────────
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('skip');
  const [batchSize, setBatchSize] = useState(200);
  const [publishMode, setPublishMode] = useState<PublishMode>('immediate');
  const [createMissingBrands, setCreateMissingBrands] = useState(true);
  const [dryRun, setDryRun] = useState(false);

  // ── Progress state ────────────────────────────────────────────────────
  const [isPaused, setIsPaused] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningBatchesRef = useRef<Set<number>>(new Set());
  const nextBatchRef = useRef(0);
  const startTimeRef = useRef(0);
  const actionLockRef = useRef(false);

  // ── History state ─────────────────────────────────────────────────────
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // ── Dialog state ──────────────────────────────────────────────────────
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rollbackDialogId, setRollbackDialogId] = useState<string | null>(null);

  // ── Tab switching ─────────────────────────────────────────────────────
  const setActiveTab = useCallback((tab: TabValue) => {
    router.replace(`/admin/import-v2?tab=${tab}`, { scroll: false });
  }, [router]);

  // ── On mount: check localStorage for active job ───────────────────────
  useEffect(() => {
    const stored = loadJobFromStorage();
    if (stored && (stored.status === 'running' || stored.status === 'paused')) {
      setJobId(stored.jobId);
      setProgress(stored);
      if (stored.status === 'paused') {
        setIsPaused(true);
        nextBatchRef.current = stored.currentBatch + 1;
      } else {
        setIsRunning(true);
        nextBatchRef.current = stored.currentBatch + 1;
      }
      setActiveTab('progress');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch history when history tab is active ──────────────────────────
  useEffect(() => {
    if (activeTab !== 'history') return;
    setHistoryLoading(true);
    safeFetch<{ jobs?: unknown[] }>('/api/admin/import-v2/history')
      .then(res => {
        if (res.ok) setHistory(normalizeHistory(res.data?.jobs || []));
      })
      .finally(() => setHistoryLoading(false));
  }, [activeTab]);

  // ── Polling for progress ──────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'progress' || !jobId) return;
    pollRef.current = setInterval(async () => {
      const res = await safeFetch<Record<string, any>>(`/api/admin/import-v2/jobs/${jobId}`);
      if (res.ok && res.data) {
        const jobData = res.data;
        const normalized = normalizeJob(jobData, jobId);
        setProgress(() => {
          saveJobToStorage(normalized);
          return normalized;
        });
        if (normalized.status === 'completed') {
          setIsCompleted(true);
          setIsRunning(false);
          clearJobStorage();
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (normalized.status === 'failed' || normalized.status === 'cancelled' || normalized.status === 'rolled_back') {
          setIsRunning(false);
          clearJobStorage();
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeTab, jobId]);

  // ── File validation ───────────────────────────────────────────────────
  const validateFile = (f: File): string | null => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return 'Only JSON, CSV, XLSX, and ZIP files are supported.';
    }
    if (f.size > MAX_UPLOAD_SIZE) {
      return `File too large (${formatFileSize(f.size)}). Maximum is 10 MB.`;
    }
    if (f.size === 0) return 'File is empty.';
    return null;
  };

  // ── File handling ─────────────────────────────────────────────────────
  const handleFile = (f: File) => {
    const error = validateFile(f);
    if (error) { setUploadError(error); return; }
    setFile(f);
    setUploadError('');
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };
  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // ── Upload handler ────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file || actionLockRef.current) return;
    actionLockRef.current = true;
    setUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await safeFetch<Record<string, any>>(`/api/admin/import-v2/upload`, {
        method: 'POST',
        body: formData,
        // No Content-Type header -- browser sets multipart boundary
      });
      if (!res.ok) {
        setUploadError(res.error || 'Upload failed');
        return;
      }
      const data = res.data;
      const id = data?.jobId || data?.importId || data?.id;
      if (id) {
        setJobId(String(id));
        setFields(normalizeFields(data));
        setPreviewRecords(normalizePreview(data.firstRecords || data.preview));
        if (data.duplicateEstimate !== undefined) setDuplicateEstimate(Number(data.duplicateEstimate));
        setActiveTab('preview');
      }
    } finally {
      setUploading(false);
      actionLockRef.current = false;
    }
  };

  // ── Validate / refresh preview ────────────────────────────────────────
  const handleValidate = async () => {
    if (!jobId || actionLockRef.current) return;
    actionLockRef.current = true;
    setPreviewLoading(true);
    try {
      const res = await safePost<Record<string, any>>(`/api/admin/import-v2/jobs/${jobId}/validate`, {});
      if (res.ok && res.data) {
        setFields(normalizeFields(res.data));
        setPreviewRecords(normalizePreview(res.data.preview).slice(0, 20));
        if (res.data.duplicateEstimate !== undefined) setDuplicateEstimate(Number(res.data.duplicateEstimate));
      }
    } finally {
      setPreviewLoading(false);
      actionLockRef.current = false;
    }
  };

  // ── Save settings ─────────────────────────────────────────────────────
  const handleSaveSettings = async () => {
    if (!jobId || actionLockRef.current) return;
    actionLockRef.current = true;
    setActionLoading(true);
    try {
      const res = await safePost(`/api/admin/import-v2/jobs/${jobId}/config`, {
        duplicateMode,
        batchSize,
        publishMode,
        createMissingBrands,
        dryRun,
      });
      if (!res.ok) return; // error shown via alert below
      setActiveTab('progress');
    } finally {
      setActionLoading(false);
      actionLockRef.current = false;
    }
  };

  // ── Start import ──────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!jobId || actionLockRef.current) return;
    actionLockRef.current = true;
    setActionLoading(true);
    try {
      // Save settings first
      await safePost(`/api/admin/import-v2/jobs/${jobId}/config`, {
        duplicateMode,
        batchSize,
        publishMode,
        createMissingBrands,
        dryRun,
      });
      // Start the job
      const res = await safePost<Record<string, any>>(`/api/admin/import-v2/jobs/${jobId}/start`, {});
      if (!res.ok) return;

      const jobData = res.data;
      const totalBatches = Math.ceil((jobData?.totalRecords || 0) / batchSize);
      const initialProgress: JobProgress = {
        jobId,
        status: 'running',
        totalRecords: Number(jobData?.totalRecords || 0),
        processedRecords: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        currentBatch: 0,
        totalBatches,
        batches: Array.from({ length: totalBatches }, (_, i) => ({
          batchNumber: i + 1,
          status: 'pending' as BatchStatus,
          total: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
        })),
        startedAt: new Date().toISOString(),
      };
      setProgress(initialProgress);
      setIsRunning(true);
      setIsPaused(false);
      setIsCompleted(false);
      nextBatchRef.current = 1;
      startTimeRef.current = Date.now();
      saveJobToStorage(initialProgress);
    } finally {
      setActionLoading(false);
      actionLockRef.current = false;
    }
  };

  // ── Batch processing loop ─────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning || isPaused || !progress || !jobId) return;

    const sendNextBatch = async () => {
      if (isPaused || runningBatchesRef.current.size >= MAX_CONCURRENCY) return;
      const batchNum = nextBatchRef.current;
      if (batchNum > progress.totalBatches) return;

      nextBatchRef.current++;
      runningBatchesRef.current.add(batchNum);

      // Update batch status to running
      setProgress(prev => {
        if (!prev) return prev;
        const batches = [...prev.batches];
        const batchIndex = batchNum - 1;
        if (batches[batchIndex]) {
          batches[batchIndex] = { ...batches[batchIndex], status: 'running', startedAt: new Date().toISOString() };
        }
        return { ...prev, currentBatch: batchNum, batches };
      });

      try {
        const records: unknown[] = []; // Server will slice from job data
        const res = await safePost<Record<string, any>>(`/api/admin/import-v2/jobs/${jobId}/batches/${batchNum}`, { records });
        if (res.ok && res.data) {
          const batchResult = res.data;
          setProgress(prev => {
            if (!prev) return prev;
            const batches = [...prev.batches];
            const batchIndex = batchNum - 1;
            if (batches[batchIndex]) {
              batches[batchIndex] = {
                ...batches[batchIndex],
                status: 'completed',
                total: batchResult.total || 0,
                created: batchResult.created || 0,
                updated: batchResult.updated || 0,
                skipped: batchResult.skipped || 0,
                failed: batchResult.failed || 0,
                completedAt: new Date().toISOString(),
                durationMs: batchResult.durationMs || 0,
              };
            }
            const newProcessed = prev.processedRecords + (batchResult.total || 0);
            const allDone = batchNum >= prev.totalBatches && runningBatchesRef.current.size <= 1;
            return {
              ...prev,
              processedRecords: newProcessed,
              createdCount: prev.createdCount + (batchResult.created || 0),
              updatedCount: prev.updatedCount + (batchResult.updated || 0),
              skippedCount: prev.skippedCount + (batchResult.skipped || 0),
              failedCount: prev.failedCount + (batchResult.failed || 0),
              batches,
              status: allDone ? 'completed' : 'running',
              completedAt: allDone ? new Date().toISOString() : undefined,
            };
          });
        } else {
          setProgress(prev => {
            if (!prev) return prev;
            const batches = [...prev.batches];
            const batchIndex = batchNum - 1;
            if (batches[batchIndex]) {
              batches[batchIndex] = { ...batches[batchIndex], status: 'failed', completedAt: new Date().toISOString() };
            }
            return { ...prev, batches };
          });
        }
      } catch {
        setProgress(prev => {
          if (!prev) return prev;
          const batches = [...prev.batches];
          const batchIndex = batchNum - 1;
          if (batches[batchIndex]) {
            batches[batchIndex] = { ...batches[batchIndex], status: 'failed', completedAt: new Date().toISOString() };
          }
          return { ...prev, batches };
        });
      } finally {
        runningBatchesRef.current.delete(batchNum);
      }
    };

    const interval = setInterval(() => {
      if (!isPaused && runningBatchesRef.current.size < MAX_CONCURRENCY && nextBatchRef.current <= (progress?.totalBatches || 0)) {
        sendNextBatch();
      }
    }, 300);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, progress, jobId]);

  // Watch for completion
  useEffect(() => {
    if (progress?.status === 'completed' && isRunning) {
      setIsRunning(false);
      setIsCompleted(true);
      clearJobStorage();
    }
  }, [progress?.status, isRunning]);

  // ── Pause / Resume ────────────────────────────────────────────────────
  const handlePause = () => {
    setIsPaused(true);
    setProgress(prev => {
      if (!prev) return prev;
      const updated = { ...prev, status: 'paused' as JobStatus };
      saveJobToStorage(updated);
      return updated;
    });
  };

  const handleResume = () => {
    if (!progress) return;
    setIsPaused(false);
    setProgress(prev => {
      if (!prev) return prev;
      const updated = { ...prev, status: 'running' as JobStatus };
      saveJobToStorage(updated);
      return updated;
    });
  };

  // ── Cancel ────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!jobId || actionLockRef.current) return;
    actionLockRef.current = true;
    setActionLoading(true);
    try {
      await safePost(`/api/admin/import-v2/jobs/${jobId}/cancel`, {});
      setIsRunning(false);
      setIsPaused(false);
      clearJobStorage();
      setProgress(prev => prev ? { ...prev, status: 'cancelled' } : prev);
    } finally {
      setActionLoading(false);
      setCancelDialogOpen(false);
      actionLockRef.current = false;
    }
  };

  // ── Retry failed batches ──────────────────────────────────────────────
  const handleRetryFailed = async () => {
    if (!jobId || actionLockRef.current) return;
    actionLockRef.current = true;
    setActionLoading(true);
    try {
      const res = await safePost<Record<string, any>>(`/api/admin/import-v2/jobs/${jobId}/retry`, {});
      if (!res.ok && res.status !== 207) return;
      const refreshed = await safeFetch<Record<string, any>>(`/api/admin/import-v2/jobs/${jobId}`);
      if (refreshed.ok && refreshed.data) {
        const normalized = normalizeJob(refreshed.data, jobId);
        setProgress(normalized);
        if (normalized.status === 'completed') setIsCompleted(true);
      }
    } finally {
      setActionLoading(false);
      actionLockRef.current = false;
    }
  };

  // ── Rollback ──────────────────────────────────────────────────────────
  const handleRollback = async (id: string) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    try {
      const res = await safeFetch(`/api/admin/import-v2/jobs/${id}/rollback`, {
        method: 'POST',
        headers: { 'x-dry-run': 'false' },
      });
      if (res.ok) {
        setHistory(prev => prev.map(h => h.id === id ? { ...h, status: 'cancelled' } : h));
      }
    } finally {
      setRollbackDialogId(null);
      actionLockRef.current = false;
    }
  };

  // ── Download errors CSV ───────────────────────────────────────────────
  const handleDownloadErrors = () => {
    if (!jobId || !progress?.errors?.length) return;
    const csv = ['Row,Error'].concat(progress.errors.map((e, i) => `${i + 1},"${e.replace(/"/g, '""')}"`)).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${jobId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Download full errors from API ─────────────────────────────────────
  const handleDownloadErrorsFromServer = async () => {
    if (!jobId) return;
    const res = await safeFetch<{ errors?: string[] }>(`/api/admin/import-v2/jobs/${jobId}/errors`);
    if (res.ok && res.data) {
      const errors: string[] = res.data.errors || [];
      if (errors.length === 0) return;
      const csv = ['Row,Error'].concat(errors.map((e, i) => `${i + 1},"${e.replace(/"/g, '""')}"`)).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import-errors-${jobId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ── Reset everything ──────────────────────────────────────────────────
  const handleReset = () => {
    setFile(null);
    setJobId(null);
    setProgress(null);
    setFields([]);
    setPreviewRecords([]);
    setDuplicateEstimate(0);
    setIsPaused(false);
    setIsRunning(false);
    setIsCompleted(false);
    nextBatchRef.current = 1;
    runningBatchesRef.current.clear();
    clearJobStorage();
    if (pollRef.current) clearInterval(pollRef.current);
    setActiveTab('upload');
  };

  // ── Computed values ───────────────────────────────────────────────────
  const progressPercent = progress ? Math.min(100, Math.round((progress.processedRecords / Math.max(progress.totalRecords, 1)) * 100)) : 0;
  const elapsedMs = progress?.startedAt ? Date.now() - new Date(progress.startedAt).getTime() : 0;
  const eta = progress && progress.processedRecords > 0 ? estimateTimeRemaining(progress.processedRecords, progress.totalRecords, elapsedMs) : '';
  const failedBatches = progress?.batches.filter(b => b.status === 'failed').length || 0;

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Import Engine V2</h1>
            <p className="text-sm text-gray-500">Upload, preview, and import phone data in batches</p>
          </div>
          {jobId && (
            <Badge variant="outline" className="ml-auto text-xs font-mono">
              ID: {jobId.slice(0, 8)}...
            </Badge>
          )}
        </div>

        {/* Tab navigation - URL-based */}
        <div className="flex gap-1 border-b border-gray-200 pb-px overflow-x-auto">
          {([
            { key: 'upload' as TabValue, label: 'Upload', icon: Upload, disabled: false },
            { key: 'preview' as TabValue, label: 'Preview & Map', icon: Eye, disabled: !jobId },
            { key: 'settings' as TabValue, label: 'Settings', icon: FileText, disabled: !jobId },
            { key: 'progress' as TabValue, label: 'Progress', icon: Zap, disabled: !jobId && !progress },
            { key: 'history' as TabValue, label: 'History', icon: Clock, disabled: false },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => !tab.disabled && setActiveTab(tab.key)}
              disabled={tab.disabled}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : tab.disabled
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {uploadError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-3 py-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700 flex-1">{uploadError}</p>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setUploadError('')}>
                <XCircle className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* UPLOAD TAB                                                     */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upload File</CardTitle>
                <CardDescription>Drag and drop or click to select a file for import</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop zone */}
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-blue-400 bg-blue-50/60'
                      : file
                        ? 'border-green-300 bg-green-50/40'
                        : 'border-gray-300 bg-gray-50/50 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv,.xlsx,.zip"
                    className="hidden"
                    onChange={onFileInput}
                  />
                  {file ? (
                    <>
                      <FileText className="w-10 h-10 text-green-500" />
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatFileSize(file.size)} &middot; {file.type || 'unknown type'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-gray-400" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-700">
                          Drop file here or click to browse
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Maximum 10 MB</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Supported formats */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">Supported formats:</span>
                  {['JSON', 'CSV', 'XLSX', 'ZIP'].map(fmt => (
                    <Badge key={fmt} variant="secondary" className="text-xs">{fmt}</Badge>
                  ))}
                </div>

                {/* Upload button */}
                <Button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="bg-blue-500 hover:bg-blue-600 text-white w-full sm:w-auto"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload and Parse
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* PREVIEW TAB                                                    */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            {/* Field mapping stats */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Field Mapping</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleValidate} disabled={previewLoading}>
                    {previewLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                    Re-validate
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {fields.length === 0 && previewLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                  </div>
                ) : fields.length === 0 ? (
                  <p className="text-sm text-gray-500">No field data available. Upload a file first.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {fields.map(f => (
                      <Badge
                        key={f.name}
                        variant="outline"
                        className={`text-xs ${
                          f.status === 'recognized'
                            ? 'border-green-300 bg-green-50 text-green-700'
                            : f.status === 'ignored'
                              ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
                              : 'border-red-300 bg-red-50 text-red-700'
                        }`}
                      >
                        {f.name}
                        {f.status === 'recognized' && <CheckCircle className="w-3 h-3 ml-1" />}
                        {f.status === 'ignored' && <AlertCircle className="w-3 h-3 ml-1" />}
                        {f.status === 'missing' && <XCircle className="w-3 h-3 ml-1" />}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Duplicate estimate */}
            {duplicateEstimate > 0 && (
              <Card className="border-yellow-200 bg-yellow-50/50">
                <CardContent className="flex items-center gap-3 py-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
                  <p className="text-sm text-yellow-800">
                    Estimated <span className="font-semibold">{duplicateEstimate}</span> duplicate records detected based on current settings.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Preview table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Preview Records</CardTitle>
                <CardDescription>First 20 normalized records</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {previewRecords.length === 0 && previewLoading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : previewRecords.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No records to preview</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Brand</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead className="text-right">Price PKR</TableHead>
                          <TableHead className="text-center">Specs</TableHead>
                          <TableHead className="w-20">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRecords.map((r) => (
                          <TableRow key={r.row} className={
                            r.status === 'error' ? 'bg-red-50/50' : r.status === 'warning' ? 'bg-yellow-50/50' : ''
                          }>
                            <TableCell className="text-xs text-gray-400 font-mono">{r.row}</TableCell>
                            <TableCell className="font-medium">{r.brand || '-'}</TableCell>
                            <TableCell>{r.model || '-'}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {r.pricePKR != null ? Number(r.pricePKR).toLocaleString() : '-'}
                            </TableCell>
                            <TableCell className="text-center">{r.specsCount}</TableCell>
                            <TableCell>
                              {r.status === 'valid' && (
                                <Badge className="bg-green-100 text-green-700 text-xs">Valid</Badge>
                              )}
                              {r.status === 'warning' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-yellow-100 text-yellow-700 text-xs cursor-help">
                                      {r.warnings.length} warn
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs max-w-xs">{r.warnings.join('; ')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {r.status === 'error' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-red-100 text-red-700 text-xs cursor-help">
                                      {r.errors.length} err
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs max-w-xs">{r.errors.join('; ')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setActiveTab('upload')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={() => setActiveTab('settings')}>
                Next: Settings <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SETTINGS TAB                                                   */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {/* Duplicate Mode */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Duplicate Mode</CardTitle>
                <CardDescription>How to handle records that match existing phones</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={duplicateMode}
                  onValueChange={(v) => setDuplicateMode(v as DuplicateMode)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {([
                    { value: 'skip', label: 'Skip', desc: 'Leave existing records untouched' },
                    { value: 'update', label: 'Update', desc: 'Merge new data into existing records' },
                    { value: 'replace', label: 'Replace', desc: 'Overwrite existing records completely' },
                    { value: 'review', label: 'Review', desc: 'Queue duplicates for manual review' },
                  ] as const).map(opt => (
                    <Label
                      key={opt.value}
                      htmlFor={`dup-${opt.value}`}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        duplicateMode === opt.value
                          ? 'border-blue-300 bg-blue-50/60'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <RadioGroupItem value={opt.value} id={`dup-${opt.value}`} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Batch Size */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Batch Size</CardTitle>
                <CardDescription>Number of records processed per batch</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Records per batch</span>
                  <span className="text-sm font-semibold text-blue-600 tabular-nums">{batchSize}</span>
                </div>
                <Slider
                  value={[batchSize]}
                  onValueChange={([v]) => setBatchSize(v)}
                  min={50}
                  max={500}
                  step={50}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>50</span>
                  <span>500</span>
                </div>
              </CardContent>
            </Card>

            {/* Publish Mode */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Publish Mode</CardTitle>
                <CardDescription>Control when imported phones become visible</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={publishMode}
                  onValueChange={(v) => setPublishMode(v as PublishMode)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <Label
                    htmlFor="pub-immediate"
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      publishMode === 'immediate' ? 'border-blue-300 bg-blue-50/60' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <RadioGroupItem value="immediate" id="pub-immediate" className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Immediate</p>
                      <p className="text-xs text-gray-500 mt-0.5">Phones are published right away</p>
                    </div>
                  </Label>
                  <Label
                    htmlFor="pub-review"
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      publishMode === 'review' ? 'border-blue-300 bg-blue-50/60' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <RadioGroupItem value="review" id="pub-review" className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Review Queue</p>
                      <p className="text-xs text-gray-500 mt-0.5">Phones are held for manual approval</p>
                    </div>
                  </Label>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Create Missing Brands */}
            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">Create Missing Brands</p>
                  <p className="text-xs text-gray-500 mt-0.5">Automatically create brand entries not found in the database</p>
                </div>
                <Switch
                  checked={createMissingBrands}
                  onCheckedChange={setCreateMissingBrands}
                />
              </CardContent>
            </Card>

            {/* Dry Run */}
            <Card className="border-orange-200">
              <CardContent className="flex items-start justify-between py-4 gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Dry Run</p>
                  <p className="text-xs text-orange-700 mt-0.5 bg-orange-50 rounded-md px-2 py-1">
                    When enabled, no data will be written to the database. Use this to validate your import configuration before running it for real.
                  </p>
                </div>
                <Switch
                  checked={dryRun}
                  onCheckedChange={setDryRun}
                  className="shrink-0 mt-1"
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setActiveTab('preview')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white"
                onClick={handleSaveSettings}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {dryRun ? 'Start Dry Run' : 'Start Import'}
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* PROGRESS TAB                                                   */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'progress' && (
          <div className="space-y-4">
            {!progress && !jobId ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Database className="w-10 h-10 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-500">No active import</p>
                  <p className="text-xs text-gray-400 mt-1">Upload a file to start a new import job</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveTab('upload')}>
                    Go to Upload
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Progress bar */}
                <Card>
                  <CardContent className="py-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {progress?.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : progress?.status === 'failed' || progress?.status === 'cancelled' ? (
                          <XCircle className="w-5 h-5 text-red-500" />
                        ) : isPaused ? (
                          <Pause className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                        )}
                        <span className="text-sm font-semibold text-gray-900">
                          {progress?.status === 'completed' ? 'Import Complete' :
                           progress?.status === 'cancelled' ? 'Import Cancelled' :
                           progress?.status === 'failed' ? 'Import Failed' :
                           isPaused ? 'Paused' : 'Importing...'}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-blue-600 tabular-nums">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-2.5" />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{progress?.processedRecords || 0} / {progress?.totalRecords || 0} records</span>
                      <span>{eta}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total', value: progress?.totalRecords || 0, color: 'text-gray-900' },
                    { label: 'Processed', value: progress?.processedRecords || 0, color: 'text-blue-600' },
                    { label: 'Created', value: progress?.createdCount || 0, color: 'text-green-600' },
                    { label: 'Updated', value: progress?.updatedCount || 0, color: 'text-blue-500' },
                    { label: 'Skipped', value: progress?.skippedCount || 0, color: 'text-gray-500' },
                    { label: 'Failed', value: progress?.failedCount || 0, color: 'text-red-600' },
                    { label: 'Current Batch', value: `${Math.min((progress?.currentBatch || 0) + 1, progress?.totalBatches || 0)}/${progress?.totalBatches || 0}`, color: 'text-purple-600' },
                    { label: 'Elapsed', value: elapsedMs > 0 ? formatDuration(elapsedMs) : '-', color: 'text-gray-600' },
                  ].map(stat => (
                    <Card key={stat.label}>
                      <CardContent className="py-3 px-4">
                        <p className="text-xs text-gray-500">{stat.label}</p>
                        <p className={`text-lg font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Batch status list */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Batch Status</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-72">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">Batch</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Created</TableHead>
                            <TableHead className="text-right">Updated</TableHead>
                            <TableHead className="text-right">Failed</TableHead>
                            <TableHead className="w-24 text-right">Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {progress?.batches.map(b => (
                            <TableRow key={b.batchNumber}>
                              <TableCell className="font-mono text-xs">#{b.batchNumber}</TableCell>
                              <TableCell>
                                <Badge className={`text-xs ${batchStatusColor(b.status)}`}>
                                  {b.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{b.total}</TableCell>
                              <TableCell className="text-right tabular-nums text-green-600">{b.created}</TableCell>
                              <TableCell className="text-right tabular-nums text-blue-600">{b.updated}</TableCell>
                              <TableCell className="text-right tabular-nums text-red-600">{b.failed}</TableCell>
                              <TableCell className="text-right text-xs text-gray-400">
                                {b.durationMs ? formatDuration(b.durationMs) : b.status === 'running' ? '...' : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!progress?.batches || progress.batches.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-sm text-gray-400 py-6">
                                No batches yet
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Controls */}
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-2 py-4">
                    {!isRunning && !isCompleted && progress?.status !== 'cancelled' && progress?.status !== 'failed' && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleStart}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
                        Start
                      </Button>
                    )}
                    {isRunning && !isPaused && (
                      <Button
                        size="sm"
                        className="bg-yellow-500 hover:bg-yellow-600 text-white"
                        onClick={handlePause}
                      >
                        <Pause className="w-4 h-4 mr-1.5" />
                        Pause
                      </Button>
                    )}
                    {isPaused && (
                      <Button
                        size="sm"
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                        onClick={handleResume}
                      >
                        <Play className="w-4 h-4 mr-1.5" />
                        Resume
                      </Button>
                    )}
                    {failedBatches > 0 && (
                      <Button
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={handleRetryFailed}
                      >
                        <RefreshCw className="w-4 h-4 mr-1.5" />
                        Retry Failed ({failedBatches})
                      </Button>
                    )}
                    {(isRunning || isPaused) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setCancelDialogOpen(true)}
                      >
                        <XCircle className="w-4 h-4 mr-1.5" />
                        Cancel
                      </Button>
                    )}
                    {isCompleted && (
                      <Button size="sm" variant="outline" onClick={handleReset}>
                        <RefreshCw className="w-4 h-4 mr-1.5" />
                        New Import
                      </Button>
                    )}
                    {(progress?.failedCount || 0) > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        onClick={handleDownloadErrorsFromServer}
                      >
                        <Download className="w-4 h-4 mr-1.5" />
                        Download Errors CSV
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* HISTORY TAB                                                    */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Import History</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => { safeFetch<{ jobs?: unknown[] }>('/api/admin/import-v2/history').then((res) => { if (res.ok) setHistory(normalizeHistory(res.data?.jobs || [])); }); }}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {historyLoading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : history.length === 0 ? (
                  <div className="p-10 text-center">
                    <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No import history yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Created</TableHead>
                          <TableHead className="text-right">Updated</TableHead>
                          <TableHead className="text-right">Skipped</TableHead>
                          <TableHead className="text-right">Failed</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead className="w-24"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map(h => (
                          <Fragment key={h.id}>
                            <TableRow
                              key={h.id}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => setExpandedHistoryId(expandedHistoryId === h.id ? null : h.id)}
                            >
                              <TableCell>
                                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedHistoryId === h.id ? 'rotate-90' : ''}`} />
                              </TableCell>
                              <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                                {h.date ? new Date(h.date).toLocaleDateString() : '-'}
                              </TableCell>
                              <TableCell className="text-sm font-medium truncate max-w-40">{h.fileName || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={statusBadgeVariant(h.status)} className="text-xs">
                                  {h.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{h.total}</TableCell>
                              <TableCell className="text-right tabular-nums text-green-600">{h.created}</TableCell>
                              <TableCell className="text-right tabular-nums text-blue-600">{h.updated}</TableCell>
                              <TableCell className="text-right tabular-nums text-gray-500">{h.skipped}</TableCell>
                              <TableCell className="text-right tabular-nums text-red-600">{h.failed}</TableCell>
                              <TableCell className="text-sm text-gray-500">{h.duration || '-'}</TableCell>
                              <TableCell>
                                {h.status === 'completed' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                                    onClick={(e) => { e.stopPropagation(); setRollbackDialogId(h.id); }}
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Rollback
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                            {expandedHistoryId === h.id && h.batches && h.batches.length > 0 && (
                              <TableRow key={`${h.id}-batches`}>
                                <TableCell colSpan={11} className="bg-gray-50/50 px-8 py-2">
                                  <div className="text-xs text-gray-500 mb-2 font-medium">Batches</div>
                                  <ScrollArea className="max-h-48">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="text-xs">Batch</TableHead>
                                          <TableHead className="text-xs">Status</TableHead>
                                          <TableHead className="text-xs text-right">Created</TableHead>
                                          <TableHead className="text-xs text-right">Updated</TableHead>
                                          <TableHead className="text-xs text-right">Failed</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {h.batches.map(b => (
                                          <TableRow key={b.batchNumber}>
                                            <TableCell className="text-xs font-mono">#{b.batchNumber}</TableCell>
                                            <TableCell>
                                              <Badge className={`text-xs ${batchStatusColor(b.status)}`}>{b.status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-right tabular-nums">{b.created}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums">{b.updated}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums text-red-600">{b.failed}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </ScrollArea>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CANCEL CONFIRMATION DIALOG                                      */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Import</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this import? Progress will be lost and no further batches will be processed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Keep Running</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Cancel Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ROLLBACK CONFIRMATION DIALOG                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={!!rollbackDialogId} onOpenChange={(open) => { if (!open) setRollbackDialogId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback Import</DialogTitle>
            <DialogDescription>
              This will remove all phones created by this import. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRollbackDialogId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rollbackDialogId && handleRollback(rollbackDialogId)}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}