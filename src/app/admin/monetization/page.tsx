import Link from 'next/link';
import {
  BadgeDollarSign,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  HandCoins,
  Megaphone,
  MousePointerClick,
  ShieldCheck,
} from 'lucide-react';
import { getIntegrationChecks } from '@/lib/integration-status';

export const dynamic = 'force-dynamic';

type RevenueCheck = {
  key: string;
  label: string;
  configured: boolean;
  hint: string;
};

export default function MonetizationPage() {
  const integrations = getIntegrationChecks();
  const revenueChecks: RevenueCheck[] = integrations
    .filter((item) => item.category === 'Monetization')
    .map((item) => ({
      key: item.key,
      label: item.label,
      configured: item.configured,
      hint: item.hint,
    }));

  const configured = revenueChecks.filter((item) => item.configured).length;
  const readiness = revenueChecks.length
    ? Math.round((configured / revenueChecks.length) * 100)
    : 0;
  const adsenseReady = revenueChecks.some(
    (item) => item.key === 'NEXT_PUBLIC_ADSENSE_CLIENT' && item.configured,
  );
  const affiliateReady = revenueChecks.some(
    (item) => item.key.startsWith('NEXT_PUBLIC_AFFILIATE_') && item.configured,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Revenue & Monetization</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">Monetization Center</h1>
          <p className="mt-1 text-sm text-gray-500">Ads, affiliate links aur sponsored placements ko ek safe dashboard se manage karein.</p>
        </div>
        <Link
          href="/affiliate-disclosure"
          target="_blank"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Disclosure page <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Revenue setup readiness</p>
              <p className="mt-1 text-4xl font-black text-gray-950">{readiness}%</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <BadgeDollarSign className="h-7 w-7" />
            </div>
          </div>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${readiness}%` }} />
          </div>
          <p className="mt-3 text-xs text-gray-500">{configured} of {revenueChecks.length} monetization integrations configured.</p>
        </section>

        <StatusCard
          title="Google AdSense"
          ready={adsenseReady}
          detail={adsenseReady ? 'Publisher ID configured' : 'Publisher ID abhi missing hai'}
          icon={Megaphone}
        />
        <StatusCard
          title="Affiliate partners"
          ready={affiliateReady}
          detail={affiliateReady ? 'Kam az kam ek partner configured' : 'Koi affiliate URL configured nahi'}
          icon={MousePointerClick}
        />
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-950">Environment setup</h2>
            <p className="mt-1 text-sm text-gray-500">Secret values expose kiye baghair configuration status.</p>
          </div>
          <Link href="/admin/launch-center" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Open Launch Center</Link>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {revenueChecks.map((item) => (
            <div key={item.key} className="flex gap-3 rounded-xl border border-gray-100 p-4">
              {item.configured ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                <p className="mt-1 text-xs text-gray-500">{item.hint}</p>
                <code className="mt-2 block overflow-x-auto rounded-lg bg-gray-50 px-2 py-1.5 text-[11px] text-gray-600">{item.key}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <ActionCard
          title="Sponsor campaigns"
          description="Sponsored banners, impressions, clicks aur active/paused campaigns manage karein."
          href="/admin/sponsors"
          action="Manage sponsors"
          icon={HandCoins}
        />
        <ActionCard
          title="Revenue analytics"
          description="Affiliate clicks, sponsor impressions aur store-wise performance dekhein."
          href="/admin/analytics"
          action="Open analytics"
          icon={MousePointerClick}
        />
        <ActionCard
          title="Site placement settings"
          description="Homepage sponsor section aur public website settings configure karein."
          href="/admin/settings"
          action="Open settings"
          icon={Megaphone}
        />
      </div>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-blue-700" />
          <div>
            <h2 className="font-bold text-blue-950">Safe monetization rules</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-blue-900">
              <li>• Affiliate link ko editorial rating ya ranking par asar nahi dalna chahiye.</li>
              <li>• Sponsored content aur paid placements ko clear label karein.</li>
              <li>• AdSense approval se pehle privacy, contact aur disclosure pages live rakhein.</li>
              <li>• Empty ad slots ko production UI mein reserve na karein jab tak IDs configured na hon.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  title,
  ready,
  detail,
  icon: Icon,
}: {
  title: string;
  ready: boolean;
  detail: string;
  icon: React.ElementType;
}) {
  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <Icon className={`h-6 w-6 ${ready ? 'text-emerald-600' : 'text-amber-600'}`} />
      <p className="mt-3 text-sm font-semibold text-gray-900">{title}</p>
      <p className={`mt-1 text-xl font-black ${ready ? 'text-emerald-700' : 'text-amber-700'}`}>{ready ? 'Ready' : 'Setup required'}</p>
      <p className="mt-2 text-xs text-gray-600">{detail}</p>
    </section>
  );
}

function ActionCard({
  title,
  description,
  href,
  action,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
  icon: React.ElementType;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-700">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 font-bold text-gray-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700">
        {action} <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
