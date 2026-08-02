/* eslint-disable @typescript-eslint/no-explicit-any */
export type ApiPayload = Record<string, any>;

/**
 * Reads an API response without ever trying to parse an HTML/Vercel error page
 * as JSON. Existing callers may omit T during the project-wide migration; new
 * code should provide an explicit response interface.
 */
export async function readApiResponse<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();

  let payload: ApiPayload = {};
  if (raw.trim()) {
    if (contentType.includes('application/json') || contentType.includes('+json')) {
      try {
        payload = JSON.parse(raw) as ApiPayload;
      } catch {
        payload = { error: 'The server returned malformed JSON.' };
      }
    } else {
      const clean = raw
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      payload = {
        error: clean.slice(0, 300) || `Request failed with HTTP ${response.status}`,
      };
    }
  }

  if (!response.ok) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : typeof payload.message === 'string'
          ? payload.message
          : `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}
