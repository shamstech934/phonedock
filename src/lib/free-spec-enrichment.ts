export type SpecPreview = {
  display: string;
  chipset: string;
  ram: string;
  storage: string;
  battery: string;
  mainCamera: string;
  fiveG: string;
};

export type SpecCandidate = {
  name: string;
  slug: string;
  image: string;
  sourceUrl: string;
  score: number;
  specs: SpecPreview;
};

const DEFAULT_BASE = 'https://api-mobilespecs.azharimm.dev';

function clean(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).join('; ');
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>)
    .map(([key, val]) => `${key}: ${clean(val)}`).filter(v => !v.endsWith(': ')).join('; ');
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/&/g, ' and ')
    .replace(/\b(5g|4g|lte|dual sim|single sim|global|international|edition)\b/g, ' ')
    .replace(/\b\d+\s*(gb|tb)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarity(aRaw: string, bRaw: string): number {
  const a = normalize(aRaw); const b = normalize(bRaw);
  if (!a || !b) return 0;
  const aTokens = new Set(a.split(' ')); const bTokens = new Set(b.split(' '));
  const intersection = [...aTokens].filter(x => bTokens.has(x)).length;
  const union = new Set([...aTokens, ...bTokens]).size || 1;
  const tokenScore = intersection / union;
  const contains = a.includes(b) || b.includes(a) ? 1 : 0;
  return Math.min(1, tokenScore * 0.78 + contains * 0.22);
}

function flatten(node: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (Array.isArray(node)) {
    node.forEach((item, index) => flatten(item, `${prefix}.${index}`, out));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object') flatten(value, path, out);
      else if (clean(value)) out[path.toLowerCase()] = clean(value);
    }
  }
  return out;
}

function pick(flat: Record<string, string>, includes: string[], rejects: string[] = []): string {
  for (const needle of includes) {
    const entry = Object.entries(flat).find(([key]) => key.includes(needle) && !rejects.some(r => key.includes(r)));
    if (entry?.[1]) return entry[1];
  }
  return '';
}

function mapSpecs(payload: Record<string, unknown>): SpecPreview {
  const data = payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : payload;
  const flat = flatten(data);
  const network = pick(flat, ['network.technology', 'technology', 'network']);
  return {
    display: pick(flat, ['display.type', 'display.size', 'display'], ['resolution', 'protection']),
    chipset: pick(flat, ['platform.chipset', 'chipset', 'processor']),
    ram: pick(flat, ['memory.ram', '.ram'], ['camera']),
    storage: pick(flat, ['memory.internal', 'internal', 'storage']),
    battery: pick(flat, ['battery.type', 'battery']),
    mainCamera: pick(flat, ['main camera', 'main_camera', 'camera.single', 'camera.dual', 'camera.triple', 'camera.quad'], ['selfie']),
    fiveG: /\b5g\b/i.test(network) ? 'Yes' : network ? 'No' : '',
  };
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'PhoneDock-Free-Spec-Enrichment/1.0' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Free provider returned HTTP ${response.status}`);
    return await response.json() as Record<string, unknown>;
  } finally { clearTimeout(timer); }
}

function candidateRows(payload: Record<string, unknown>): Record<string, unknown>[] {
  const data = payload.data ?? payload;
  if (Array.isArray(data)) return data.filter(x => x && typeof x === 'object') as Record<string, unknown>[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['phones', 'results', 'items']) {
      if (Array.isArray(obj[key])) return (obj[key] as unknown[]).filter(x => x && typeof x === 'object') as Record<string, unknown>[];
    }
  }
  return [];
}

export async function searchFreeSpecs(brand: string, model: string): Promise<SpecCandidate[]> {
  const base = (process.env.FREE_PHONE_SPECS_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
  const query = `${brand} ${model}`.trim();
  let searchPayload: Record<string, unknown> | null = null;
  let lastError: unknown;
  for (const path of [`/v2/search?query=${encodeURIComponent(query)}`, `/search?query=${encodeURIComponent(query)}`]) {
    try { searchPayload = await getJson(`${base}${path}`); break; } catch (error) { lastError = error; }
  }
  if (!searchPayload) throw lastError instanceof Error ? lastError : new Error('Free specifications provider is unavailable');

  const ranked = candidateRows(searchPayload).map(item => {
    const name = clean(item.phone_name || item.name || item.model || item.title);
    const slug = clean(item.slug || item.detail || item.phone_slug || item.id).replace(/^\/+|\/+$/g, '');
    const image = clean(item.image || item.thumbnail || item.phone_image);
    return { item, name, slug, image, score: similarity(query, name) + (name.toLowerCase().includes(brand.toLowerCase()) ? 0.08 : 0) };
  }).filter(x => x.name && x.slug).sort((a, b) => b.score - a.score).slice(0, 5);

  const results: SpecCandidate[] = [];
  for (const row of ranked) {
    let details: Record<string, unknown> | null = null;
    for (const path of [`/v2/${row.slug}`, `/${row.slug}`]) {
      try { details = await getJson(`${base}${path}`); break; } catch { /* fallback */ }
    }
    if (!details) continue;
    results.push({
      name: row.name,
      slug: row.slug,
      image: row.image,
      sourceUrl: `${base}/${row.slug}`,
      score: Math.round(Math.min(1, row.score) * 100),
      specs: mapSpecs(details),
    });
  }
  return results;
}
