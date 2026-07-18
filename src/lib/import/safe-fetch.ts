/**
 * Safe fetch helper for Import Engine V2.
 * Fixes: "Unexpected token 'R', 'Request En...' is not valid JSON"
 * Handles HTML error pages, non-JSON responses, timeouts, AbortError.
 */

interface SafeFetchResult<T = any> {
  ok: boolean;
  data: T | null;
  error: string;
  status: number;
}

export async function safeFetch<T = any>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 120000,
): Promise<SafeFetchResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const ct = (res.headers.get('content-type') || '').toLowerCase();

    if (!res.ok) {
      let body = '';
      try { body = ct.includes('json') ? await res.json() : await res.text(); } catch { body = ''; }
      const msg = typeof body === 'object' && body?.error ? body.error
        : typeof body === 'string' && body.length < 200 ? body
        : `HTTP ${res.status}`;
      return { ok: false, data: null, error: msg, status: res.status };
    }

    if (ct.includes('application/json')) {
      const data = await res.json();
      return { ok: true, data, error: '', status: res.status };
    }

    const text = await res.text();
    try {
      return { ok: true, data: JSON.parse(text) as T, error: '', status: res.status };
    } catch {
      return { ok: false, data: null, error: `Expected JSON, got ${ct}: ${text.substring(0, 100)}`, status: res.status };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, data: null, error: 'Request timed out', status: 0 };
    }
    return { ok: false, data: null, error: err.message || 'Network error', status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Post JSON with safe response handling.
 */
export async function safePost<T = any>(
  url: string,
  body: any,
  options: RequestInit = {},
  timeoutMs = 120000,
): Promise<SafeFetchResult<T>> {
  return safeFetch<T>(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
  }, timeoutMs);
}