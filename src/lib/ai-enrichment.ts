export type EnrichmentType = 'specs' | 'images' | 'prices';

export interface EnrichmentPhoneInput {
  id: string;
  brand: string;
  model: string;
  slug?: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  domain: string;
  excerpt?: string;
  score?: number;
}

export interface EnrichmentSuggestion {
  phoneId: string;
  brand: string;
  model: string;
  confidence: number;
  sourceNotes: string;
  sources?: ResearchSource[];
  conflicts?: string[];
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

type TavilyResult = { title?: string; url?: string; content?: string; score?: number };
type TavilyPayload = { results?: TavilyResult[]; images?: Array<string | { url?: string; description?: string }> };

function cleanText(value: unknown, max = 1000): string {
  return String(value ?? '').trim().slice(0, max);
}

function isHttpUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

function domainOf(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function parseJsonObject(text: string): any {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch { /* continue */ }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return JSON.parse(fenced);
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error('AI provider returned invalid JSON');
}

function sourcePriority(url: string): number {
  const domain = domainOf(url);
  if (/^(apple|samsung|mi|xiaomi|oneplus|oppo|vivo|realme|motorola|google|sony|nothing|tecno-mobile|infinixmobility)\./i.test(domain)) return 4;
  if (/support\.|newsroom\.|store\./i.test(domain)) return 3;
  if (/whatmobile|priceoye|shophive|mega\.pk|daraz/i.test(domain)) return 2;
  return 1;
}

async function tavilySearch(query: string, includeImages = false): Promise<{ sources: ResearchSource[]; images: Array<{ url: string; sourceUrl?: string; title?: string }> }> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY is not configured');

  const response = await fetch(process.env.TAVILY_SEARCH_URL || 'https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query,
      search_depth: process.env.TAVILY_SEARCH_DEPTH || 'advanced',
      max_results: 8,
      include_answer: false,
      include_raw_content: false,
      include_images: includeImages,
      topic: 'general',
    }),
    signal: AbortSignal.timeout(30000),
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = cleanText(await response.text().catch(() => ''), 500);
    throw new Error(`Tavily search failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  const payload = await response.json() as TavilyPayload;

  const sources = (payload.results || [])
    .filter(row => isHttpUrl(row.url))
    .map(row => ({
      title: cleanText(row.title, 240),
      url: cleanText(row.url, 1500),
      domain: domainOf(cleanText(row.url, 1500)),
      excerpt: cleanText(row.content, 1800),
      score: Number(row.score) || 0,
    }))
    .sort((a, b) => (sourcePriority(b.url) - sourcePriority(a.url)) || ((b.score || 0) - (a.score || 0)))
    .slice(0, 8);

  const images = (payload.images || []).map(image => {
    if (typeof image === 'string') return { url: cleanText(image, 1500), title: '' };
    return { url: cleanText(image.url, 1500), title: cleanText(image.description, 240) };
  }).filter(image => isHttpUrl(image.url)).slice(0, 8);

  return { sources, images };
}

async function directImageSearch(query: string): Promise<Array<{ url: string; sourceUrl?: string; title?: string }>> {
  const endpoint = process.env.AI_IMAGE_SEARCH_URL;
  if (!endpoint) return [];
  const url = new URL(endpoint);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '8');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.AI_IMAGE_SEARCH_KEY) headers.Authorization = `Bearer ${process.env.AI_IMAGE_SEARCH_KEY}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!response.ok) throw new Error(`Image search provider failed (${response.status})`);
  const payload = await response.json() as any;
  const rows = Array.isArray(payload.images) ? payload.images : Array.isArray(payload.results) ? payload.results : [];
  return rows.slice(0, 8).map((row: any) => ({
    url: cleanText(row.url || row.imageUrl || row.thumbnail, 1500),
    sourceUrl: cleanText(row.sourceUrl || row.pageUrl || row.link, 1500),
    title: cleanText(row.title || row.name, 240),
  })).filter((row: { url: string }) => isHttpUrl(row.url));
}

type AIProvider = 'openrouter' | 'openai';

function configuredAIProviders(): AIProvider[] {
  const preferred = String(process.env.AI_PROVIDER || 'auto').toLowerCase();
  const available: AIProvider[] = [];
  const add = (provider: AIProvider, configured: boolean) => { if (configured && !available.includes(provider)) available.push(provider); };

  if (preferred === 'openrouter') {
    add('openrouter', Boolean(process.env.OPENROUTER_API_KEY));
    add('openai', Boolean(process.env.OPENAI_API_KEY || process.env.AI_ENRICHMENT_API_KEY));
  } else if (preferred === 'openai') {
    add('openai', Boolean(process.env.OPENAI_API_KEY || process.env.AI_ENRICHMENT_API_KEY));
    add('openrouter', Boolean(process.env.OPENROUTER_API_KEY));
  } else {
    // Prefer OpenRouter for lightweight deployments; OpenAI remains a fallback.
    add('openrouter', Boolean(process.env.OPENROUTER_API_KEY));
    add('openai', Boolean(process.env.OPENAI_API_KEY || process.env.AI_ENRICHMENT_API_KEY));
  }
  return available;
}

function providerConfig(provider: AIProvider) {
  if (provider === 'openrouter') {
    return {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.OPENROUTER_MODEL || process.env.AI_MODEL || 'openrouter/free',
      endpoint: process.env.OPENROUTER_CHAT_COMPLETIONS_URL || 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || 'https://phonedock.pk',
        'X-OpenRouter-Title': 'PhoneDock AI Research',
      },
      label: 'OpenRouter',
    };
  }
  return {
    apiKey: process.env.OPENAI_API_KEY || process.env.AI_ENRICHMENT_API_KEY || '',
    model: process.env.OPENAI_MODEL || process.env.AI_ENRICHMENT_MODEL || 'gpt-4.1-mini',
    endpoint: process.env.OPENAI_CHAT_COMPLETIONS_URL || process.env.AI_ENRICHMENT_API_URL || 'https://api.openai.com/v1/chat/completions',
    headers: {},
    label: 'OpenAI',
  };
}

async function synthesizeWithProvider(provider: AIProvider, type: EnrichmentType, phone: EnrichmentPhoneInput, sources: ResearchSource[], imageCandidates: Array<{ url: string; sourceUrl?: string; title?: string }>): Promise<EnrichmentSuggestion> {
  const config = providerConfig(provider);
  if (!config.apiKey) throw new Error(`${config.label} API key is not configured`);

  const evidence = sources.map((source, index) => ({ id: index + 1, ...source }));
  const system = [
    'You are PhoneDock Research Engine. Produce review-only smartphone enrichment drafts from supplied evidence only.',
    'Never use unstated memory. Never guess. Empty fields are better than invented values.',
    'Prefer official manufacturer sources, then reputable retailers for Pakistan prices.',
    'When sources disagree, keep the most authoritative value and list the conflict.',
    'A price is acceptable only when the evidence explicitly describes a current Pakistan PKR price.',
    'Return strict JSON only. Do not use markdown.',
    'Shape: {"confidence":0..1,"sourceNotes":"...","conflicts":["..."],"specs":{"display":"","chipset":"","ram":"","storage":"","battery":"","mainCamera":"","fiveG":""},"images":[{"url":"","sourceUrl":"","title":""}],"price":{"valuePKR":null,"sourceName":"","sourceUrl":""}}.',
  ].join(' ');

  const body: Record<string, unknown> = {
    model: config.model,
    temperature: 0,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({ task: type, phone, evidence, imageCandidates }) },
    ],
  };
  // OpenAI supports strict JSON mode. OpenRouter models differ, so the prompt remains the portable guarantee.
  if (provider === 'openai') body.response_format = { type: 'json_object' };

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`, ...config.headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = cleanText(await response.text().catch(() => ''), 700);
    throw new Error(`${config.label} synthesis failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  const payload = await response.json() as any;
  const content = payload.choices?.[0]?.message?.content ?? payload.output_text ?? payload.content;
  if (!content) throw new Error(`${config.label} returned no message content`);
  let parsed: any;
  try { parsed = typeof content === 'string' ? parseJsonObject(content) : payload; }
  catch (error) {
    const excerpt = cleanText(typeof content === 'string' ? content : JSON.stringify(content), 400);
    throw new Error(`${config.label}: ${error instanceof Error ? error.message : 'Invalid AI JSON'}${excerpt ? `; response: ${excerpt}` : ''}`);
  }

  const approvedSourceUrls = new Set(sources.map(source => source.url));
  const candidateImageUrls = new Set(imageCandidates.map(image => image.url));
  const images = Array.isArray(parsed.images) ? parsed.images.slice(0, 5).map((image: any) => ({
    url: cleanText(image.url, 1500), sourceUrl: cleanText(image.sourceUrl, 1500), title: cleanText(image.title, 240),
  })).filter((image: any) => candidateImageUrls.has(image.url) && isHttpUrl(image.url)) : [];

  const priceSourceUrl = cleanText(parsed.price?.sourceUrl, 1500);
  const valuePKR = Number(parsed.price?.valuePKR);
  const validPrice = Number.isFinite(valuePKR) && valuePKR > 0 && valuePKR <= 10000000 && approvedSourceUrls.has(priceSourceUrl);

  return {
    phoneId: phone.id, brand: phone.brand, model: phone.model,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    sourceNotes: cleanText(parsed.sourceNotes, 1500), sources,
    conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts.map((item: unknown) => cleanText(item, 500)).filter(Boolean).slice(0, 10) : [],
    specs: type === 'specs' ? {
      display: cleanText(parsed.specs?.display), chipset: cleanText(parsed.specs?.chipset), ram: cleanText(parsed.specs?.ram), storage: cleanText(parsed.specs?.storage),
      battery: cleanText(parsed.specs?.battery), mainCamera: cleanText(parsed.specs?.mainCamera), fiveG: cleanText(parsed.specs?.fiveG),
    } : undefined,
    images: type === 'images' ? images : undefined,
    price: type === 'prices' ? {
      valuePKR: validPrice ? valuePKR : undefined,
      sourceName: validPrice ? cleanText(parsed.price?.sourceName, 120) : '',
      sourceUrl: validPrice ? priceSourceUrl : '',
    } : undefined,
  };
}

async function synthesizeWithAI(type: EnrichmentType, phone: EnrichmentPhoneInput, sources: ResearchSource[], imageCandidates: Array<{ url: string; sourceUrl?: string; title?: string }>): Promise<EnrichmentSuggestion> {
  const providers = configuredAIProviders();
  if (!providers.length) throw new Error('Configure OPENROUTER_API_KEY or OPENAI_API_KEY');
  const failures: string[] = [];
  for (const provider of providers) {
    try { return await synthesizeWithProvider(provider, type, phone, sources, imageCandidates); }
    catch (error) { failures.push(error instanceof Error ? error.message : `${provider} failed`); }
  }
  throw new Error(failures.join(' | fallback: '));
}

export function aiEnrichmentConfigured(type: EnrichmentType): boolean {
  const hasAI = configuredAIProviders().length > 0;
  const hasResearch = Boolean(process.env.TAVILY_API_KEY);
  if (type === 'images') return hasAI && (hasResearch || Boolean(process.env.AI_IMAGE_SEARCH_URL));
  return hasAI && hasResearch;
}

export async function generateEnrichmentSuggestions(type: EnrichmentType, phones: EnrichmentPhoneInput[]): Promise<EnrichmentSuggestion[]> {
  if (!phones.length) return [];

  const results: EnrichmentSuggestion[] = [];
  for (const phone of phones.slice(0, 5)) {
    const name = `${phone.brand} ${phone.model}`.trim();
    const query = type === 'prices'
      ? `${name} current price in Pakistan PKR official retailer`
      : type === 'images'
        ? `${name} official product image specifications`
        : `${name} official specifications display chipset RAM storage battery camera 5G`;

    let research;
    try {
      research = process.env.TAVILY_API_KEY
      ? await tavilySearch(query, type === 'images')
      : { sources: [] as ResearchSource[], images: [] as Array<{ url: string; sourceUrl?: string; title?: string }> };
    } catch (error) {
      throw new Error(`[research:${name}] ${error instanceof Error ? error.message : 'Search failed'}`);
    }
    if (type !== 'images' && !research.sources.length) throw new Error(`[research:${name}] No usable web sources returned`);
    const providerImages = type === 'images' ? await directImageSearch(`${name} official product phone image`) : [];
    const imageCandidates = [...providerImages, ...research.images]
      .filter((image, index, rows) => rows.findIndex(item => item.url === image.url) === index)
      .slice(0, 8);

    try {
      const suggestion = await synthesizeWithAI(type, phone, research.sources, imageCandidates);
      const hasUsefulData = type === 'specs'
        ? Object.values(suggestion.specs || {}).some(Boolean)
        : type === 'images' ? Boolean(suggestion.images?.length)
        : Boolean(suggestion.price?.valuePKR);
      if (!hasUsefulData) throw new Error('AI returned no usable fields for this research type');
      results.push(suggestion);
    } catch (error) {
      throw new Error(`[synthesis:${name}] ${error instanceof Error ? error.message : 'AI synthesis failed'}`);
    }
  }
  return results;
}
