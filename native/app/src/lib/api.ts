import { env } from '@/config/env';

export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = 'ApiError';
  }
}

/** طلب واحد للسيرفر — كل الشاشات تمر من content.ts اللي يستخدم هذي الدالة */
export async function api<T>(path: string, { method = 'GET', body, timeoutMs = 12000 }: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  if (!env.apiUrl) throw new ApiError('no_api', 0);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(env.apiUrl + path, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const code = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : `http_${res.status}`;
      throw new ApiError(code, res.status);
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(ctrl.signal.aborted ? 'timeout' : 'network', 0);
  } finally {
    clearTimeout(timer);
  }
}
