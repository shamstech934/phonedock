/**
 * Safe fetch helper for Import Engine V2.
 * Fixes: "Unexpected token 'R', 'Request En...' is not valid JSON"
 * Handles HTML error pages, non-JSON responses, timeouts, AbortError.
 */

export interface SafeFetchResult<T = unknown> {
  ok: boolean;
  data: T | null;
  error: string;
  status: number;
}

export async function safeFetch<T = unknown>(
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

    const unwrapEnvelope = (value: unknown): T => {
      if (value && typeof value === 'object' && 'success' in value && 'data' in value) {
        return (value as { data: T }).data;
      }
      return value as T;
    };

    const extractError = (value: unknown): string => {
      if (!value || typeof value !== 'object') return '';
      const error = (value as { error?: unknown }).error;
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object') {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string') return message;
      }
      const message = (value as { message?: unknown }).message;
      return typeof message === 'string' ? message : '';
    };

    if (!res.ok) {
      let body: unknown = '';
      try { body = ct.includes('json') ? await res.json() : await res.text(); } catch { body = ''; }
      const msg = extractError(body)
        || (typeof body === 'string' && body.length < 200 ? body : '')
        || `HTTP ${res.status}`;
      return { ok: false, data: null, error: msg, status: res.status };
    }

    if (ct.includes('application/json')) {
      const data = await res.json();
      return { ok: true, data: unwrapEnvelope(data), error: '', status: res.status };
    }

    const text = await res.text();
    try {
      return { ok: true, data: unwrapEnvelope(JSON.parse(text)), error: '', status: res.status };
    } catch {
      return { ok: false, data: null, error: `Expected JSON, got ${ct}: ${text.substring(0, 100)}`, status: res.status };
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, data: null, error: 'Request timed out', status: 0 };
    }
    return { ok: false, data: null, error: err instanceof Error ? err.message : 'Network error', status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Post JSON with safe response handling.
 */
export async function safePost<T = unknown>(
  url: string,
  body: unknown,
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