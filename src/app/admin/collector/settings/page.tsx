'use client';

import { useEffect, useState } from 'react';
import { Info, Server } from 'lucide-react';
import { useAdmin } from '@/lib/useAdmin';

interface CollectorConfig {
  pagesPerInvocation: number | 'unlimited';
  maxCollectPerJob: number;
  schedulerEnabled: boolean;
  aiDiscoverConfigured: boolean;
}

export default function AdminCollectorSettingsPage() {
  useAdmin();
  const [config, setConfig] = useState<CollectorConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/collector/dashboard', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.config) setConfig(d.config); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Collector Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Per-source settings (timeout, response size limits, pagination, sync frequency) are configured
          individually on the <a href="/admin/collector/sources" className="text-blue-600 hover:underline">Sources</a> page.
          The values below are engine-wide limits set via environment variables at deploy time.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          This runs on Vercel serverless functions, which have no persistent background process to hold
          runtime-editable settings in memory. The numbers below reflect what actually governs job behavior —
          changing them requires updating environment variables and redeploying, not a form submission here.
        </p>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-50 rounded-2xl animate-pulse" />
      ) : config && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Server className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Engine limits</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[11px] text-gray-500">Pages per invocation</p>
              <p className="text-lg font-semibold text-gray-900">{config.pagesPerInvocation}</p>
              <p className="text-[10px] text-gray-400 mt-1">Controlled by <code>COLLECTOR_PAGES_PER_INVOCATION</code>. Jobs auto-pause and resume across invocations beyond this.</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[11px] text-gray-500">Max records per job</p>
              <p className="text-lg font-semibold text-gray-900">{config.maxCollectPerJob.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 mt-1">A single job will not collect more than this many phones, even across resumed invocations.</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[11px] text-gray-500">Scheduler</p>
              <p className="text-lg font-semibold text-gray-900">{config.schedulerEnabled ? 'Active (daily check)' : 'Inactive'}</p>
              <p className="text-[10px] text-gray-400 mt-1">Vercel Cron checks every hour for sources whose <code>syncFrequencyHours</code> is due.</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[11px] text-gray-500">AI Discover</p>
              <p className="text-lg font-semibold text-gray-900">{config.aiDiscoverConfigured ? 'Ready' : 'Needs API keys'}</p>
              <p className="text-[10px] text-gray-400 mt-1">Requires <code>TAVILY_API_KEY</code> and an AI provider key (<code>AI_PROVIDER</code>).</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
