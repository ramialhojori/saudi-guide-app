/** المجتمع: كل الطلبات للسيرفر في مكان واحد */
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { env } from '@/config/env';
import { api, ApiError } from './api';
import { session } from './auth';
import { brand } from '@/theme/tokens';

const TINTS = [brand.lilac, brand.sky, brand.pink, brand.orange, brand.green, brand.skyDeep, brand.pinkDeep];
export const tint = (id: string) => TINTS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
export const initial = (n: string) => (n || 'د').trim()[0] || 'د';

export type Author = { id: string; name: string; city: string; badge: string; points: number };
export type CPost = {
  id: number; kind: 'question' | 'tip' | 'photo'; city: string; placeId: number | null; text: string; photo: string;
  answers: number; thanks: number; best: number | null; created: number; author: Author; mine: boolean; thanked: boolean;
  bestAnswer: { text: string; name: string; badge: string } | null;
};
export type CAnswer = { id: number; text: string; thanks: number; created: number; author: Author; mine: boolean; thanked: boolean };

const tok = () => session().token;

export const feed = (o: { city?: string | null; kind?: string; before?: number; mine?: boolean } = {}) => {
  const q = new URLSearchParams();
  if (o.city) q.set('city', o.city);
  if (o.kind) q.set('kind', o.kind);
  if (o.before) q.set('before', String(o.before));
  if (o.mine) q.set('mine', '1');
  return api<{ posts: CPost[] }>(`/v1/community?${q}`, { token: tok() }).then((r) => r.posts);
};
export const getPost = (id: number) => api<{ post: CPost; answers: CAnswer[] }>(`/v1/community/${id}`, { token: tok() });
export const topHelpers = (city?: string | null) =>
  api<{ top: { id: string; name: string; answers: number; badge: string }[] }>(`/v1/community/top${city ? `?city=${city}` : ''}`).then((r) => r.top);

export const createPost = (b: { kind: string; city?: string | null; text: string; photo?: string; placeId?: number }) =>
  api<{ id: number }>('/v1/community', { method: 'POST', body: b, token: tok() });
export const answer = (postId: number, text: string) =>
  api<{ id: number }>(`/v1/community/${postId}/answers`, { method: 'POST', body: { text }, token: tok() });
export const thank = (target: 'p' | 'a', id: number) =>
  api<{ thanked: boolean; thanks: number }>(`/v1/community/${target === 'a' ? 'answers/' : ''}${id}/thanks`, { method: 'POST', token: tok() });
export const markBest = (postId: number, answerId: number | null) =>
  api<{ best: number | null }>(`/v1/community/${postId}/best`, { method: 'POST', body: { answerId }, token: tok() });
export const hideMine = (target: 'p' | 'a', id: number) =>
  api(`/v1/community/${target === 'a' ? 'answers/' : ''}${id}`, { method: 'DELETE', token: tok() });
export const report = (target: 'p' | 'a', id: number, reason: string) =>
  api('/v1/community/report', { method: 'POST', body: { target, id, reason }, token: tok() });
export const block = (userId: string) => api('/v1/community/block', { method: 'POST', body: { userId }, token: tok() });

/** نصغّر الصورة (أقصى عرض 1600) ونرفعها لـ R2 */
export async function uploadPhoto(uri: string): Promise<string> {
  const small = await manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.78, format: SaveFormat.JPEG });
  const blob = await (await fetch(small.uri)).blob();
  const res = await fetch(`${env.apiUrl}/v1/community/upload`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${tok()}` }, body: blob });
  const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !data?.url) throw new ApiError(data?.error || `http_${res.status}`, res.status);
  return data.url;
}

/** «قبل ٣ ساعات» */
export function ago(sec: number) {
  const d = Math.max(0, Math.floor(Date.now() / 1000) - sec);
  if (d < 60) return 'الحين';
  const m = Math.floor(d / 60), h = Math.floor(d / 3600), day = Math.floor(d / 86400);
  const n = (x: number, one: string, two: string, few: string, many: string) => (x === 1 ? one : x === 2 ? two : x <= 10 ? `${x} ${few}` : `${x} ${many}`);
  if (d < 3600) return 'قبل ' + n(m, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة');
  if (d < 86400) return 'قبل ' + n(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
  if (day < 30) return 'قبل ' + n(day, 'يوم', 'يومين', 'أيام', 'يوم');
  return new Date(sec * 1000).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long' });
}

/** رسائل الأخطاء بلغة الناس */
export function errText(e: unknown) {
  const c = (e as { code?: string })?.code;
  return ({
    login_required: 'سجّل دخولك أول.', too_short: 'اكتب شوي أكثر عشان يفهمونك.', rate_limited: 'وصلت الحد اليومي، جرّب بكرة.',
    network: 'ما فيه اتصال، تأكد من النت.', timeout: 'السيرفر تأخر، جرّب مرة ثانية.', bad_size: 'الصورة كبيرة مرة.', own_content: 'ما تقدر تشكر نفسك',
  } as Record<string, string>)[c || ''] || 'صار خطأ، جرّب بعد شوي.';
}

export const nAnswers = (n: number) => (n === 1 ? 'إجابة وحدة' : n === 2 ? 'إجابتين' : n <= 10 ? `${n} إجابات` : `${n} إجابة`);

export type Stats = {
  points: number; level: number; levelName: string; levelAt: number; nextAt: number | null; nextName: string | null;
  counts: { questions: number; tips: number; photos: number; answers: number; best: number; thanks: number; trip: number };
  badges: { id: string; name: string; icon: string; goal: number; have: number; earned: boolean }[];
  activity: { type: 'post' | 'answer'; postId: number; text: string; kind: string; thanks: number; created: number }[];
};
export const myStats = () => api<Stats>('/v1/me/stats', { token: tok() });
