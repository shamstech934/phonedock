'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Star, ChevronRight, Smartphone, Camera, Battery, Cpu, Trophy,
  Monitor, Wifi, Check, Minus, GitCompare, Shield, BarChart3,
  Share2, ChevronLeft, ExternalLink, AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { PhoneCard } from '@/components/shared/PhoneCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { formatPrice } from '@/components/shared/formatPrice';
import type { Phone } from '@/components/shared/types';

function ScoreBar({ score, label, mini }: { score: number; label: string; mini?: boolean }) {
  if (mini) {
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
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{score}/100</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="score-bar h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-700 ease-out" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function PhoneDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string>('');
  const [data, setData] = useState<{ phone: Phone; related: Phone[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('specs');
  const [activeImage, setActiveImage] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    params.then(p => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/phones/${slug}`).then(r => r.json()).then(d => { if (!cancelled) { setData(d); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: data?.phone?.modelName || '', url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setShareOpen(true);
      setTimeout(() => setShareOpen(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
            <div className="skeleton-shimmer h-6 w-64 rounded-lg" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="skeleton-shimmer aspect-square rounded-2xl" />
                <div className="skeleton-shimmer h-48 rounded-2xl" />
              </div>
              <div className="lg:col-span-2 space-y-4">
                <div className="skeleton-shimmer h-8 w-3/4 rounded-lg" />
                <div className="skeleton-shimmer h-4 w-full rounded-lg" />
                <div className="skeleton-shimmer h-32 rounded-2xl" />
                <div className="skeleton-shimmer h-64 rounded-2xl" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!data?.phone) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 py-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
              <Smartphone className="w-10 h-10 text-gray-300" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Phone not found</h2>
            <p className="text-sm text-muted-foreground mt-2">The phone you&apos;re looking for doesn&apos;t exist.</p>
            <Button variant="outline" className="mt-6 rounded-xl" asChild><Link href="/phones">Browse All Phones</Link></Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const { phone, related } = data;
  const p = phone;

  const images = p.images && p.images.length > 0 ? p.images : p.thumbnail ? [{ id: 'thumb', url: p.thumbnail, altText: p.modelName, sortOrder: 0 }] : [];

  const specGroups = [
    { title: 'Display & Design', icon: Monitor, specs: [
      { label: 'Display', value: p.specs?.display }, { label: 'Type', value: p.specs?.displayType }, { label: 'Resolution', value: p.specs?.resolution },
      { label: 'Refresh Rate', value: p.specs?.refreshRate }, { label: 'Protection', value: p.specs?.protection }, { label: 'Brightness', value: p.specs?.brightness },
      { label: 'Dimensions', value: p.specs?.dimensions }, { label: 'Weight', value: p.specs?.weight }, { label: 'Build', value: p.specs?.build },
      { label: 'Colors', value: p.specs?.colors }, { label: 'IP Rating', value: p.specs?.ipRating },
    ]},
    { title: 'Performance', icon: Cpu, specs: [
      { label: 'Chipset', value: p.specs?.chipset }, { label: 'CPU', value: p.specs?.cpu }, { label: 'GPU', value: p.specs?.gpu },
      { label: 'Process', value: p.specs?.process }, { label: 'RAM', value: p.specs?.ram }, { label: 'RAM Type', value: p.specs?.ramType },
      { label: 'Storage', value: p.specs?.storage }, { label: 'Card Slot', value: p.specs?.cardSlot },
    ]},
    { title: 'Camera', icon: Camera, specs: [
      { label: 'Main Camera', value: p.specs?.mainCamera }, { label: 'Sensor', value: p.specs?.mainCameraSensor }, { label: 'Aperture', value: p.specs?.aperture },
      { label: 'OIS', value: p.specs?.ois }, { label: 'EIS', value: p.specs?.eis }, { label: 'Ultrawide', value: p.specs?.ultrawide },
      { label: 'Telephoto', value: p.specs?.telephoto }, { label: 'Zoom', value: p.specs?.zoom }, { label: 'Features', value: p.specs?.cameraFeatures },
      { label: 'Video', value: p.specs?.videoRecording }, { label: 'Selfie', value: p.specs?.selfieCamera }, { label: 'Selfie Video', value: p.specs?.selfieVideo },
    ]},
    { title: 'Battery & Charging', icon: Battery, specs: [
      { label: 'Capacity', value: p.specs?.battery }, { label: 'Charging', value: p.specs?.charging }, { label: 'Charging Speed', value: p.specs?.chargingSpeed },
      { label: 'Wireless Charging', value: p.specs?.wirelessCharge }, { label: 'Wireless Speed', value: p.specs?.wirelessSpeed }, { label: 'Reverse Charge', value: p.specs?.reverseCharge },
    ]},
    { title: 'Connectivity', icon: Wifi, specs: [
      { label: 'Network', value: p.specs?.network }, { label: '5G', value: p.specs?.fiveG }, { label: 'WiFi', value: p.specs?.wifi },
      { label: 'Bluetooth', value: p.specs?.bluetooth }, { label: 'NFC', value: p.specs?.nfc }, { label: 'USB', value: p.specs?.usb },
    ]},
    { title: 'Features & OS', icon: Smartphone, specs: [
      { label: 'OS', value: `${p.specs?.os || ''} ${p.specs?.osVersion || ''}`.trim() || undefined }, { label: 'UI', value: p.specs?.osUI }, { label: 'Update Policy', value: p.specs?.updatePolicy },
      { label: 'Fingerprint', value: p.specs?.fingerprint }, { label: 'Face Unlock', value: p.specs?.faceUnlock }, { label: 'Sensors', value: p.specs?.sensors },
      { label: 'Special Features', value: p.specs?.specialFeatures },
    ]},
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5 flex-wrap">
            <Link href="/phones" className="hover:text-blue-500 transition-colors flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Phones</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href={`/brands/${p.brand?.slug}`} className="hover:text-blue-500 transition-colors">{p.brand?.name}</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-medium text-gray-900">{p.modelName}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Images & Info */}
            <div className="lg:col-span-1 space-y-4">
              {/* Image Gallery */}
              <div className="card-premium overflow-hidden">
                <div className="bg-[#F8FAFC] aspect-square flex items-center justify-center p-8 relative">
                  {images.length > 0 ? (
                    <Image src={images[activeImage]?.url || images[0].url} alt={images[activeImage]?.altText || p.modelName} width={300} height={300} className="object-contain" unoptimized />
                  ) : (
                    <div className="w-32 h-32 rounded-3xl bg-gray-100 flex items-center justify-center">
                      <Smartphone className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                  {shareOpen && (
                    <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg animate-fade-in flex items-center gap-1">
                      <Check className="w-3 h-3" /> Link copied!
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar">
                    {images.map((img, i) => (
                      <button key={img.id} onClick={() => setActiveImage(i)} className={`w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-colors ${i === activeImage ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}>
                        <Image src={img.url} alt={img.altText || ''} width={64} height={64} className="object-contain w-full h-full p-1" unoptimized />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Price & Quick Info */}
              <div className="card-premium p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Price in Pakistan</span>
                  <span className="text-xl font-bold text-blue-600">{formatPrice(p.pricePKR)}</span>
                </div>
                <Separator className="bg-gray-100" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">PTA Status</span>
                  <Badge className={p.ptaApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 font-medium' : 'bg-gray-100 text-gray-600 font-medium'}>
                    <Shield className="w-3 h-3 mr-1" /> {p.ptaStatus}
                  </Badge>
                </div>
                <Separator className="bg-gray-100" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Release Date</span>
                  <span className="text-sm font-medium text-gray-900">{p.releaseDate ? new Date(p.releaseDate).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
                </div>
                {p.specs?.colors && (
                  <>
                    <Separator className="bg-gray-100" />
                    <div>
                      <span className="text-sm text-muted-foreground">Colors</span>
                      <p className="text-sm mt-1 font-medium text-gray-900">{p.specs.colors}</p>
                    </div>
                  </>
                )}
                <Separator className="bg-gray-100" />
                <div className="flex gap-2">
                  <Link href={`/compare?ids=${p.id}`} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-xl h-11 text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-500/25">
                    <GitCompare className="w-4 h-4" /> Compare
                  </Link>
                  <button onClick={handleShare} className="h-11 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors flex items-center justify-center">
                    <Share2 className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <a href={`mailto:info@phonedock.pk?subject=Incorrect info: ${p.modelName}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-500 transition-colors justify-center">
                  <AlertTriangle className="w-3 h-3" /> Report incorrect information
                </a>
              </div>

              {/* Store Prices */}
              {p.prices && p.prices.length > 0 && (
                <div className="card-premium p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Best Prices</h3>
                  <div className="space-y-2">
                    {p.prices.map(pr => (
                      <div key={pr.id} className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC]">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{pr.storeName}</p>
                          <p className="text-[10px] mt-0.5 flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${pr.inStock ? 'bg-emerald-500' : 'bg-red-400'}`} />
                            <span className={pr.inStock ? 'text-emerald-600' : 'text-red-500'}>{pr.inStock ? 'In Stock' : 'Out of Stock'}</span>
                          </p>
                        </div>
                        {pr.url ? (
                          <a href={pr.url} target="_blank" rel="noopener noreferrer" className="font-bold text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                            {formatPrice(pr.price)} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="font-bold text-sm text-blue-600">{formatPrice(pr.price)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Details */}
            <div className="lg:col-span-2 space-y-5">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">{p.brand?.name}</p>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">{p.modelName}</h1>
                {p.description && <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{p.description}</p>}
              </div>

              {/* Quick Verdict */}
              {p.reviewVerdict && (
                <div className="bg-white rounded-2xl border border-blue-100 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/25">
                          <div className="text-center">
                            <span className="text-xl font-extrabold">{p.overallRating}</span>
                            <span className="text-[10px] block opacity-70">/ 10</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Trophy className="w-4 h-4 text-blue-500" />
                            <h3 className="font-bold text-sm sm:text-base text-gray-900">Quick Verdict</h3>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{p.reviewVerdict}</p>
                        </div>
                      </div>
                      <div className="sm:ml-auto sm:w-64 space-y-2">
                        <ScoreBar score={p.cameraScore} label="Camera" mini />
                        <ScoreBar score={p.performanceScore} label="Performance" mini />
                        <ScoreBar score={p.displayScore} label="Display" mini />
                        <ScoreBar score={p.batteryScore} label="Battery" mini />
                        <ScoreBar score={p.valueScore} label="Value" mini />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Camera Details */}
              {(p.specs?.mainCamera || p.specs?.mainCameraSensor) && (
                <div className="card-premium p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Camera className="w-4 h-4 text-blue-600" /></div>
                    Camera Details
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Sensor', value: p.specs?.mainCameraSensor },
                      { label: 'Aperture', value: p.specs?.aperture },
                      { label: 'OIS', value: p.specs?.ois },
                      { label: 'EIS', value: p.specs?.eis },
                      { label: 'Zoom', value: p.specs?.zoom },
                      { label: 'Video', value: p.specs?.videoRecording },
                      { label: 'Features', value: p.specs?.cameraFeatures },
                    ].filter(t => t.value && t.value !== 'No' && t.value !== '').map(tile => (
                      <div key={tile.label} className={`p-3 rounded-xl bg-[#F8FAFC] ${tile.label === 'Features' ? 'col-span-2 sm:col-span-3' : ''}`}>
                        <p className="text-xs text-muted-foreground">{tile.label}</p>
                        <p className="text-sm font-semibold mt-0.5 text-gray-900">{tile.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Performance Details */}
              {(p.specs?.chipset || p.specs?.cpu) && (
                <div className="card-premium p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Cpu className="w-4 h-4 text-blue-600" /></div>
                    Performance
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Process Node', value: p.specs?.process, span: '' },
                      { label: 'Chipset', value: p.specs?.chipset, span: 'sm:col-span-2' },
                      { label: 'CPU', value: p.specs?.cpu, span: 'sm:col-span-2' },
                      { label: 'GPU', value: p.specs?.gpu, span: 'sm:col-span-2' },
                      { label: 'RAM', value: p.specs?.ram, span: '' },
                      { label: 'RAM Type', value: p.specs?.ramType, span: '' },
                      { label: 'Storage', value: p.specs?.storage, span: '' },
                    ].filter(t => t.value && t.value !== 'No' && t.value !== '').map(tile => (
                      <div key={tile.label} className={`p-3 rounded-xl bg-[#F8FAFC] ${tile.span}`}>
                        <p className="text-xs text-muted-foreground">{tile.label}</p>
                        <p className="text-sm font-semibold mt-0.5 text-gray-900">{tile.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Battery Details */}
              {p.specs?.battery && (
                <div className="card-premium p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Battery className="w-4 h-4 text-blue-600" /></div>
                    Battery & Charging
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Capacity', value: p.specs?.battery },
                      { label: 'Charging Speed', value: p.specs?.chargingSpeed },
                      { label: 'Wireless Charging', value: p.specs?.wirelessCharge },
                      { label: 'Wireless Speed', value: p.specs?.wirelessSpeed },
                      { label: 'Reverse Charge', value: p.specs?.reverseCharge },
                      ...(p.benchmarks?.videoPlayback ? [{ label: 'Video Playback', value: p.benchmarks.videoPlayback }] : []),
                      ...(p.benchmarks?.gamingBattery ? [{ label: 'Gaming Battery', value: p.benchmarks.gamingBattery }] : []),
                      ...(p.benchmarks?.browsingBattery ? [{ label: 'Browsing Battery', value: p.benchmarks.browsingBattery }] : []),
                    ].filter(t => t.value && t.value !== 'No' && t.value !== '').map(tile => (
                      <div key={tile.label} className="p-3 rounded-xl bg-[#F8FAFC]">
                        <p className="text-xs text-muted-foreground">{tile.label}</p>
                        <p className="text-sm font-semibold mt-0.5 text-gray-900">{tile.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ratings & Scores */}
              <div className="card-premium p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Ratings & Scores</h3>
                  <div className="flex items-center gap-1.5">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    <span className="text-2xl font-extrabold text-gray-900">{p.overallRating}</span>
                    <span className="text-sm text-muted-foreground">/ 10</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <ScoreBar score={p.performanceScore} label="Performance" />
                  <ScoreBar score={p.cameraScore} label="Camera" />
                  <ScoreBar score={p.batteryScore} label="Battery" />
                  <ScoreBar score={p.displayScore} label="Display" />
                  <ScoreBar score={p.valueScore} label="Value" />
                </div>
              </div>

              {/* Tabs: Specs / Benchmarks / Review */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="glass-filter w-full justify-start rounded-2xl p-1.5 h-auto">
                  <TabsTrigger value="specs" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-blue-500/25 rounded-xl text-xs sm:text-sm">Specifications</TabsTrigger>
                  <TabsTrigger value="benchmarks" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-blue-500/25 rounded-xl text-xs sm:text-sm">Benchmarks</TabsTrigger>
                  <TabsTrigger value="review" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-blue-500/25 rounded-xl text-xs sm:text-sm">Review</TabsTrigger>
                </TabsList>

                <TabsContent value="specs" className="mt-5 space-y-4">
                  {specGroups.map(group => {
                    const validSpecs = group.specs.filter(s => s.value && s.value !== 'No' && s.value !== '' && s.value.trim() !== '');
                    if (validSpecs.length === 0) return null;
                    return (
                      <div key={group.title} className="card-premium overflow-hidden">
                        <div className="px-4 py-3 flex items-center gap-2.5 border-b border-gray-50">
                          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/20">
                            <group.icon className="w-4 h-4 text-white" />
                          </div>
                          <h3 className="text-sm font-semibold text-gray-900">{group.title}</h3>
                        </div>
                        <div className="divide-y divide-gray-50 px-4 py-1">
                          {validSpecs.map(s => (
                            <div key={s.label} className="flex justify-between py-3 text-sm">
                              <span className="text-muted-foreground">{s.label}</span>
                              <span className="font-medium text-right max-w-[60%] text-gray-900">{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>

                <TabsContent value="benchmarks" className="mt-5">
                  <div className="card-premium p-5 space-y-6">
                    {p.benchmarks ? (<>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { label: 'AnTuTu', value: p.benchmarks.antutu.toLocaleString(), max: 2500000, color: 'from-blue-500 to-blue-600' },
                          { label: 'Geekbench Single', value: p.benchmarks.geekbenchSingle.toLocaleString(), max: 3500, color: 'from-emerald-500 to-green-600' },
                          { label: 'Geekbench Multi', value: p.benchmarks.geekbenchMulti.toLocaleString(), max: 8000, color: 'from-violet-500 to-purple-600' },
                        ].map(b => (
                          <div key={b.label} className="text-center p-5 rounded-2xl bg-[#F8FAFC] border border-gray-100">
                            <p className="text-xs text-muted-foreground mb-2 font-medium">{b.label}</p>
                            <p className="text-3xl font-extrabold text-gray-900">{b.value}</p>
                            <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full bg-gradient-to-r ${b.color} transition-all duration-700`} style={{ width: `${Math.min((parseInt(b.value.replace(/,/g, '')) / b.max) * 100, 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {p.benchmarks.gamingScore > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            { label: 'PUBG Mobile', value: p.benchmarks.pubgFps },
                            { label: 'COD Mobile', value: p.benchmarks.codMobileFps },
                            { label: 'Genshin Impact', value: p.benchmarks.genshinFps },
                          ].map(g => g.value ? (
                            <div key={g.label} className="p-4 rounded-2xl border border-gray-100 text-center bg-white">
                              <p className="text-xs text-muted-foreground font-medium">{g.label}</p>
                              <p className="text-lg font-bold mt-1.5 text-gray-900">{g.value}</p>
                            </div>
                          ) : null).filter(Boolean)}
                        </div>
                      )}
                    </>) : (
                      <div className="text-center py-16 text-muted-foreground">
                        <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No benchmark data available</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="review" className="mt-5 space-y-4">
                  <div className="card-premium p-5 space-y-5">
                    {p.reviewSummary && <p className="text-sm leading-relaxed text-gray-700">{p.reviewSummary}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {p.pros && (
                        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                          <h4 className="font-semibold text-emerald-700 text-sm mb-3 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/25"><Check className="w-3.5 h-3.5 text-white" /></div>
                            Pros
                          </h4>
                          <ul className="space-y-2">{p.pros.split(',').filter(Boolean).map((pro, i) => <li key={i} className="text-sm text-emerald-700 flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />{pro.trim()}</li>)}</ul>
                        </div>
                      )}
                      {p.cons && (
                        <div className="p-5 rounded-2xl bg-red-50 border border-red-100">
                          <h4 className="font-semibold text-red-700 text-sm mb-3 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-sm shadow-red-500/25"><Minus className="w-3.5 h-3.5 text-white" /></div>
                            Cons
                          </h4>
                          <ul className="space-y-2">{p.cons.split(',').filter(Boolean).map((con, i) => <li key={i} className="text-sm text-red-700 flex items-start gap-2"><Minus className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />{con.trim()}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Related Phones */}
              {related.length > 0 && (
                <section className="space-y-5 pt-4">
                  <SectionHeader title={`More from ${p.brand?.name}`} icon={Smartphone} />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {related.slice(0, 6).map(r => <PhoneCard key={r.id} phone={r} />)}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}