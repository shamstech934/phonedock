import { validateUrlForFetch } from '@/lib/ssrf-guard';

export type RetailerFetchFailureType =
  | 'none'
  | 'timeout'
  | 'network'
  | 'http'
  | 'challenge'
  | 'rate_limit'
  | 'invalid_content_type'
  | 'oversized'
  | 'unsafe_url';

export interface RetailerFetchResult {
  reachable: boolean;
  ok: boolean;
  status: number | null;
  finalUrl: string;
  contentType: string;
  html: string;
  preview: string;
  durationMs: number;
  failureType: RetailerFetchFailureType;
  error: string;
}

const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_BYTES = 3_000_000;
const CHALLENGE_PATTERNS = [
  /cf-chl-/i,
  /cloudflare/i,
  /checking your browser/i,
  /verify you are human/i,
  /access denied/i,
  /captcha/i,
  /bot detection/i,
  /security challenge/i,
];

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};

function classifyFailure(status: number | null, body: string): RetailerFetchFailureType {
  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403 || CHALLENGE_PATTERNS.some((pattern) => pattern.test(body))) {
    return 'challenge';
  }
  if (status !== null && (status < 200 || status >= 300)) return 'http';
  return 'none';
}

async function readBoundedText(response: Response, maxBytes: number): Promise<{ text: string; oversized: boolean }> {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) return { text: '', oversized: true };
  if (!response.body) {
    const text = await response.text();
    return { text: text.slice(0, maxBytes), oversized: text.length > maxBytes };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { text: text.slice(0, maxBytes), oversized: true };
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return { text, oversized: false };
}

export async function fetchRetailerPage(
  url: string,
  allowedDomains: string[] = [],
  options: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<RetailerFetchResult> {
  const startedAt = Date.now();
  const timeoutMs = Math.max(5_000, Math.min(options.timeoutMs || DEFAULT_TIMEOUT_MS, 30_000));
  const maxBytes = Math.max(250_000, Math.min(options.maxBytes || DEFAULT_MAX_BYTES, DEFAULT_MAX_BYTES));
  const safety = await validateUrlForFetch(url, allowedDomains);
  if (!safety.safe) {
    return {
      reachable: false, ok: false, status: null, finalUrl: url, contentType: '', html: '', preview: '',
      durationMs: Date.now() - startedAt, failureType: 'unsafe_url', error: safety.reason || 'Product URL failed safety validation.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: BROWSER_HEADERS,
      cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') || '';
    const { text, oversized } = await readBoundedText(response, maxBytes);
    const preview = text.replace(/\s+/g, ' ').trim().slice(0, 500);
    const failureType = oversized
      ? 'oversized'
      : !/text\/html|application\/xhtml\+xml/i.test(contentType)
        ? 'invalid_content_type'
        : classifyFailure(response.status, text);
    const ok = response.ok && failureType === 'none';
    let error = '';
    if (failureType === 'challenge') error = `Retailer returned an anti-bot/challenge page (HTTP ${response.status}).`;
    else if (failureType === 'rate_limit') error = `Retailer rate-limited the request (HTTP ${response.status}).`;
    else if (failureType === 'oversized') error = 'Retail product page exceeds the 3 MB safety limit.';
    else if (failureType === 'invalid_content_type') error = `Retailer returned unsupported content type: ${contentType || 'unknown'}.`;
    else if (failureType === 'http') error = `Retailer returned HTTP ${response.status}.`;

    return {
      reachable: true,
      ok,
      status: response.status,
      finalUrl: response.url || url,
      contentType,
      html: ok ? text : '',
      preview,
      durationMs: Date.now() - startedAt,
      failureType,
      error,
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      reachable: false, ok: false, status: null, finalUrl: url, contentType: '', html: '', preview: '',
      durationMs: Date.now() - startedAt,
      failureType: timedOut ? 'timeout' : 'network',
      error: timedOut ? `Retailer request timed out after ${timeoutMs / 1000} seconds.` : error instanceof Error ? error.message : 'Retailer request failed.',
    };
  } finally {
    clearTimeout(timer);
  }
}
