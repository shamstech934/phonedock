export type EnrichmentType = 'specs' | 'images' | 'prices';

export interface EnrichmentPhoneInput {
  id: string;
  brand: string;
  model: string;
  slug?: string;
}

export interface EnrichmentSuggestion {
  phoneId: string;
  brand: string;
  model: string;
  confidence: number;
  sourceNotes: string;
  specs?: {
    display?: string;
    chipset?: string;
    ram?: string;
    storage?: string;
    battery?: string;
    mainCamera?: string;
    fiveG?: string;
  };
  images?: Array<{ url: string; sourceUrl?: string; title?: string }>;
  price?: { valuePKR?: number; sourceName?: string; sourceUrl?: string };
}

function cleanText(value: unknown, max = 1000): string {
  return String(value ?? '').trim().slice(0, max);
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch { /* continue */ }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return JSON.parse(fenced);
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error('AI provider returned invalid JSON');
}

async function fetchImageCandidates(query: string): Promise<Array<{ url: string; sourceUrl?: string; title?: string }>> {
  const endpoint = process.env.AI_IMAGE_SEARCH_URL;
  if (!endpoint) return [];
  const url = new URL(endpoint);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.AI_IMAGE_SEARCH_KEY) headers.Authorization = `Bearer ${process.env.AI_IMAGE_SEARCH_KEY}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000), cache: 'no-store' });
  if (!response.ok) throw new Error(`Image search provider failed (${response.status})`);
  const payload = await response.json() as any;
  const rows = Array.isArray(payload.images) ? payload.images : Array.isArray(payload.results) ? payload.results : [];
  return rows.slice(0, 5).map((row: any) => ({
    url: cleanText(row.url || row.imageUrl || row.thumbnail, 1500),
    sourceUrl: cleanText(row.sourceUrl || row.pageUrl || row.link, 1500),
    title: cleanText(row.title || row.name, 200),
  })).filter((row: { url: string }) => /^https?:\/\//i.test(row.url));
}

export function aiEnrichmentConfigured(type: EnrichmentType): boolean {
  if (type === 'images' && process.env.AI_IMAGE_SEARCH_URL) return true;
  return Boolean(process.env.AI_ENRICHMENT_API_URL && process.env.AI_ENRICHMENT_API_KEY && process.env.AI_ENRICHMENT_MODEL);
}

export async function generateEnrichmentSuggestions(type: EnrichmentType, phones: EnrichmentPhoneInput[]): Promise<EnrichmentSuggestion[]> {
  if (!phones.length) return [];

  if (type === 'images' && process.env.AI_IMAGE_SEARCH_URL) {
    return Promise.all(phones.map(async phone => {
      const images = await fetchImageCandidates(`${phone.brand} ${phone.model} official product phone image`);
      return { ...phone, phoneId: phone.id, confidence: images.length ? 0.7 : 0, sourceNotes: 'Image-search candidates; verify licensing and product match before import.', images };
    }));
  }

  const endpoint = process.env.AI_ENRICHMENT_API_URL;
  const apiKey = process.env.AI_ENRICHMENT_API_KEY;
  const model = process.env.AI_ENRICHMENT_MODEL;
  if (!endpoint || !apiKey || !model) throw new Error('AI enrichment provider is not configured');

  const system = [
    'You prepare review-only smartphone data drafts for PhoneDock Pakistan.',
    'Never invent uncertain facts. Return null/empty for anything not confidently known.',
    'Do not claim live Pakistan prices unless a source URL is supplied by your retrieval system.',
    'For images, provide only direct http(s) image candidates with their source page when available.',
    'Return strict JSON only with shape {"suggestions":[...]}.',
    'Each suggestion must include phoneId, confidence from 0 to 1, sourceNotes.',
    type === 'specs' ? 'Include specs: display, chipset, ram, storage, battery, mainCamera, fiveG.' : '',
    type === 'images' ? 'Include images: [{url,sourceUrl,title}] maximum 5.' : '',
    type === 'prices' ? 'Include price: {valuePKR,sourceName,sourceUrl}; leave empty without a current reliable Pakistan source.' : '',
  ].filter(Boolean).join(' ');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.1, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify({ type, phones }) }] }),
    signal: AbortSignal.timeout(45000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`AI enrichment provider failed (${response.status})`);
  const payload = await response.json() as any;
  const content = payload.choices?.[0]?.message?.content ?? payload.output_text ?? payload.content;
  const parsed = typeof content === 'string' ? parseJsonObject(content) as any : payload;
  const rows = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  const allowedIds = new Set(phones.map(phone => phone.id));
  return rows.filter((row: any) => allowedIds.has(String(row.phoneId))).map((row: any) => ({
    phoneId: cleanText(row.phoneId, 40),
    brand: cleanText(row.brand, 120),
    model: cleanText(row.model, 200),
    confidence: Math.max(0, Math.min(1, Number(row.confidence) || 0)),
    sourceNotes: cleanText(row.sourceNotes, 1000),
    specs: row.specs ? {
      display: cleanText(row.specs.display), chipset: cleanText(row.specs.chipset), ram: cleanText(row.specs.ram), storage: cleanText(row.specs.storage),
      battery: cleanText(row.specs.battery), mainCamera: cleanText(row.specs.mainCamera), fiveG: cleanText(row.specs.fiveG),
    } : undefined,
    images: Array.isArray(row.images) ? row.images.slice(0, 5).map((image: any) => ({ url: cleanText(image.url, 1500), sourceUrl: cleanText(image.sourceUrl, 1500), title: cleanText(image.title, 200) })).filter((image: any) => /^https?:\/\//i.test(image.url)) : undefined,
    price: row.price ? { valuePKR: Number(row.price.valuePKR) || undefined, sourceName: cleanText(row.price.sourceName, 120), sourceUrl: cleanText(row.price.sourceUrl, 1500) } : undefined,
  }));
}
