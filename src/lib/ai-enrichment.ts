export type EnrichmentType = 'specs' | 'images' | 'prices';
export type AIProviderName = 'openrouter' | 'openai';

export interface EnrichmentPhoneInput { id: string; brand: string; model: string; slug?: string; }
export interface ResearchSource { title: string; url: string; domain: string; excerpt?: string; score?: number; }
export interface EnrichmentSuggestion {
  phoneId: string; brand: string; model: string; confidence: number; sourceNotes: string;
  sources?: ResearchSource[]; conflicts?: string[];
  specs?: { display?: string; chipset?: string; ram?: string; storage?: string; battery?: string; mainCamera?: string; fiveG?: string; };
  images?: Array<{ url: string; sourceUrl?: string; title?: string }>;
  price?: { valuePKR?: number; sourceName?: string; sourceUrl?: string };
}

type TavilyResult = { title?: string; url?: string; content?: string; score?: number };
type TavilyPayload = { results?: TavilyResult[]; images?: Array<string | { url?: string; description?: string }> };

type ProviderConfig = {
  provider: AIProviderName;
  apiKey: string;
  model: string;
  endpoint: string;
  displayName: string;
};

function cleanText(value: unknown, max = 1000): string { return String(value ?? '').trim().slice(0, max); }
function readEnv(names: string[], max = 1000): { value: string; source: string | null } {
  for (const name of names) {
    const raw = process.env[name];
    if (raw == null) continue;
    const value = cleanText(raw, max).replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
    if (value && value !== '...' && !/^your[-_ ]/i.test(value)) return { value, source: name };
  }
  return { value: '', source: null };
}
function isHttpUrl(value: unknown): boolean {
  try { const url = new URL(String(value ?? '')); return url.protocol === 'http:' || url.protocol === 'https:'; }
  catch { return false; }
}
function domainOf(value: string): string { try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; } }
function parseJsonObject(text: string): any {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch { /* continue */ }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return JSON.parse(fenced);
  const start = trimmed.indexOf('{'); const end = trimmed.lastIndexOf('}');
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

export function getAIProviderConfig(): ProviderConfig | null {
  const requested = readEnv(['AI_PROVIDER'], 30).value.toLowerCase() || 'openrouter';
  if (requested === 'openrouter') {
    const key = readEnv(['OPENROUTER_API_KEY', 'OPENROUTER_KEY', 'OPEN_ROUTER_API_KEY'], 500);
    if (!key.value) return null;
    return {
      provider: 'openrouter', apiKey: key.value,
      model: readEnv(['OPENROUTER_MODEL', 'AI_MODEL'], 200).value || 'openrouter/free',
      endpoint: readEnv(['OPENROUTER_CHAT_COMPLETIONS_URL'], 1000).value || 'https://openrouter.ai/api/v1/chat/completions',
      displayName: 'OpenRouter',
    };
  }
  if (requested === 'openai') {
    const key = readEnv(['OPENAI_API_KEY', 'AI_ENRICHMENT_API_KEY'], 500);
    if (!key.value) return null;
    return {
      provider: 'openai', apiKey: key.value,
      model: readEnv(['OPENAI_MODEL', 'AI_ENRICHMENT_MODEL', 'AI_MODEL'], 200).value || 'gpt-4.1-mini',
      endpoint: readEnv(['OPENAI_CHAT_COMPLETIONS_URL', 'AI_ENRICHMENT_API_URL'], 1000).value || 'https://api.openai.com/v1/chat/completions',
      displayName: 'OpenAI',
    };
  }
  return null;
}

export function getAIStatus() {
  const requestedProvider = readEnv(['AI_PROVIDER'], 30).value.toLowerCase() || 'openrouter';
  const openRouterKey = readEnv(['OPENROUTER_API_KEY', 'OPENROUTER_KEY', 'OPEN_ROUTER_API_KEY'], 500);
  const openAIKey = readEnv(['OPENAI_API_KEY', 'AI_ENRICHMENT_API_KEY'], 500);
  const tavilyKey = readEnv(['TAVILY_API_KEY'], 500);
  const imageSearchUrl = readEnv(['AI_IMAGE_SEARCH_URL'], 1000);
  const config = getAIProviderConfig();
  return {
    requestedProvider,
    activeProvider: config?.provider || null,
    providerName: config?.displayName || null,
    model: config?.model || (requestedProvider === 'openai' ? (readEnv(['OPENAI_MODEL', 'AI_MODEL'], 200).value || 'gpt-4.1-mini') : (readEnv(['OPENROUTER_MODEL', 'AI_MODEL'], 200).value || 'openrouter/free')),
    providerConfigured: Boolean(config),
    providerKeySource: requestedProvider === 'openrouter' ? openRouterKey.source : requestedProvider === 'openai' ? openAIKey.source : null,
    tavily: Boolean(tavilyKey.value), tavilyKeySource: tavilyKey.source,
    imageSearch: Boolean(imageSearchUrl.value),
    configured: { specs: Boolean(config) && Boolean(tavilyKey.value), prices: Boolean(config) && Boolean(tavilyKey.value), images: Boolean(config) && (Boolean(tavilyKey.value) || Boolean(imageSearchUrl.value)) },
  };
}

async function tavilySearch(query: string, includeImages = false) {
  const apiKey = readEnv(['TAVILY_API_KEY'], 500).value;
  if (!apiKey) throw new Error('TAVILY_API_KEY is not configured');
  const response = await fetch(process.env.TAVILY_SEARCH_URL || 'https://api.tavily.com/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ api_key: apiKey, query, search_depth: process.env.TAVILY_SEARCH_DEPTH || 'advanced', max_results: 8, include_answer: false, include_raw_content: false, include_images: includeImages, topic: 'general' }),
    signal: AbortSignal.timeout(30000), cache: 'no-store',
  });
  if (!response.ok) { const detail = cleanText(await response.text().catch(() => ''), 500); throw new Error(`Tavily search failed (${response.status})${detail ? `: ${detail}` : ''}`); }
  const payload = await response.json() as TavilyPayload;
  const sources = (payload.results || []).filter(row => isHttpUrl(row.url)).map(row => ({
    title: cleanText(row.title, 240), url: cleanText(row.url, 1500), domain: domainOf(cleanText(row.url, 1500)), excerpt: cleanText(row.content, 1800), score: Number(row.score) || 0,
  })).sort((a, b) => (sourcePriority(b.url) - sourcePriority(a.url)) || ((b.score || 0) - (a.score || 0))).slice(0, 8);
  const images = (payload.images || []).map(image => typeof image === 'string' ? { url: cleanText(image, 1500), title: '' } : { url: cleanText(image.url, 1500), title: cleanText(image.description, 240) }).filter(image => isHttpUrl(image.url)).slice(0, 8);
  return { sources, images };
}

async function directImageSearch(query: string) {
  const endpoint = process.env.AI_IMAGE_SEARCH_URL; if (!endpoint) return [];
  const url = new URL(endpoint); url.searchParams.set('q', query); url.searchParams.set('limit', '8');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.AI_IMAGE_SEARCH_KEY) headers.Authorization = `Bearer ${process.env.AI_IMAGE_SEARCH_KEY}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!response.ok) throw new Error(`Image search provider failed (${response.status})`);
  const payload = await response.json() as any;
  const rows = Array.isArray(payload.images) ? payload.images : Array.isArray(payload.results) ? payload.results : [];
  return rows.slice(0, 8).map((row: any) => ({ url: cleanText(row.url || row.imageUrl || row.thumbnail, 1500), sourceUrl: cleanText(row.sourceUrl || row.pageUrl || row.link, 1500), title: cleanText(row.title || row.name, 240) })).filter((row: { url: string }) => isHttpUrl(row.url));
}

async function synthesize(type: EnrichmentType, phone: EnrichmentPhoneInput, sources: ResearchSource[], imageCandidates: Array<{ url: string; sourceUrl?: string; title?: string }>): Promise<EnrichmentSuggestion> {
  const config = getAIProviderConfig();
  if (!config) throw new Error(`AI provider is not configured. Set AI_PROVIDER and its API key.`);
  const evidence = sources.map((source, index) => ({ id: index + 1, ...source }));
  const system = [
    'You are PhoneDock Research Engine. Produce review-only smartphone enrichment drafts from supplied evidence only.',
    'Never use unstated memory. Never guess. Empty fields are better than invented values.',
    'Prefer official manufacturer sources, then reputable retailers for Pakistan prices.',
    'When sources disagree, keep the most authoritative value and list the conflict.',
    'A price is acceptable only when the evidence explicitly describes a current Pakistan PKR price.',
    'Return strict JSON only. Do not use markdown.',
    'Shape: {"confidence":0,"sourceNotes":"","conflicts":[],"specs":{"display":"","chipset":"","ram":"","storage":"","battery":"","mainCamera":"","fiveG":""},"images":[],"price":{"valuePKR":null,"sourceName":"","sourceUrl":""}}.'
  ].join(' ');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` };
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock-pi.vercel.app';
    headers['X-Title'] = 'PhoneDock';
  }
  const messages = [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify({ task: type, phone, evidence, imageCandidates }) }];
  const requestBody: Record<string, unknown> = { model: config.model, temperature: 0, messages };
  // OpenRouter free models vary in response_format support. Strict JSON is already
  // required by the prompt, so only request JSON mode from OpenAI.
  if (config.provider === 'openai') requestBody.response_format = { type: 'json_object' };
  const response = await fetch(config.endpoint, {
    method: 'POST', headers,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(60000), cache: 'no-store',
  });
  if (!response.ok) {
    const detail = cleanText(await response.text().catch(() => ''), 1000);
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`${config.displayName} synthesis failed (${response.status})${retryAfter ? ` retry-after=${retryAfter}s` : ''}${detail ? `: ${detail}` : ''}`);
  }
  const payload = await response.json() as any;
  const rawContent = payload.choices?.[0]?.message?.content ?? payload.output_text ?? payload.content;
  const content = Array.isArray(rawContent) ? rawContent.map((part: any) => typeof part === 'string' ? part : part?.text || '').join('') : rawContent;
  if (!content) throw new Error(`${config.displayName} returned no message content`);
  let parsed: any;
  try { parsed = typeof content === 'string' ? parseJsonObject(content) : content; }
  catch (error) { throw new Error(`${error instanceof Error ? error.message : 'Invalid AI JSON'}; response: ${cleanText(typeof content === 'string' ? content : JSON.stringify(content), 500)}`); }

  const approvedSourceUrls = new Set(sources.map(source => source.url));
  const candidateImageUrls = new Set(imageCandidates.map(image => image.url));
  const images = Array.isArray(parsed.images) ? parsed.images.slice(0, 5).map((image: any) => ({ url: cleanText(image.url, 1500), sourceUrl: cleanText(image.sourceUrl, 1500), title: cleanText(image.title, 240) })).filter((image: any) => candidateImageUrls.has(image.url) && isHttpUrl(image.url)) : [];
  const priceSourceUrl = cleanText(parsed.price?.sourceUrl, 1500); const valuePKR = Number(parsed.price?.valuePKR);
  const validPrice = Number.isFinite(valuePKR) && valuePKR > 0 && valuePKR <= 10000000 && approvedSourceUrls.has(priceSourceUrl);
  return {
    phoneId: phone.id, brand: phone.brand, model: phone.model,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)), sourceNotes: cleanText(parsed.sourceNotes, 1500), sources,
    conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts.map((item: unknown) => cleanText(item, 500)).filter(Boolean).slice(0, 10) : [],
    specs: type === 'specs' ? { display: cleanText(parsed.specs?.display), chipset: cleanText(parsed.specs?.chipset), ram: cleanText(parsed.specs?.ram), storage: cleanText(parsed.specs?.storage), battery: cleanText(parsed.specs?.battery), mainCamera: cleanText(parsed.specs?.mainCamera), fiveG: cleanText(parsed.specs?.fiveG) } : undefined,
    images: type === 'images' ? images : undefined,
    price: type === 'prices' ? { valuePKR: validPrice ? valuePKR : undefined, sourceName: validPrice ? cleanText(parsed.price?.sourceName, 120) : '', sourceUrl: validPrice ? priceSourceUrl : '' } : undefined,
  };
}

export function aiEnrichmentConfigured(type: EnrichmentType): boolean { return getAIStatus().configured[type]; }

export async function generateEnrichmentSuggestions(type: EnrichmentType, phones: EnrichmentPhoneInput[]): Promise<EnrichmentSuggestion[]> {
  if (!phones.length) return [];
  const results: EnrichmentSuggestion[] = [];
  for (const phone of phones.slice(0, 10)) {
    const name = `${phone.brand} ${phone.model}`.trim();
    const query = type === 'prices' ? `${name} current price in Pakistan PKR official retailer` : type === 'images' ? `${name} official product image specifications` : `${name} official specifications display chipset RAM storage battery camera 5G`;
    let research;
    try { research = process.env.TAVILY_API_KEY ? await tavilySearch(query, type === 'images') : { sources: [] as ResearchSource[], images: [] as Array<{ url: string; sourceUrl?: string; title?: string }> }; }
    catch (error) { throw new Error(`[research:${name}] ${error instanceof Error ? error.message : 'Search failed'}`); }
    if (type !== 'images' && !research.sources.length) throw new Error(`[research:${name}] No usable web sources returned`);
    const providerImages = type === 'images' ? await directImageSearch(`${name} official product phone image`) : [];
    const imageCandidates = [...providerImages, ...research.images].filter((image, index, rows) => rows.findIndex(item => item.url === image.url) === index).slice(0, 8);
    try {
      const suggestion = await synthesize(type, phone, research.sources, imageCandidates);
      const hasUsefulData = type === 'specs' ? Object.values(suggestion.specs || {}).some(Boolean) : type === 'images' ? Boolean(suggestion.images?.length) : Boolean(suggestion.price?.valuePKR);
      if (!hasUsefulData) throw new Error('AI returned no usable fields for this research type');
      results.push(suggestion);
    } catch (error) { throw new Error(`[synthesis:${name}] ${error instanceof Error ? error.message : 'AI synthesis failed'}`); }
  }
  return results;
}
