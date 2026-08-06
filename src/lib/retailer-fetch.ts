export const RETAIL_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const RETAIL_FETCH_TIMEOUT_MS = 25_000;
export const RETAIL_MAX_HTML_BYTES = 3 * 1024 * 1024;

export type RetailFetchFailure =
  | 'http_error'
  | 'timeout'
  | 'network_error'
  | 'blocked'
  | 'challenge'
  | 'invalid_content_type'
  | 'response_too_large';

export interface RetailFetchResult {
  ok: boolean;
  reachable: boolean;
  status: number | null;
  statusText: string;
  finalUrl: string;
  contentType: string;
  html: string;
  bodyPreview: string;
  failureType: RetailFetchFailure | null;
  error: string;
  durationMs: number;
}

const CHALLENGE_PATTERN = /cloudflare|cf-chl-|captcha|verify you are human|checking your browser|access denied|akamai|incapsula|datadome/i;

function compactPreview(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function classifyHttpFailure(status: number, bodyPreview: string): { type: RetailFetchFailure; message: string } {
  if (CHALLENGE_PATTERN.test(bodyPreview)) {
    return { type: 'challenge', message: `Retailer returned an anti-bot/challenge page (HTTP ${status}).` };
  }
  if (status === 403 || status === 401) {
    return { type: 'blocked', message: `Retailer blocked the server-side request (HTTP ${status}).` };
  }
  if (status === 429) {
    return { type: 'blocked', message: 'Retailer rate-limited the request (HTTP 429).' };
  }
  return { type: 'http_error', message: `Retailer returned HTTP ${status}.` };
}

export async function fetchRetailProductPage(
  url: string,
  options: { timeoutMs?: number; maxBytes?: number; referer?: string } = {},
): Promise<RetailFetchResult> {
  const startedAt = Date.now();
  const timeoutMs = Math.max(5_000, Math.min(options.timeoutMs ?? RETAIL_FETCH_TIMEOUT_MS, 35_000));
  const maxBytes = Math.max(100_000, Math.min(options.maxBytes ?? RETAIL_MAX_HTML_BYTES, 5 * 1024 * 1024));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        'User-Agent': RETAIL_BROWSER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        Referer: options.referer || new URL(url).origin + '/',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const contentLength = Number(response.headers.get('content-length') || 0);
    const finalUrl = response.url || url;

    if (contentLength > maxBytes) {
      const result: RetailFetchResult = {
        ok: false,
        reachable: response.status > 0,
        status: response.status,
        statusText: response.statusText,
        finalUrl,
        contentType,
        html: '',
        bodyPreview: '',
        failureType: 'response_too_large',
        error: `Retail product page exceeds ${Math.round(maxBytes / 1024 / 1024)} MB limit.`,
        durationMs: Date.now() - startedAt,
      };
      console.warn('[retailer-fetch]', { url, ...result, html: undefined });
      return result;
    }

    const body = await response.text();
    const bodyPreview = compactPreview(body);

    if (!response.ok) {
      const failure = classifyHttpFailure(response.status, bodyPreview);
      const result: RetailFetchResult = {
        ok: false,
        reachable: true,
        status: response.status,
        statusText: response.statusText,
        finalUrl,
        contentType,
        html: '',
        bodyPreview,
        failureType: failure.type,
        error: failure.message,
        durationMs: Date.now() - startedAt,
      };
      console.warn('[retailer-fetch]', { url, status: result.status, finalUrl, contentType, bodyPreview, failureType: result.failureType });
      return result;
    }

    if (body.length > maxBytes) {
      return {
        ok: false,
        reachable: true,
        status: response.status,
        statusText: response.statusText,
        finalUrl,
        contentType,
        html: '',
        bodyPreview,
        failureType: 'response_too_large',
        error: `Retail product page exceeds ${Math.round(maxBytes / 1024 / 1024)} MB limit.`,
        durationMs: Date.now() - startedAt,
      };
    }

    if (contentType && !/text\/html|application\/xhtml\+xml|application\/xml/i.test(contentType)) {
      return {
        ok: false,
        reachable: true,
        status: response.status,
        statusText: response.statusText,
        finalUrl,
        contentType,
        html: '',
        bodyPreview,
        failureType: 'invalid_content_type',
        error: `Retailer returned unsupported content type: ${contentType}.`,
        durationMs: Date.now() - startedAt,
      };
    }

    if (CHALLENGE_PATTERN.test(bodyPreview) && body.length < 250_000) {
      return {
        ok: false,
        reachable: true,
        status: response.status,
        statusText: response.statusText,
        finalUrl,
        contentType,
        html: '',
        bodyPreview,
        failureType: 'challenge',
        error: 'Retailer returned an anti-bot/challenge page instead of the product page.',
        durationMs: Date.now() - startedAt,
      };
    }

    return {
      ok: true,
      reachable: true,
      status: response.status,
      statusText: response.statusText,
      finalUrl,
      contentType,
      html: body,
      bodyPreview,
      failureType: null,
      error: '',
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const aborted = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
    const result: RetailFetchResult = {
      ok: false,
      reachable: false,
      status: null,
      statusText: '',
      finalUrl: url,
      contentType: '',
      html: '',
      bodyPreview: '',
      failureType: aborted ? 'timeout' : 'network_error',
      error: aborted
        ? `Retailer request timed out after ${Math.round(timeoutMs / 1000)} seconds.`
        : error instanceof Error ? error.message : 'Retail product page could not be fetched.',
      durationMs: Date.now() - startedAt,
    };
    console.warn('[retailer-fetch]', { url, failureType: result.failureType, error: result.error });
    return result;
  } finally {
    clearTimeout(timer);
  }
}
