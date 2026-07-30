import { z } from 'zod';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
export const API_BASE_URL = (configuredBaseUrl || 'https://phonedock-pi.vercel.app').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = RequestInit & { timeoutMs?: number };

export async function apiRequest<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.infer<S>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...options.headers },
    });
    const requestId = response.headers.get('x-request-id') || undefined;
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const safeMessage =
        body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : 'PhoneDock is temporarily unavailable.';
      throw new ApiError(safeMessage, response.status, requestId);
    }
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof z.ZodError) throw new ApiError('The server returned an unsupported response.', 502);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('The request took too long. Please try again.', 408);
    }
    throw new ApiError('Please check your internet connection and try again.', 0);
  } finally {
    clearTimeout(timeout);
  }
}
