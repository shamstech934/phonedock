'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

export interface HomepageSmartFilterItem { id: string; label: string; param: string; value: string; enabled: boolean; }
export interface HomepageSmartFilterGroup { id: string; title: string; subtitle?: string; enabled: boolean; items: HomepageSmartFilterItem[]; }

function hrefFor(item: HomepageSmartFilterItem) {
  const query = new URLSearchParams();
  if (item.param === 'screenRange') {
    const [min, max] = item.value.split('|');
    if (min) query.set('screenMin', min);
    if (max) query.set('screenMax', max);
  } else query.set(item.param, item.value);
  return `/phones?${query.toString()}`;
}

export function HomeSmartFilterSidebar({ groups }: { groups: HomepageSmartFilterGroup[] }) {
  const visible = groups.filter(group => group.enabled && group.items.some(item => item.enabled));
  const [openId, setOpenId] = useState(visible[0]?.id || '');
  if (!visible.length) return null;
  return <aside className="card-premium overflow-hidden p-2.5" aria-label="Smart phone filters">
    <div className="mb-2 flex items-center gap-2 px-1"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50"><SlidersHorizontal className="h-5 w-5 text-cyan-600" /></div><div><h2 className="text-sm font-bold text-gray-900 dark:text-white">Find phones by specs</h2><p className="text-[11px] text-muted-foreground">RAM, camera, screen and more</p></div></div>
    <div className="space-y-1.5">{visible.map(group => {
      const open = openId === group.id;
      return <section key={group.id} className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/55">
        <button type="button" onClick={() => setOpenId(open ? '' : group.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"><span><strong className="block text-xs text-slate-800">{group.title}</strong>{group.subtitle && <small className="block text-[10px] text-slate-500">{group.subtitle}</small>}</span><ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} /></button>
        {open && <nav className="grid grid-cols-2 gap-1.5 border-t border-slate-100 p-2" aria-label={group.title}>{group.items.filter(item => item.enabled).map(item => <Link key={item.id} href={hrefFor(item)} className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">{item.label}</Link>)}</nav>}
      </section>;
    })}</div>
    <Link href="/phones" className="mt-2.5 flex min-h-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100">Open all phone filters</Link>
  </aside>;
}
