'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, UploadCloud, FileText, CheckCircle, XCircle, AlertTriangle, Download, X, Database, Clock, BarChart3, Check, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ['json', 'csv', 'xlsx', 'xls'];
const ALLOWED_MIME_TYPES = new Set([
  'application/json',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

interface ImportResult {
  error?: string;
  total?: number;
  processed?: number;
  imported?: number;
  inserted?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  issues?: string[];
  errors?: string[];
  duration?: number;
}

interface ImportValidation {
  total: number | null;
  validCount: number | null;
  errorCount: number;
  errors: string[];
  preview: Record<string, unknown>[];
  excelFile?: boolean;
  fileName?: string;
  fileSize?: number;
}

interface ImportStats {
  totalImports?: number;
  successfulImports?: number;
  failedImports?: number;
  todayImports?: number;
  lastImportTime?: string;
}

interface ImportHistory {
  _id: string;
  createdAt: string;
  filename?: string;
  imported?: number;
  updated?: number;
  failed?: number;
  duration?: number;
}

export default function AdminImportPage() {
  useAdmin();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [importMode, setImportMode] = useState<'skip_duplicates' | 'update_existing' | 'new_only'>('skip_duplicates');
  const [previewRecords, setPreviewRecords] = useState<Record<string, unknown>[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState('');
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetch('/api/import/stats', { credentials: 'include' }).then(r => r.json()).then((d: ImportStats) => setImportStats(d)).catch(() => {});
  }, [result]);

  useEffect(() => {
    fetch('/api/import/history', { credentials: 'include' }).then(r => r.json()).then((d: ImportHistory[] | { history?: ImportHistory[] }) => setHistory(Array.isArray(d) ? d : (d.history || []))).catch(() => {});
  }, [result]);

  const validateFile = (f: File): string | null => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return 'Only JSON, CSV, and Excel (.xlsx/.xls) files are supported.';
    }
    if (f.size > MAX_UPLOAD_SIZE) {
      return `File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`;
    }
    if (f.size === 0) {
      return 'File is empty.';
    }
    // MIME check (best-effort — browser may report generic types for xlsx)
    if (ext === 'json' && f.type && !ALLOWED_MIME_TYPES.has(f.type) && f.type !== 'application/octet-stream') {
      return `Unexpected MIME type "${f.type}" for a JSON file.`;
    }
    if (ext === 'csv' && f.type && f.type !== 'text/csv' && f.type !== 'text/plain' && f.type !== 'application/vnd.ms-excel') {
      return `Unexpected MIME type "${f.type}" for a CSV file.`;
    }
    return null;
  };

  const handleFile = async (f: File) => {
    const validationError = validateFile(f);
    if (validationError) {
      setParseError(validationError);
      return;
    }
    setFile(f); setResult(null); setValidation(null); setParseError(''); setActiveTab('upload');
    const ext = f.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'json' || ext === 'csv') {
        // Parse JSON/CSV client-side for preview
        const text = await f.text();
        let records: Record<string, unknown>[] = [];
        if (ext === 'json') {
          const parsed = JSON.parse(text);
          records = Array.isArray(parsed) ? parsed : (parsed.phones || parsed.data || parsed.records || [parsed]);
        } else if (ext === 'csv') {
          const Papa = await import('papaparse');
          const res = Papa.default.parse(text, { header: true, skipEmptyLines: true });
          records = res.data as Record<string, unknown>[];
        }
        setPreviewRecords(records);
        const errors: string[] = [];
        const valid: Record<string, unknown>[] = [];
        records.forEach((r: Record<string, unknown>, i: number) => {
          const brand = String(r.brand || r.brandName || '').trim();
          const model = String(r.model || r.modelName || r.name || '').trim();
          if (!brand || !model) errors.push(`Row ${i + 1}: Missing brand or model`);
          else valid.push({ ...r, _brand: brand, _model: model, _row: i + 1 });
        });
        setValidation({ total: records.length, validCount: valid.length, errorCount: errors.length, errors, preview: valid.slice(0, 10) });
      } else if (ext === 'xlsx' || ext === 'xls') {
        // For Excel files, parse on the server — just show basic info
        setPreviewRecords([]);
        setValidation({
          total: null,
          validCount: null,
          errorCount: 0,
          errors: [],
          preview: [],
          excelFile: true,
          fileName: f.name,
          fileSize: f.size,
        });
      }
    } catch (e: unknown) {
      setParseError('Failed to parse file: ' + (e instanceof Error ? e.message : String(e)));
      setPreviewRecords([]);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setUploading(true); setActiveTab('results');
    const startTime = Date.now();
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        // Use server-side file upload endpoint for Excel
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/import', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const data = await res.json();
        data.duration = Date.now() - startTime;
        setResult(data);
      } else {
        // Use JSON bulk-import for JSON/CSV (already parsed client-side)
        if (previewRecords.length === 0) {
          setResult({ error: 'No valid records to import', duration: Date.now() - startTime });
          setUploading(false);
          return;
        }
        const res = await fetch('/api/admin/phones/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ records: previewRecords, mode: importMode }),
        });
        const data = await res.json();
        data.duration = Date.now() - startTime;
        setResult(data);
      }
    } catch (e: unknown) {
      setResult({ error: e instanceof Error ? e.message : String(e), duration: Date.now() - startTime });
    }
    setUploading(false);
  };

  const downloadSampleJson = () => {
    const sample = [
      { brand: "Samsung", model: "Galaxy S25 Ultra", pricePKR: 385000, ptaStatus: "PTA Approved", releaseDate: "2025-01-17", ram: "12 GB", storage: "256 GB", chipset: "Snapdragon 8 Elite", display: '6.9"', resolution: "3120x1440", refreshRate: "120Hz", mainCamera: "200 MP", selfieCamera: "12 MP", battery: "5000 mAh", chargingSpeed: "45W", os: "Android 15", weight: "218g", featured: true, trending: true },
    ];
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sample-phones.json'; a.click(); URL.revokeObjectURL(url);
  };

  const downloadSampleCsv = () => {
    const csv = 'brand,model,pricePKR,ptaStatus,releaseDate,chipset,battery\nSamsung,Galaxy S25 Ultra,385000,PTA Approved,2025-01-17,Snapdragon 8 Elite,5000 mAh\nApple,iPhone 16 Pro Max,569999,PTA Approved,2024-09-20,A18 Pro,4685 mAh\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sample-phones.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Bulk Import Phones</h1>
          <p className="text-xs text-muted-foreground mt-1">Upload JSON, CSV, or Excel (.xlsx/.xls) files with phone data.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowHistory(!showHistory)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors ${showHistory ? 'bg-blue-600 text-white' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'}`}>
            <Clock className="w-3.5 h-3.5" /> History
          </button>
          <button onClick={downloadSampleCsv} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV Sample
          </button>
          <button onClick={downloadSampleJson} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            <Download className="w-3.5 h-3.5" /> JSON Sample
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {importStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total Imports', value: importStats.totalImports, icon: Database, bg: 'bg-blue-50', color: 'text-blue-600' },
            { label: 'Successful', value: importStats.successfulImports, icon: CheckCircle, bg: 'bg-emerald-50', color: 'text-emerald-600' },
            { label: 'Failed', value: importStats.failedImports, icon: XCircle, bg: 'bg-red-50', color: 'text-red-600' },
            { label: "Today's Imports", value: importStats.todayImports, icon: BarChart3, bg: 'bg-violet-50', color: 'text-violet-600' },
            { label: 'Last Import', value: importStats.lastImportTime ? new Date(importStats.lastImportTime).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never', icon: RefreshCw, bg: 'bg-indigo-50', color: 'text-indigo-600' },
          ].map(s => (
            <div key={s.label} className="card-premium p-3.5">
              <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center mb-2`}><s.icon className={`w-3.5 h-3.5 ${s.color}`} /></div>
              <p className="text-base font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Import History */}
      {showHistory && history.length > 0 && (
        <div className="card-premium p-4">
          <h3 className="text-xs font-bold text-gray-700 mb-3">Recent Import History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-100">
                <th className="text-left py-2 px-2 font-semibold text-gray-700">Date</th>
                <th className="text-left py-2 px-2 font-semibold text-gray-700">File</th>
                <th className="text-center py-2 px-2 font-semibold text-gray-700">Imported</th>
                <th className="text-center py-2 px-2 font-semibold text-gray-700">Updated</th>
                <th className="text-center py-2 px-2 font-semibold text-gray-700">Failed</th>
                <th className="text-center py-2 px-2 font-semibold text-gray-700">Duration</th>
              </tr></thead>
              <tbody>
                {history.slice(0, 10).map((h, i) => (
                  <tr key={h._id || i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 px-2 text-gray-500">{new Date(h.createdAt).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-2 px-2 text-gray-900 font-medium">{h.filename || '-'}</td>
                    <td className="py-2 px-2 text-center"><span className="text-emerald-600 font-medium">{h.imported || 0}</span></td>
                    <td className="py-2 px-2 text-center"><span className="text-blue-600 font-medium">{h.updated || 0}</span></td>
                    <td className="py-2 px-2 text-center"><span className="text-red-600 font-medium">{h.failed || 0}</span></td>
                    <td className="py-2 px-2 text-gray-500">{h.duration ? `${(h.duration / 1000).toFixed(1)}s` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="upload"><Upload className="w-3.5 h-3.5 mr-1.5" />Upload</TabsTrigger>
          <TabsTrigger value="preview" disabled={!validation}><FileText className="w-3.5 h-3.5 mr-1.5" />Preview ({validation?.validCount ?? validation?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="results" disabled={!result}><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Results</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <Card className="border-gray-100">
            <CardContent className="p-6">
              {parseError && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">{parseError}</div>}
              <div
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer ${dragOver ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50/50'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".json,.csv,.xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3"><UploadCloud className="w-7 h-7 text-blue-500" /></div>
                <p className="text-sm font-semibold text-gray-900">Drop your file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">JSON, CSV, and Excel (.xlsx/.xls) supported — max 10 MB</p>
                {file && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-gray-100 shadow-sm">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900">{file.name}</span>
                    <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                    <button onClick={e => { e.stopPropagation(); setFile(null); setValidation(null); setResult(null); setPreviewRecords([]); }} className="ml-1 text-muted-foreground hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>

              {file && validation && (
                <div className="mt-5 space-y-4">
                  {validation.excelFile ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-blue-800 mb-2">Excel File Ready</p>
                      <p className="text-[10px] text-blue-600 mb-3">
                        <strong>{validation.fileName}</strong> ({((validation.fileSize ?? 0) / 1024).toFixed(1)} KB) — records will be parsed server-side. Max 5000 records.
                      </p>
                      <Button onClick={handleImport} disabled={uploading} className="gap-1.5 bg-blue-500 hover:bg-blue-600">
                        {uploading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                        Import Excel File
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-emerald-700">{validation.validCount}</p><p className="text-[10px] text-emerald-600">Valid Records</p></div>
                        <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-red-700">{validation.errorCount}</p><p className="text-[10px] text-red-600">Errors</p></div>
                        <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-blue-700">{validation.total}</p><p className="text-[10px] text-blue-600">Total Records</p></div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-700 mb-3">Import Mode</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {([
                            { value: 'skip_duplicates', label: 'Skip Duplicates', desc: 'Ignore phones that already exist' },
                            { value: 'update_existing', label: 'Update Existing', desc: 'Update specs & prices of existing phones' },
                            { value: 'new_only', label: 'New Only', desc: 'Only import brand new phones' },
                          ] as const).map(m => (
                            <label key={m.value} className={`block cursor-pointer rounded-xl border-2 p-3 transition-all ${importMode === m.value ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                              <input type="radio" name="importMode" value={m.value} checked={importMode === m.value} onChange={e => setImportMode(e.target.value as 'skip_duplicates' | 'update_existing' | 'new_only')} className="sr-only" />
                              <div className="text-sm font-semibold text-gray-900">{m.label}</div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
                            </label>
                          ))}
                        </div>
                      </div>

                      {validation.preview?.length > 0 && (
                        <Card className="border-gray-100">
                          <CardHeader className="pb-2"><CardTitle className="text-sm">Data Preview (first {Math.min(validation.preview.length, 10)} records)</CardTitle></CardHeader>
                          <CardContent className="p-4 pt-0">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead><tr className="border-b border-gray-100">
                                  <th className="text-left py-1.5 px-2 font-semibold text-gray-700">#</th>
                                  <th className="text-left py-1.5 px-2 font-semibold text-gray-700">Brand</th>
                                  <th className="text-left py-1.5 px-2 font-semibold text-gray-700">Model</th>
                                  <th className="text-left py-1.5 px-2 font-semibold text-gray-700">Price (PKR)</th>
                                  <th className="text-left py-1.5 px-2 font-semibold text-gray-700">Status</th>
                                </tr></thead>
                                <tbody>
                                  {validation.preview.map((r, i) => (
                                    <tr key={i} className="border-b border-gray-50">
                                      <td className="py-1.5 px-2 text-gray-400">{String(r._row || i + 1)}</td>
                                      <td className="py-1.5 px-2 text-gray-900">{String(r._brand || r.brand || '-')}</td>
                                      <td className="py-1.5 px-2 font-medium text-gray-900">{String(r._model || r.modelName || r.model || '-')}</td>
                                      <td className="py-1.5 px-2">{r.pricePKR || r.price ? `PKR ${Number(r.pricePKR || r.price).toLocaleString()}` : '-'}</td>
                                      <td className="py-1.5 px-2"><Badge className="bg-emerald-50 text-emerald-700 text-[10px]">Valid</Badge></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {validation.errors?.length > 0 && (
                        <Card className="border-red-100">
                          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700">Validation Errors ({validation.errors.length})</CardTitle></CardHeader>
                          <CardContent className="p-4 pt-0 max-h-40 overflow-y-auto">
                            {validation.errors.map((e: string, i: number) => (
                              <p key={i} className="text-xs text-red-600 py-0.5 border-b border-red-50">{e}</p>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      <div className="flex gap-3">
                        <Button onClick={() => setActiveTab('preview')} variant="outline" className="gap-1.5"><FileText className="w-4 h-4" />Review Preview</Button>
                        <Button onClick={handleImport} disabled={validation.validCount === 0 || uploading} className="gap-1.5 bg-blue-500 hover:bg-blue-600">
                          {uploading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                          Import {validation.validCount} Phones
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          {validation && !validation.excelFile && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-emerald-700">{validation.validCount ?? 0}</p><p className="text-[10px] text-emerald-600">Valid</p></div>
                <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-red-700">{validation.errorCount}</p><p className="text-[10px] text-red-600">Errors</p></div>
                <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-blue-700">{validation.total ?? 0}</p><p className="text-[10px] text-blue-600">Total</p></div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800">Import mode: <strong>{importMode === 'skip_duplicates' ? 'Skip Duplicates' : importMode === 'update_existing' ? 'Update Existing' : 'New Only'}</strong>.</p>
              </div>
              <Card className="border-gray-100">
                <CardHeader className="pb-2"><CardTitle className="text-sm">All Valid Records ({validation.validCount})</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white"><tr className="border-b border-gray-100">
                        <th className="text-left py-1.5 px-2 font-semibold text-gray-700">#</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-gray-700">Brand</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-gray-700">Model</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-gray-700">Price</th>
                        <th className="text-left py-1.5 px-2 font-semibold text-gray-700">Chipset</th>
                      </tr></thead>
                      <tbody>
                        {validation.preview.map((r, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1.5 px-2 text-gray-400">{String(r._row || i + 1)}</td>
                            <td className="py-1.5 px-2 text-gray-900">{String(r._brand || '-')}</td>
                            <td className="py-1.5 px-2 font-medium">{String(r._model || '-')}</td>
                            <td className="py-1.5 px-2">{r.pricePKR || r.price ? `PKR ${Number(r.pricePKR || r.price).toLocaleString()}` : '-'}</td>
                            <td className="py-1.5 px-2 text-gray-600">{String(r.chipset || '-')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-3">
                <Button onClick={() => setActiveTab('upload')} variant="outline">Back</Button>
                <Button onClick={handleImport} disabled={uploading} className="gap-1.5 bg-blue-500 hover:bg-blue-600">
                  {uploading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                  Import Now
                </Button>
              </div>
            </div>
          )}
          {validation?.excelFile && (
            <Card className="border-blue-100">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-gray-700 mb-3">Excel file ({validation.fileName}{validation.fileSize ? ` · ${(validation.fileSize / 1024).toFixed(1)} KB` : ''}). Preview is not available for .xlsx/.xls files.</p>
                <Button onClick={handleImport} disabled={uploading} className="gap-1.5 bg-blue-500 hover:bg-blue-600">
                  {uploading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                  Import Excel File
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          {uploading && !result && (
            <div className="text-center py-16">
              <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Importing phones...</p>
            </div>
          )}
          {result && (
            <div className="space-y-4">
              {result.error ? (
                <Card className="border-red-100"><CardContent className="p-6 text-center"><XCircle className="w-10 h-10 text-red-400 mx-auto mb-2" /><p className="text-sm font-medium text-red-700">{result.error}</p></CardContent></Card>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { label: 'Total Records', value: result.total ?? result.processed ?? 0, color: 'text-gray-900 bg-gray-50' },
                      { label: 'Imported', value: result.imported ?? result.inserted ?? 0, color: 'text-emerald-700 bg-emerald-50' },
                      { label: 'Updated', value: result.updated ?? 0, color: 'text-blue-700 bg-blue-50' },
                      { label: 'Skipped', value: result.skipped ?? 0, color: 'text-amber-700 bg-amber-50' },
                      { label: 'Failed', value: result.failed ?? result.issues?.length ?? 0, color: 'text-red-700 bg-red-50' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl p-4 text-center ${s.color}`}>
                        <p className="text-2xl font-bold">{s.value}</p>
                        <p className="text-[10px] font-medium">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {result && result.duration && <p className="text-xs text-muted-foreground">Completed in {(result.duration / 1000).toFixed(1)}s</p>}
                  {result && ((result.errors?.length || 0) + (result.issues?.length || 0)) > 0 && (
                    <Card className="border-red-100">
                      <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700">Errors ({(result.errors || result.issues || []).length})</CardTitle></CardHeader>
                      <CardContent className="p-4 pt-0 max-h-60 overflow-y-auto">
                        {(result.errors || result.issues || []).map((e: string, i: number) => (
                          <p key={i} className="text-xs text-red-600 py-0.5 border-b border-red-50">{typeof e === 'string' ? e : JSON.stringify(e)}</p>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  <Button onClick={() => { setFile(null); setResult(null); setValidation(null); setPreviewRecords([]); setActiveTab('upload'); }} variant="outline">Import Another File</Button>
                </>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}