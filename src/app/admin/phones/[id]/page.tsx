'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/lib/useAdmin';
import { formatPrice } from '@/components/shared/formatPrice';

function ScoreBar({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="score-bar h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-700 ease-out" style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold w-8 text-right">{score}</span>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-gray-900 text-right max-w-[60%]">{value || '—'}</span>
    </div>
  );
}

export default function AdminPhoneViewPage() {
  useAdmin();
  const { id } = useParams();
  const [phone, setPhone] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/phones/${id}`, { credentials: 'include' })
      .then(r => r.json()).then(d => { setPhone(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-12 rounded-xl" />)}</div>;
  if (!phone) return <div className="text-center py-12 text-muted-foreground">Phone not found</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/phones" className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"><ChevronLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">{phone.brand?.name} {phone.modelName}</h1>
            <p className="text-xs text-muted-foreground">{phone.slug} · {phone.releaseDate || 'No date'}</p>
          </div>
        </div>
        <Link href={`/admin/phones/${id}/edit`} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"><Edit className="w-4 h-4" /> Edit</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-4">
          <div className="card-premium p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Scores & Rating</h3>
            {[['Camera', phone.cameraScore], ['Performance', phone.performanceScore], ['Battery', phone.batteryScore], ['Display', phone.displayScore], ['Value', phone.valueScore]].map(([l, v]) => <ScoreBar key={l as string} score={v || 0} label={l as string} />)}
            <div className="pt-2 border-t border-gray-100"><ScoreBar score={phone.overallRating || 0} label="Overall" /></div>
          </div>
          <div className="card-premium p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Status & Flags</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">PTA Status</span><Badge className={phone.ptaApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' : ''}>{phone.ptaStatus}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Featured</span><span className={phone.featured ? 'text-emerald-600 font-medium' : 'text-gray-400'}>{phone.featured ? 'Yes' : 'No'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Trending</span><span className={phone.trending ? 'text-blue-600 font-medium' : 'text-gray-400'}>{phone.trending ? 'Yes' : 'No'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Upcoming</span><span className={phone.upcoming ? 'text-purple-600 font-medium' : 'text-gray-400'}>{phone.upcoming ? 'Yes' : 'No'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-bold text-blue-600">{phone.pricePKR > 0 ? formatPrice(phone.pricePKR) : 'Not set'}</span></div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {phone.description && <div className="card-premium p-5"><h3 className="text-sm font-bold text-gray-900 mb-2">Description</h3><p className="text-sm text-gray-600 leading-relaxed">{phone.description}</p></div>}
          {phone.specs && <div className="card-premium p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Specifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              {phone.specs.display && <SpecRow label="Display" value={phone.specs.display} />}
              {phone.specs.displayType && <SpecRow label="Display Type" value={phone.specs.displayType} />}
              {phone.specs.resolution && <SpecRow label="Resolution" value={phone.specs.resolution} />}
              {phone.specs.refreshRate && <SpecRow label="Refresh Rate" value={phone.specs.refreshRate} />}
              {phone.specs.chipset && <SpecRow label="Chipset" value={phone.specs.chipset} />}
              {phone.specs.cpu && <SpecRow label="CPU" value={phone.specs.cpu} />}
              {phone.specs.gpu && <SpecRow label="GPU" value={phone.specs.gpu} />}
              {phone.specs.ram && <SpecRow label="RAM" value={phone.specs.ram} />}
              {phone.specs.storage && <SpecRow label="Storage" value={phone.specs.storage} />}
              {phone.specs.mainCamera && <SpecRow label="Main Camera" value={phone.specs.mainCamera} />}
              {phone.specs.mainCameraSensor && <SpecRow label="Camera Sensor" value={phone.specs.mainCameraSensor} />}
              {phone.specs.selfieCamera && <SpecRow label="Selfie" value={phone.specs.selfieCamera} />}
              {phone.specs.videoRecording && <SpecRow label="Video" value={phone.specs.videoRecording} />}
              {phone.specs.battery && <SpecRow label="Battery" value={phone.specs.battery} />}
              {phone.specs.chargingSpeed && <SpecRow label="Charging" value={phone.specs.chargingSpeed} />}
              {phone.specs.weight && <SpecRow label="Weight" value={phone.specs.weight} />}
              {phone.specs.dimensions && <SpecRow label="Dimensions" value={phone.specs.dimensions} />}
              {phone.specs.build && <SpecRow label="Build" value={phone.specs.build} />}
              {phone.specs.os && <SpecRow label="OS" value={`${phone.specs.os} ${phone.specs.osVersion || ''}`.trim()} />}
              {phone.specs.network && <SpecRow label="Network" value={phone.specs.network} />}
              {phone.specs.fiveG && <SpecRow label="5G" value={phone.specs.fiveG} />}
              {phone.specs.wifi && <SpecRow label="WiFi" value={phone.specs.wifi} />}
              {phone.specs.bluetooth && <SpecRow label="Bluetooth" value={phone.specs.bluetooth} />}
              {phone.specs.nfc && <SpecRow label="NFC" value={phone.specs.nfc} />}
              {phone.specs.fingerprint && <SpecRow label="Fingerprint" value={phone.specs.fingerprint} />}
              {phone.specs.colors && <SpecRow label="Colors" value={phone.specs.colors} />}
            </div>
          </div>}
          {phone.benchmarks && (phone.benchmarks.antutu || phone.benchmarks.geekbenchSingle) && <div className="card-premium p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Benchmarks</h3>
            <div className="grid grid-cols-3 gap-4">
              {phone.benchmarks.antutu > 0 && <div className="text-center p-3 bg-gray-50 rounded-xl"><p className="text-lg font-bold text-gray-900">{phone.benchmarks.antutu.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">AnTuTu</p></div>}
              {phone.benchmarks.geekbenchSingle > 0 && <div className="text-center p-3 bg-gray-50 rounded-xl"><p className="text-lg font-bold text-gray-900">{phone.benchmarks.geekbenchSingle.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Geekbench Single</p></div>}
              {phone.benchmarks.geekbenchMulti > 0 && <div className="text-center p-3 bg-gray-50 rounded-xl"><p className="text-lg font-bold text-gray-900">{phone.benchmarks.geekbenchMulti.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Geekbench Multi</p></div>}
            </div>
          </div>}
          {phone.prices && phone.prices.length > 0 && <div className="card-premium p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Store Prices</h3>
            <div className="space-y-2">{phone.prices.map((pr: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm font-medium text-gray-900">{pr.storeName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-blue-600">{pr.price > 0 ? formatPrice(pr.price) : '—'}</span>
                  <Badge className={pr.inStock ? 'bg-emerald-50 text-emerald-700 text-[10px]' : 'bg-red-50 text-red-700 text-[10px]'}>{pr.inStock ? 'In Stock' : 'Out of Stock'}</Badge>
                </div>
              </div>
            ))}</div>
          </div>}
          {phone.pros && <div className="card-premium p-5"><h3 className="text-sm font-bold text-gray-900 mb-2">Pros</h3><p className="text-sm text-gray-600">{phone.pros}</p></div>}
          {phone.cons && <div className="card-premium p-5"><h3 className="text-sm font-bold text-gray-900 mb-2">Cons</h3><p className="text-sm text-gray-600">{phone.cons}</p></div>}
          {phone.reviewSummary && <div className="card-premium p-5"><h3 className="text-sm font-bold text-gray-900 mb-2">Review Summary</h3><p className="text-sm text-gray-600">{phone.reviewSummary}</p></div>}
        </div>
      </div>
    </div>
  );
}