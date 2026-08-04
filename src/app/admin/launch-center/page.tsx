import Link from 'next/link';
import { CheckCircle2, CircleAlert, ExternalLink, Rocket, ShieldCheck } from 'lucide-react';
import { getIntegrationChecks } from '@/lib/integration-status';

export const dynamic = 'force-dynamic';

export default function LaunchCenterPage() {
  const checks = getIntegrationChecks();
  const configured = checks.filter(item => item.configured).length;
  const requiredMissing = checks.filter(item => item.required && !item.configured);
  const readiness = Math.round((configured / checks.length) * 100);
  const groups = Array.from(new Set(checks.map(item => item.category)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">PhoneDock 2.0</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">Launch Center</h1>
          <p className="mt-1 text-sm text-gray-500">Ek screen par deployment, earning, analytics aur security setup check karein.</p>
        </div>
        <Link href="/" target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Live site dekhein <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Integration readiness</p>
              <p className="mt-1 text-4xl font-black text-gray-950">{readiness}%</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Rocket className="h-7 w-7" /></div>
          </div>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${readiness}%` }} /></div>
          <p className="mt-3 text-xs text-gray-500">{configured} of {checks.length} integrations configured.</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${requiredMissing.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <ShieldCheck className={`h-6 w-6 ${requiredMissing.length ? 'text-amber-600' : 'text-emerald-600'}`} />
          <p className="mt-3 text-sm font-semibold text-gray-900">Required setup</p>
          <p className="mt-1 text-2xl font-black text-gray-950">{requiredMissing.length ? `${requiredMissing.length} missing` : 'Ready'}</p>
          <p className="mt-2 text-xs text-gray-600">Required values ke baghair production launch na karein.</p>
        </div>
      </div>

      <div className="space-y-5">
        {groups.map(group => (
          <section key={group} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-gray-950">{group}</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {checks.filter(item => item.category === group).map(item => (
                <div key={item.key} className="flex gap-3 rounded-xl border border-gray-100 p-4">
                  {item.configured ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                      {item.required && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">Required</span>}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{item.hint}</p>
                    <code className="mt-2 block overflow-x-auto rounded-lg bg-gray-50 px-2 py-1.5 text-[11px] text-gray-600">{item.key}</code>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-950">
        <p className="font-bold">Vercel mein IDs kahan paste karni hain?</p>
        <p className="mt-1 text-blue-800">Project → Settings → Environment Variables. Variable ka naam bilkul isi screen jaisa rakhein, value paste karein, phir Redeploy karein.</p>
      </div>
    </div>
  );
}
