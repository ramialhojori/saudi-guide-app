import { env } from '@/config/env';
import { isEn } from './i18n';

export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = 'ApiError';
  }
}

/** طلب واحد للسيرفر — كل الشاشات تمر من content.ts اللي يستخدم هذي الدالة */
export async function api<T>(path: string, { method = 'GET', body, timeoutMs = 12000, token }: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; timeoutMs?: number; token?: string | null } = {}): Promise<T> {
  if (!env.apiUrl) throw new ApiError('no_api', 0);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // النسخة الإنجليزية: السيرفر يرجع المحتوى مترجم
    const url = env.apiUrl + path + (isEn && method === 'GET' && path.startsWith('/v1/') ? (path.includes('?') ? '&' : '?') + 'lang=en' : '');
    const res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
