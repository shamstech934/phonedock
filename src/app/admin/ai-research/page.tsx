'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, CheckCircle, XCircle, AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';

type EnrichmentType = 'specs' | 'images' | 'prices';

interface AIStatus {
  providerName: string | null;
  providerConfigured: boolean;
  tavily: boolean;
  imageSearch: boolean;
  configured: { specs: boolean; images: boolean; prices: boolean };
}

interface DraftPhone { modelName?: string; slug?: string; thumbnail?: string }
interface Draft {
  _id: string;
  phoneId: DraftPhone | string;
  type: EnrichmentType;
  status: string;
  brand?: string;
  model?: string;
  confidence: number;
  sourceNotes?: string;
  conflicts?: string[];
  specs?: Record<string, string>;
  images?: Array<{ url: string; title?: string }>;
  price?: { valuePKR?: number; sourceName?: string };
  createdAt: string;
}

export default function AiResearchPage() {
  useAdmin();
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<EnrichmentType>('specs');
  const [slugsInput, setSlugsInput] = useState('');
  const [running, setRunning] = useState(false);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/admin/ai-research/status', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Status fetch failed'); return r.json(); }),
      fetch('/api/admin/ai-research/drafts?status=pending_review&limit=30', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Drafts fetch failed'); return r.json(); }),
    ]).then(([s, d]) => {
      setStatus(s);
      setDrafts(d.drafts || []);
      setLoading(false);
    }).catch((e) => {
      setError(e?.message || 'Failed to load AI research data.');
      setLoading(false);
    });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runJob = async () => {
    const slugs = slugsInput.split(',').map(s => s.trim()).filter(Boolean);
    if (slugs.length === 0) { setJobMessage('Enter at least one phone slug.'); return; }
    if (slugs.length > 10) { setJobMessage('Max 10 phones per job — split into multiple runs.'); return; }
    setRunning(true);
    setJobMessage(null);
    try {
      // Resolve slugs to phone IDs via the public lookup endpoint used elsewhere in admin.
      const lookups = await Promise.all(slugs.map(slug =>
        fetch(`/api/phones/${encodeURIComponent(slug)}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null)
      ));
      const phoneIds = lookups.map(p => p?.id || p?._id).filter(Boolean);
      if (phoneIds.length === 0) { setJobMessage('None of those slugs matched an existing phone.'); setRunning(false); return; }

      const res = await fetch('/api/admin/ai-research/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ type, phoneIds, batchSize: 2 }),
      });
      const queued = await res.json();
      if (!res.ok) { setJobMessage(queued.error || 'Job failed to queue.'); setRunning(false); return; }

      let current = queued;
      setJobMessage(`Queued ${queued.total} phone(s). Processing bounded batches…`);
      for (let attempt = 0; attempt < 30 && ['queued', 'running'].includes(current.status); attempt++) {
        const batchRes = await fetch(`/api/admin/ai-research/jobs/${queued.jobId}/run`, {
          method: 'POST', credentials: 'include',
        });
        current = await batchRes.json();
        if (!batchRes.ok) throw new Error(current.error || 'Research batch failed.');
        setJobMessage(`Processed ${current.processed}/${current.total} · drafts ${current.generated} · failed ${current.failed}`);
      }
      setJobMessage(`Finished: ${current.generated || 0} draft(s), ${current.failed || 0} failed, status ${current.status}.`);
      setSlugsInput('');
      fetchData();
    } catch (error) {
      setJobMessage(error instanceof Error ? error.message : 'Job failed — check your network and try again.');
    } finally { setRunning(false); }
  };

  const review = async (id: string, action: 'approve' | 'reject') => {
    setReviewingId(id);
    try {
      const res = await fetch(`/api/admin/ai-research/drafts/${id}/${action}`, { method: 'POST', credentials: 'include' });
      if (!res.ok) { const r = await res.json().catch(() => ({})); setError(r.error || `Failed to ${action} draft.`); return; }
      setDrafts(prev => prev.filter(d => d._id !== id));
    } catch {
      setError(`Failed to ${action} draft — check your network and try again.`);
    } finally { setReviewingId(null); }
  };

  if (loading) return <div className="grid grid-cols-1 gap-3">{Array(3).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-24 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">AI Research</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Generate reviewable spec/image/price drafts — nothing publishes without your approval</p>
        </div>
        <button onClick={fetchData} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="card-premium p-4 flex items-center gap-2 text-red-600 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Provider status */}
      <div className="card-premium p-5">
        <h3 className="font-bold text-sm text-gray-900 mb-3">Provider Status</h3>
        {status?.providerConfigured ? (
          <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50 mb-3">
            <CheckCircle className="w-3 h-3 mr-1" /> {status.providerName} connected
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] mb-3">No AI provider configured</Badge>
        )}
        <div className="grid grid-cols-3 gap-3 text-xs">
          {(['specs', 'images', 'prices'] as EnrichmentType[]).map(t => (
            <div key={t} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
              <span className="capitalize text-gray-600">{t}</span>
              {status?.configured[t] ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-gray-300" />}
            </div>
          ))}
        </div>
        {!status?.providerConfigured && (
          <p className="text-[11px] text-muted-foreground mt-3">
            Set <code>AI_PROVIDER</code> plus its API key (OpenRouter or OpenAI), and <code>TAVILY_API_KEY</code> for research, in your environment variables to enable this.
          </p>
        )}
      </div>

      {/* Run a job */}
      <div className="card-premium p-5">
        <h3 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-500" /> Run Research Job</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={type} onChange={e => setType(e.target.value as EnrichmentType)} className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <option value="specs">Specs</option>
            <option value="images">Images</option>
            <option value="prices">Prices</option>
          </select>
          <input
            value={slugsInput}
            onChange={e => setSlugsInput(e.target.value)}
            placeholder="phone-slug-1, phone-slug-2 (max 10)"
            className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2"
          />
          <button
            onClick={runJob}
            disabled={running || !status?.configured[type]}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded-lg transition-colors"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Run
          </button>
        </div>
        {jobMessage && <p className="text-[11px] text-muted-foreground mt-2">{jobMessage}</p>}
      </div>

      {/* Drafts pending review */}
      <div className="card-premium p-5">
        <h3 className="font-bold text-sm text-gray-900 mb-4">Pending Review ({drafts.length})</h3>
        {drafts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No drafts waiting for review.</p>
        ) : (
          <div className="space-y-3">
            {drafts.map(d => {
              const phone = typeof d.phoneId === 'object' ? d.phoneId : null;
              return (
                <div key={d._id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{phone?.modelName || `${d.brand} ${d.model}`}</p>
                      <p className="text-[10px] text-muted-foreground">{d.type} · confidence {Math.round((d.confidence || 0) * 100)}%</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => review(d._id, 'approve')}
                        disabled={reviewingId === d._id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => review(d._id, 'reject')}
                        disabled={reviewingId === d._id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 border border-gray-200 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>

                  {d.type === 'specs' && d.specs && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mt-2">
                      {Object.entries(d.specs).filter(([, v]) => v).map(([k, v]) => (
                        <div key={k} className="bg-gray-50 rounded-lg px-2 py-1">
                          <span className="text-muted-foreground capitalize">{k}: </span><span className="font-medium text-gray-800">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {d.type === 'prices' && d.price?.valuePKR && (
                    <p className="text-xs mt-2">PKR {d.price.valuePKR.toLocaleString()} — {d.price.sourceName}</p>
                  )}
                  {d.type === 'images' && d.images && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {d.images.slice(0, 4).map((img, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={img.url} alt={img.title || ''} className="w-16 h-16 object-cover rounded-lg border border-gray-100" />
                      ))}
                    </div>
                  )}
                  {d.conflicts && d.conflicts.length > 0 && (
                    <p className="text-[10px] text-amber-600 mt-2">⚠ Conflicting sources: {d.conflicts.join('; ')}</p>
                  )}
                  {d.sourceNotes && <p className="text-[10px] text-muted-foreground mt-1.5">{d.sourceNotes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
