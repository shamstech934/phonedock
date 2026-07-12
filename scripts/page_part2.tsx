// ============ COMPARE PAGE ============
function ComparePage({ params, onNavigate }: { params: Record<string, string>; onNavigate: (p: string) => void }) {
  const [allPhones, setAllPhones] = useState<Phone[]>([]);
  const [selected, setSelected] = useState<Phone[]>([]);
  const [search, setSearch] = useState('');
  const [compared, setCompared] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/phones').then(r => r.json()).then(data => {
      if (cancelled) return;
      const phones: Phone[] = data.phones || [];
      setAllPhones(phones);
      if (params.ids) {
        const ids = params.ids.split(',');
        const pre = phones.filter(p => ids.includes(p.id));
        setSelected(pre.slice(0, 4));
        if (pre.length >= 2) setCompared(true);
      }
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = allPhones.filter(p => p.modelName.toLowerCase().includes(search.toLowerCase()));
  const isSelected = (id: string) => selected.some(p => p.id === id);

  const togglePhone = (phone: Phone) => {
    if (isSelected(phone.id)) { setSelected(prev => prev.filter(p => p.id !== phone.id)); setCompared(false); }
    else if (selected.length < 4) { setSelected(prev => [...prev, phone]); setCompared(false); }
  };

  const getWinner = (key: 'cameraScore' | 'performanceScore' | 'batteryScore' | 'valueScore') => {
    let best = selected[0]; let max = 0;
    selected.forEach(p => { if (p[key] > max) { max = p[key]; best = p; } });
    return best;
  };

  const catData = [
    { label: 'Camera', key: 'cameraScore' as const, icon: Camera, gradient: 'from-blue-500 to-blue-600' },
    { label: 'Performance', key: 'performanceScore' as const, icon: Cpu, gradient: 'from-purple-500 to-purple-600' },
    { label: 'Battery', key: 'batteryScore' as const, icon: Battery, gradient: 'from-emerald-500 to-green-600' },
    { label: 'Value', key: 'valueScore' as const, icon: Tag, gradient: 'from-amber-500 to-orange-500' },
  ];

  const metrics = [
    { label: 'Overall', get: (p: Phone) => p.overallRating * 10 },
    { label: 'Camera', get: (p: Phone) => p.cameraScore },
    { label: 'Performance', get: (p: Phone) => p.performanceScore },
    { label: 'Battery', get: (p: Phone) => p.batteryScore },
    { label: 'Value', get: (p: Phone) => p.valueScore },
    { label: 'Display', get: (p: Phone) => p.displayScore },
  ];

  const specRows = [
    { label: 'Display', get: (p: Phone) => p.specs?.display },
    { label: 'Processor', get: (p: Phone) => p.specs?.chipset },
    { label: 'RAM', get: (p: Phone) => p.specs?.ram },
    { label: 'Storage', get: (p: Phone) => p.specs?.storage },
    { label: 'Main Camera', get: (p: Phone) => p.specs?.mainCamera },
    { label: 'Battery', get: (p: Phone) => p.specs?.battery },
    { label: 'OS', get: (p: Phone) => [p.specs?.os, p.specs?.osVersion].filter(Boolean).join(' ') },
    { label: '5G', get: (p: Phone) => p.specs?.fiveG },
    { label: 'Fingerprint', get: (p: Phone) => p.specs?.fingerprint },
  ];

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6"><div className="skeleton-shimmer h-64 rounded-2xl" /><div className="skeleton-shimmer h-96 rounded-2xl mt-4" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Compare Phones</h1>

      {!compared ? (<>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input placeholder="Search phones to compare..." value={search} onChange={e => setSearch(e.target.value)} className="glass-search w-full pl-10 pr-4 h-11 rounded-xl text-sm bg-white/70 backdrop-blur-md border border-white/50 outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-gray-400 transition-all" />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
            {filtered.length === 0 && <div className="text-center py-10 text-sm text-muted-foreground">No phones found</div>}
            {filtered.map(p => (
              <label key={p.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F8FAFC] transition-colors">
                <input type="checkbox" checked={isSelected(p.id)} onChange={() => togglePhone(p)} disabled={!isSelected(p.id) && selected.length >= 4} className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500/30" />
                {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={36} height={36} className="w-9 h-9 object-contain rounded-lg bg-[#F8FAFC] p-0.5" unoptimized /> : <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center"><Smartphone className="w-4 h-4 text-gray-400" /></div>}
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate text-gray-900">{p.modelName}</p><p className="text-xs text-muted-foreground">{p.brand?.name} · {formatPrice(p.pricePKR)}</p></div>
                {isSelected(p.id) && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
              </label>
            ))}
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-1">Selected:</span>
            {selected.map(p => (
              <span key={p.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-full">
                {p.modelName}
                <button onClick={() => togglePhone(p)} className="hover:bg-blue-600 rounded-full p-0.5 transition-colors"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <button onClick={() => setCompared(true)} disabled={selected.length < 2} className="ml-auto bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-6 h-10 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-500/25 disabled:shadow-none flex items-center gap-2">
              <GitCompare className="w-4 h-4" /> Compare ({selected.length})
            </button>
          </div>
        )}
      </>) : (<>
        <button onClick={() => setCompared(false)} className="text-sm font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to picker
        </button>

        {/* Category Winners */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Trophy className="w-5 h-5 text-blue-500" /> Category Winners</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {catData.map(cat => {
              const winner = getWinner(cat.key);
              return (
                <div key={cat.label} className={`bg-gradient-to-br ${cat.gradient} rounded-2xl p-4 text-white relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3"><cat.icon className="w-5 h-5" /><span className="text-sm font-semibold">{cat.label}</span></div>
                    <p className="font-bold text-sm leading-snug">{winner?.modelName || 'N/A'}</p>
                    <p className="text-xs text-white/70 mt-1">{winner?.brand?.name}</p>
                    <p className="text-2xl font-extrabold mt-2">{winner?.[cat.key] || 0}<span className="text-sm font-medium text-white/70">/100</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Score Comparison */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 space-y-5">
          <h2 className="font-bold text-gray-900">Score Comparison</h2>
          {metrics.map(metric => {
            const scores = selected.map(p => ({ phone: p, score: metric.get(p) }));
            const maxScore = Math.max(...scores.map(s => s.score));
            const winnerId = scores.find(s => s.score === maxScore)?.phone.id;
            return (
              <div key={metric.label}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{metric.label}</p>
                <div className="space-y-2">
                  {scores.map(s => (
                    <div key={s.phone.id} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 w-28 sm:w-40 truncate shrink-0">{s.phone.modelName}</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${s.phone.id === winnerId ? 'bg-blue-500' : 'bg-gradient-to-r from-blue-400 to-cyan-400'}`} style={{ width: `${Math.max(s.score, 2)}%` }} />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 w-16 justify-end">
                        {s.phone.id === winnerId && <Trophy className="w-3.5 h-3.5 text-blue-500" />}
                        <span className={`text-xs font-bold ${s.phone.id === winnerId ? 'text-blue-600' : 'text-muted-foreground'}`}>{s.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* Specs Table */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100"><h2 className="font-bold text-gray-900">Specifications Comparison</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  <th className="sticky left-0 bg-[#F8FAFC] z-10 text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">Spec</th>
                  {selected.map(p => <th key={p.id} className="text-left px-4 py-3 text-xs font-semibold text-gray-900">{p.modelName}</th>)}
                </tr>
              </thead>
              <tbody>
                {specRows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}>
                    <td className="sticky left-0 z-10 px-4 py-3 font-medium text-muted-foreground bg-inherit">{row.label}</td>
                    {selected.map(p => <td key={p.id} className="px-4 py-3 text-gray-900">{row.get(p) || <span className="text-muted-foreground">—</span>}</td>)}
                  </tr>
                ))}
                <tr className="bg-white border-t border-gray-100">
                  <td className="sticky left-0 z-10 px-4 py-3 font-medium text-muted-foreground bg-white">Price</td>
                  {selected.map(p => <td key={p.id} className="px-4 py-3 font-bold text-blue-600">{formatPrice(p.pricePKR)}</td>)}
                </tr>
                <tr className="bg-[#F8FAFC]">
                  <td className="sticky left-0 z-10 px-4 py-3 font-medium text-muted-foreground bg-[#F8FAFC]">PTA</td>
                  {selected.map(p => <td key={p.id} className="px-4 py-3">{p.ptaApproved ? <span className="text-emerald-600 font-medium flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Approved</span> : <span className="text-muted-foreground">{p.ptaStatus}</span>}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </>)}
    </div>
  );
}

// ============ BRANDS PAGE ============
function BrandsPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/brands').then(r => r.json()).then(d => { setBrands(d.brands || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6"><div className="skeleton-shimmer h-8 w-48 rounded-lg mb-6" /><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{Array(8).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-40 rounded-2xl" />)}</div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">All Brands</h1>
        <p className="text-sm text-muted-foreground mt-1">{brands.length} brands in our database</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {brands.map(brand => (
          <div key={brand.id} className="phone-card bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/8 hover:border-blue-200" onClick={() => onNavigate(`/brand/${brand.slug}`)}>
            <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors">
              {brand.logo ? <Image src={brand.logo} alt={brand.name} width={40} height={40} className="object-contain" unoptimized /> : <Layers className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />}
            </div>
            <h3 className="font-bold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">{brand.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{brand._count?.phones || 0} phones</p>
            {brand.country && <p className="text-[10px] text-muted-foreground mt-0.5">{brand.country}</p>}
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 mt-3 transition-colors" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ BRAND DETAIL PAGE ============
function BrandDetailPage({ slug, onNavigate }: { slug: string; onNavigate: (p: string) => void }) {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/brands/${slug}`).then(r => r.json()).then(d => { if (!cancelled) { setBrand(d.brand || null); setPhones(d.phones || []); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6 space-y-4"><div className="skeleton-shimmer h-6 w-48 rounded-lg" /><div className="skeleton-shimmer h-32 rounded-2xl" /><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{Array(4).fill(0).map((_, i) => <PhoneCardSkeleton key={i} />)}</div></div>;

  if (!brand) return <div className="max-w-7xl mx-auto px-4 py-20 text-center"><Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-3" /><h2 className="text-xl font-bold text-gray-900">Brand not found</h2><Button variant="outline" className="mt-4 rounded-xl" onClick={() => onNavigate('/')}>Go Home</Button></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <button onClick={() => onNavigate('/')} className="hover:text-blue-500 transition-colors">Home</button><ChevronRight className="w-3.5 h-3.5" />
        <button onClick={() => onNavigate('/brands')} className="hover:text-blue-500 transition-colors">Brands</button><ChevronRight className="w-3.5 h-3.5" />
        <span className="font-medium text-gray-900">{brand.name}</span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            {brand.logo ? <Image src={brand.logo} alt={brand.name} width={40} height={40} className="object-contain" unoptimized /> : <Layers className="w-7 h-7 text-gray-400" />}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">{brand.name}</h1>
            <p className="text-sm text-muted-foreground">{brand.country && `${brand.country} · `}{brand._count?.phones || 0} phones</p>
            {brand.description && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{brand.description}</p>}
          </div>
        </div>
      </div>
      {phones.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {phones.map(p => <PhoneCard key={p.id} phone={p} />)}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground"><Smartphone className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="text-sm">No phones listed for this brand yet</p></div>
      )}
    </div>
  );
}

// ============ SEARCH PAGE ============
function SearchPage({ query, onNavigate }: { query: string; onNavigate: (p: string) => void }) {
  const [results, setResults] = useState<{ brands: Brand[]; phones: Phone[] }>({ brands: [], phones: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}`).then(r => r.json()).then(d => { if (!cancelled) { setResults({ brands: d.brands || [], phones: d.phones || [] }); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  const total = results.brands.length + results.phones.length;

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6"><div className="skeleton-shimmer h-8 w-64 rounded-lg mb-2" /><div className="skeleton-shimmer h-5 w-32 rounded-md mb-6" /><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{Array(6).fill(0).map((_, i) => <PhoneCardSkeleton key={i} />)}</div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Search Results for &ldquo;{query}&rdquo;</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} result{total !== 1 ? 's' : ''} found</p>
      </div>

      {results.brands.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Layers className="w-5 h-5 text-blue-500" /> Brands ({results.brands.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {results.brands.map(b => (
              <div key={b.id} className="phone-card bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/8 hover:border-blue-200 flex items-center gap-3" onClick={() => onNavigate(`/brand/${b.slug}`)}>
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                  {b.logo ? <Image src={b.logo} alt={b.name} width={28} height={28} className="object-contain" unoptimized /> : <Layers className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />}
                </div>
                <div><p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{b.name}</p><p className="text-[10px] text-muted-foreground">{b._count?.phones || 0} phones</p></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {results.phones.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Smartphone className="w-5 h-5 text-blue-500" /> Phones ({results.phones.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {results.phones.map(p => <PhoneCard key={p.id} phone={p} />)}
          </div>
        </section>
      )}

      {total === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Search className="w-14 h-14 mx-auto mb-4 opacity-15" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">No results found</h3>
          <p className="text-sm">Try a different search term</p>
          <Button variant="outline" className="mt-5 rounded-xl" onClick={() => onNavigate('/')}>Browse All Phones</Button>
        </div>
      )}
    </div>
  );
}

// ============ NEWS PAGE ============
function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news').then(r => r.json()).then(d => { setNews(d.news || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-6"><div className="skeleton-shimmer h-8 w-48 rounded-lg mb-2" /><div className="skeleton-shimmer h-5 w-64 rounded-md mb-6" /><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-56 rounded-2xl" />)}</div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">News & Updates</h1>
        <p className="text-sm text-muted-foreground mt-1">Latest smartphone news, leaks, and reviews</p>
      </div>
      {news.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {news.map(n => (
            <article key={n.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-600 font-medium">{n.category}</Badge>
                <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <h2 className="font-bold text-base text-gray-900 leading-snug mb-2 line-clamp-2">{n.title}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">{n.excerpt || n.content}</p>
              {n.author && <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1"><Users className="w-3 h-3" /> {n.author}</p>}
            </article>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground"><Newspaper className="w-14 h-14 mx-auto mb-4 opacity-15" /><h3 className="text-lg font-bold text-gray-900 mb-1">No news yet</h3><p className="text-sm">Check back later for updates</p></div>
      )}
    </div>
  );
}

// ============ ADMIN LOGIN PAGE ============
function AdminLoginPage({ onLogin }: { onLogin: (admin: AdminUser, token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (data.token) { onLogin(data.admin, data.token); } else { setError(data.error || 'Invalid credentials'); }
    } catch { setError('Connection failed. Try again.'); }
    setLoading(false);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-sm glass-modal rounded-2xl p-6 sm:p-8 shadow-xl shadow-blue-500/10">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to manage your phone database</p>
        </div>
        {error && <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-medium rounded-xl px-4 py-2.5 mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 transition-all bg-white" />
          <button type="submit" disabled={loading} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white h-11 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-blue-500/25">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-[10px] text-center text-muted-foreground/70 mt-4">Demo: admin@phonedock.pk / admin123</p>
      </div>
    </div>
  );
}

// ============ ADMIN DASHBOARD ============
function AdminDashboard({ token, admin, onNavigate, homeData }: { token: string | null; admin: AdminUser; onNavigate: (p: string) => void; homeData: HomeData | null }) {
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  const statCards = [
    { label: 'Total Phones', value: stats.totalPhones ?? homeData?.featured?.length ?? 0, icon: Smartphone, bg: 'bg-blue-50', iconColor: 'text-blue-500' },
    { label: 'Brands', value: stats.totalBrands ?? homeData?.brands?.length ?? 0, icon: Layers, bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
    { label: 'Trending', value: stats.trendingCount ?? homeData?.trending?.length ?? 0, icon: TrendingUp, bg: 'bg-red-50', iconColor: 'text-red-500' },
    { label: 'Featured', value: stats.featuredCount ?? homeData?.featured?.length ?? 0, icon: Star, bg: 'bg-amber-50', iconColor: 'text-amber-500' },
    { label: 'Avg Price', value: stats.avgPrice ? formatPrice(stats.avgPrice) : 'N/A', icon: Tag, bg: 'bg-violet-50', iconColor: 'text-violet-500' },
    { label: 'News', value: stats.newsCount ?? homeData?.news?.length ?? 0, icon: Newspaper, bg: 'bg-cyan-50', iconColor: 'text-cyan-500' },
  ];

  const quickActions = [
    { label: 'Phones', icon: Smartphone, hash: '/admin/phones' },
    { label: 'Brands', icon: Layers, hash: '/admin/brands' },
    { label: 'News', icon: Newspaper, hash: '/admin/news' },
    { label: 'Sponsors', icon: Star, hash: '/admin/sponsors' },
    { label: 'SEO', icon: Settings, hash: '/admin/dashboard' },
    { label: 'Images', icon: ImageIcon, hash: '/admin/dashboard' },
  ];

  const priceDist = stats.priceDistribution || [
    { range: 'Under 20K', count: 0 }, { range: '20K - 40K', count: 0 }, { range: '40K - 60K', count: 0 },
    { range: '60K - 100K', count: 0 }, { range: 'Above 100K', count: 0 },
  ];
  const maxPriceCount = Math.max(...priceDist.map((d: any) => d.count || 0), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">Welcome back, {admin.name || 'Admin'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s what&apos;s happening with PhoneDock</p>
        </div>
        <button onClick={() => onNavigate('/')} className="self-start bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 h-9 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
          <Eye className="w-4 h-4" /> View Site
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="card-premium bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md hover:shadow-black/5 transition-all duration-300">
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}><s.icon className={`w-4 h-4 ${s.iconColor}`} /></div>
            <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {quickActions.map(a => (
          <button key={a.label} onClick={() => onNavigate(a.hash)} className="card-premium bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 text-center hover:shadow-md hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 group">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-50 transition-colors"><a.icon className="w-5 h-5 text-gray-500 group-hover:text-blue-500 transition-colors" /></div>
            <p className="text-xs font-semibold text-gray-700">{a.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Price Distribution */}
        <div className="card-premium bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-500" /> Price Distribution</h3>
          <div className="space-y-3">
            {priceDist.map((d: any, i: number) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{d.range}</span><span className="font-semibold text-gray-900">{d.count || 0}</span></div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-700" style={{ width: `${((d.count || 0) / maxPriceCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card-premium bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" /> Recent Activity</h3>
          <div className="space-y-3">
            {(stats.recentActivity || []).slice(0, 6).map((log: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                  {log.action?.includes('delete') ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : log.action?.includes('update') ? <Edit className="w-3.5 h-3.5 text-amber-500" /> : <Plus className="w-3.5 h-3.5 text-emerald-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900">{log.details || log.action}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{log.admin?.name || 'Admin'} · {log.createdAt ? new Date(log.createdAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                </div>
              </div>
            ))}
            {(!stats.recentActivity || stats.recentActivity.length === 0) && <p className="text-xs text-muted-foreground text-center py-6">No recent activity</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ ADMIN PHONES PAGE ============
function AdminPhonesPage({ token }: { token: string | null }) {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/phones', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => { setPhones(d.phones || []); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-14 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">Manage Phones</h1>
        <span className="text-xs text-muted-foreground">{phones.length} phones</span>
      </div>
      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#F8FAFC] border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Brand</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">PTA</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {phones.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]/50'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={32} height={32} className="w-8 h-8 object-contain rounded-lg bg-gray-50 p-0.5" unoptimized /> : <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><Smartphone className="w-4 h-4 text-gray-400" /></div>}
                      <span className="font-medium text-gray-900 truncate max-w-[200px]">{p.modelName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.brand?.name}</td>
                  <td className="px-4 py-3 font-semibold text-blue-600">{formatPrice(p.pricePKR)}</td>
                  <td className="px-4 py-3">{p.ptaApproved ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50">Approved</Badge> : <Badge variant="secondary" className="text-[10px]">{p.ptaStatus}</Badge>}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /><span className="font-semibold">{p.overallRating}</span></div></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors"><Eye className="w-4 h-4" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-500 transition-colors"><Edit className="w-4 h-4" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Mobile Cards */}
      <div className="sm:hidden space-y-2">
        {phones.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
            {p.thumbnail ? <Image src={p.thumbnail} alt={p.modelName} width={40} height={40} className="w-10 h-10 object-contain rounded-lg bg-gray-50 p-0.5" unoptimized /> : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Smartphone className="w-5 h-5 text-gray-400" /></div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-gray-900">{p.modelName}</p>
              <p className="text-[10px] text-muted-foreground">{p.brand?.name} · {formatPrice(p.pricePKR)}</p>
            </div>
            <div className="flex items-center gap-0.5">
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Edit className="w-4 h-4" /></button>
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ ADMIN BRANDS PAGE ============
function AdminBrandsPage({ token }: { token: string | null }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/brands', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => { setBrands(d.brands || []); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-36 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">Manage Brands</h1>
        <span className="text-xs text-muted-foreground">{brands.length} brands</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {brands.map(brand => (
          <div key={brand.id} className="card-premium bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:shadow-black/5 transition-all duration-300">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                {brand.logo ? <Image src={brand.logo} alt={brand.name} width={32} height={32} className="object-contain" unoptimized /> : <Layers className="w-6 h-6 text-gray-400" />}
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900">{brand.name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{brand.slug}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{brand.country || 'N/A'}</span>
              <Badge variant="secondary" className="text-[10px]">{brand._count?.phones || 0} phones</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ ADMIN NEWS PAGE ============
function AdminNewsPage({ token }: { token: string | null }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/news', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => { setNews(d.news || []); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-20 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">Manage News</h1>
        <span className="text-xs text-muted-foreground">{news.length} articles</span>
      </div>
      <div className="space-y-2">
        {news.map(n => (
          <div key={n.id} className="card-premium bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-md hover:shadow-black/5 transition-all duration-300">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-gray-900 truncate">{n.title}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="secondary" className="text-[10px]">{n.category}</Badge>
                <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {n.published ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50"><Check className="w-3 h-3 mr-0.5" /> Published</Badge> : <Badge variant="secondary" className="text-[10px]">Draft</Badge>}
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-500 transition-colors"><Edit className="w-4 h-4" /></button>
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {news.length === 0 && <div className="text-center py-16 text-muted-foreground"><Newspaper className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No news articles yet</p></div>}
      </div>
    </div>
  );
}

// ============ ADMIN SPONSORS PAGE ============
function AdminSponsorsPage({ token }: { token: string | null }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/sponsors', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => { setSponsors(d.sponsors || []); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">Manage Sponsors</h1>
        <span className="text-xs text-muted-foreground">{sponsors.length} sponsors</span>
      </div>
      <div className="space-y-2">
        {sponsors.map(s => (
          <div key={s.id} className="card-premium bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-md hover:shadow-black/5 transition-all duration-300">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                {s.image ? <Image src={s.image} alt={s.name} width={28} height={28} className="object-contain" unoptimized /> : <Star className="w-5 h-5 text-gray-400" />}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-gray-900 truncate">{s.name}</h3>
                <p className="text-[10px] text-muted-foreground">{s.position || 'No position'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-muted-foreground">Clicks</p>
                <p className="text-xs font-semibold text-gray-900">{(s as any).clicks || 0}</p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-muted-foreground">Impressions</p>
                <p className="text-xs font-semibold text-gray-900">{(s as any).impressions || 0}</p>
              </div>
              {s.active ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/50">Active</Badge> : <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
            </div>
          </div>
        ))}
        {sponsors.length === 0 && <div className="text-center py-16 text-muted-foreground"><Star className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No sponsors yet</p></div>}
      </div>
    </div>
  );
}

// ============ ADMIN ACTIVITY PAGE ============
function AdminActivityPage({ token }: { token: string | null }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/activity', { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(d => { setLogs(d.logs || []); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton-shimmer h-12 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-xl font-extrabold text-gray-900">Activity Log</h1>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
        {logs.length > 0 ? (
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-100" />
            <div className="space-y-4">
              {logs.map((log, i) => (
                <div key={log.id || i} className="relative flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 z-10 ring-4 ring-white">
                    {log.action?.includes('delete') ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : log.action?.includes('update') ? <Edit className="w-3.5 h-3.5 text-amber-500" /> : <Plus className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-sm font-medium text-gray-900">{log.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {log.entityType && <Badge variant="secondary" className="text-[10px]">{log.entityType}</Badge>}
                      {log.admin && <span className="text-[10px] text-muted-foreground">{log.admin.name}</span>}
                      <span className="text-[10px] text-muted-foreground/70">{log.createdAt ? new Date(log.createdAt).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground"><Activity className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">No activity logged yet</p></div>
        )}
      </div>
    </div>
  );
}

// ============ MAIN APP ============
export default function PhoneDockApp() {
  const { view, params, navigate } = useHashRouter();
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/home').then(r => r.json()).then(d => { if (!cancelled) { setHomeData(d); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleLogin = useCallback((a: AdminUser, t: string) => { setAdmin(a); setToken(t); navigate('/admin/dashboard'); }, [navigate]);
  const handleLogout = useCallback(() => { setAdmin(null); setToken(null); navigate('/'); }, [navigate]);
  const handleSearch = useCallback((q: string) => { setSearchQuery(q); navigate(`/search/${encodeURIComponent(q)}`); }, [navigate]);
  const toggleTheme = useCallback(() => { setTheme(theme === 'dark' ? 'light' : 'dark'); }, [theme, setTheme]);

  const isAdmin = view.startsWith('admin-') && view !== 'admin-login';

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <Header onNavigate={navigate} onSearch={handleSearch} theme={theme || 'light'} toggleTheme={toggleTheme} admin={admin} onLogout={handleLogout} />
      <main className="flex-1">
        {isAdmin ? (
          admin ? (
            <div className="flex">
              <AdminSidebar admin={admin} onNavigate={navigate} onLogout={handleLogout} currentView={view} />
              <div className="flex-1 p-4 sm:p-6 max-w-6xl w-full">
                <div className="animate-fade-in">
                  {view === 'admin-dashboard' && <AdminDashboard token={token} admin={admin} onNavigate={navigate} homeData={homeData} />}
                  {view === 'admin-phones' && <AdminPhonesPage token={token} />}
                  {view === 'admin-brands' && <AdminBrandsPage token={token} />}
                  {view === 'admin-news' && <AdminNewsPage token={token} />}
                  {view === 'admin-sponsors' && <AdminSponsorsPage token={token} />}
                  {view === 'admin-activity' && <AdminActivityPage token={token} />}
                </div>
              </div>
            </div>
          ) : (
            <AdminLoginPage onLogin={handleLogin} />
          )
        ) : (
          <div className="animate-fade-in">
            {view === 'home' && <HomePage data={homeData} loading={loading} onNavigate={navigate} />}
            {view === 'phone' && <PhoneDetailPage slug={params.slug || ''} onNavigate={navigate} />}
            {view === 'compare' && <ComparePage params={params} onNavigate={navigate} />}
            {view === 'brand' && <BrandDetailPage slug={params.slug || ''} onNavigate={navigate} />}
            {view === 'brands' && <BrandsPage onNavigate={navigate} />}
            {view === 'search' && <SearchPage query={params.q || ''} onNavigate={navigate} />}
            {view === 'news' && <NewsPage />}
            {view === 'admin-login' && <AdminLoginPage onLogin={handleLogin} />}
          </div>
        )}
      </main>
      {!isAdmin && <Footer onNavigate={navigate} />}
    </div>
  );
}