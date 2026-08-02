/* eslint-disable @typescript-eslint/no-explicit-any */
export type ApiPayload = Record<string, any>;

export async function readApiResponse<T = ApiPayload>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();

  let payload: ApiPayload = {};
  if (raw.trim()) {
    if (contentType.includes('application/json')) {
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
      payload = { error: clean.slice(0, 240) || `Request failed with HTTP ${response.status}` };
    }
  }

  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed with HTTP ${response.status}`);
  }

  return payload as T;
}
