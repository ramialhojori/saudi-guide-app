import { Platform } from 'react-native';
/** المجتمع: كل الطلبات للسيرفر في مكان واحد */
import { File, UploadType } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { env } from '@/config/env';
import { api, ApiError } from './api';
import { session } from './auth';
import { isEn, t, tr } from './i18n';
import { brand } from '@/theme/tokens';

const TINTS = [brand.lilac, brand.sky, brand.pink, brand.orange, brand.green, brand.skyDeep, brand.pinkDeep];
export const tint = (id: string) => TINTS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
export const initial = (n: string) => (n || 'د').trim()[0] || 'د';

export type Author = { id: string; name: string; city: string; badge: string; points: number };
export type CPost = {
  id: number; kind: 'question' | 'tip' | 'photo'; city: string; placeId: number | null; text: string; photo: string;
  answers: number; thanks: number; best: number | null; created: number; author: Author; mine: boolean; thanked: boolean;
  bestAnswer: { text: string; name: string; badge: string } | null;
  /** سؤال له يوم بدون رد: أول إجابة نقاطها مضاعفة */
  double?: boolean;
  /** يجي بس لصاحب المشاركة لو ما انتشرت */
  status?: 'pending' | 'rejected'; modReason?: string;
};
export type CAnswer = { id: number; text: string; thanks: number; created: number; author: Author; mine: boolean; thanked: boolean; expert?: string };

const tok = () => session().token;

export const feed = (o: { city?: string | null; kind?: string; before?: number; mine?: boolean; open?: boolean; q?: string } = {}) => {
  const q = new URLSearchParams();
  if (o.city) q.set('city', o.city);
  if (o.kind) q.set('kind', o.kind);
  if (o.before) q.set('before', String(o.before));
  if (o.mine) q.set('mine', '1');
  if (o.open) q.set('open', '1');
  if (o.q?.trim()) q.set('q', o.q.trim());
  return api<{ posts: CPost[] }>(`/v1/community?${q}`, { token: tok() }).then((r) => r.posts);
};
/** أسئلة مشابهة مجاوبة (وهو يكتب سؤاله) */
export const similarQuestions = (text: string, city?: string | null) =>
  api<{ posts: { id: number; text: string; city: string; answers: number }[] }>(`/v1/community/similar?q=${encodeURIComponent(text)}${city ? `&city=${city}` : ''}`).then((r) => r.posts).catch(() => []);
/** «خلاصة الزوار» الذكية للمكان */
export const placeSummary = (id: number) => api<{ summary: { text: string; count: number } | null }>(`/v1/places/${id}/summary`).then((r) => r.summary).catch(() => null);
export type CityActivity = { id: string; posts: number; open: number };
/** نشاط المدن في المجتمع (آخر 90 يوم) */
export const communityCities = () => api<{ cities: CityActivity[] }>('/v1/community/cities').then((r) => r.cities).catch(() => [] as CityActivity[]);
export const getPost = (id: number) => api<{ post: CPost; answers: CAnswer[] }>(`/v1/community/${id}`, { token: tok() });
export const topHelpers = (city?: string | null) =>
  api<{ top: { id: string; name: string; answers: number; badge: string }[] }>(`/v1/community/top${city ? `?city=${city}` : ''}`).then((r) => r.top);

export const createPost = (b: { kind: string; city?: string | null; text: string; photo?: string; placeId?: number }) =>
  api<{ id: number; status?: 'visible' | 'pending' | 'rejected'; message?: string }>('/v1/community', { method: 'POST', body: b, token: tok() });
export const answer = (postId: number, text: string) =>
  api<{ id: number; status?: 'visible' | 'pending' | 'rejected'; message?: string; points?: number }>(`/v1/community/${postId}/answers`, { method: 'POST', body: { text }, token: tok() });
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
  const url = `${env.apiUrl}/v1/community/upload`;
  const headers = { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${tok()}` };
  let status = 0, body = '';
  if (Platform.OS === 'web') {
    const blob = await (await fetch(small.uri)).blob();
    const res = await fetch(url, { method: 'POST', headers, body: blob });
    status = res.status; body = await res.text();
  } else {
    // الجوال: رفع الملف نفسه بالطريقة الرسمية (fetch مع Blob يرسل الصورة فاضية أحياناً على الآيفون)
    const r = await new File(small.uri).upload(url, { httpMethod: 'POST', uploadType: UploadType.BINARY_CONTENT, headers, mimeType: 'image/jpeg', sessionType: 'foreground' });
    status = r.status; body = r.body;
  }
  let data: { url?: string; error?: string } | null = null;
  try { data = JSON.parse(body); } catch { /* */ }
  if (status < 200 || status >= 300 || !data?.url) throw new ApiError(data?.error || `upload_${status}`, status);
  return data.url;
}

/** «قبل ٣ ساعات» */
export function ago(sec: number) {
  const d = Math.max(0, Math.floor(Date.now() / 1000) - sec);
  if (d < 60) return tr('الحين', 'Just now');
  const m = Math.floor(d / 60), h = Math.floor(d / 3600), day = Math.floor(d / 86400);
  const n = (x: number, one: string, two: string, few: string, many: string) => (x === 1 ? one : x === 2 ? two : x <= 10 ? `${x} ${few}` : `${x} ${many}`);
  const en = (x: number, u: string) => `${x} ${u}${x === 1 ? '' : 's'} ago`;
  if (d < 3600) return isEn ? en(m, 'min') : 'قبل ' + n(m, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة');
  if (d < 86400) return isEn ? en(h, 'hour') : 'قبل ' + n(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
  if (day < 30) return isEn ? en(day, 'day') : 'قبل ' + n(day, 'يوم', 'يومين', 'أيام', 'يوم');
  return new Date(sec * 1000).toLocaleDateString(isEn ? 'en-GB' : 'ar-SA-u-ca-gregory', { day: 'numeric', month: 'long' });
}

/** رسائل الأخطاء بلغة الناس */
export function errText(e: unknown) {
  const c = (e as { code?: string })?.code;
  return ({
    login_required: t('سجّل دخولك أول.'), too_short: t('اكتب شوي أكثر عشان يفهمونك.'), rate_limited: t('وصلت الحد اليومي، جرّب بكرة.'),
    network: t('ما فيه اتصال، تأكد من النت.'), timeout: t('السيرفر تأخر، جرّب مرة ثانية.'), bad_size: t('الصورة كبيرة مرة.'), own_content: t('ما تقدر تشكر نفسك'),
  } as Record<string, string>)[c || ''] || t('صار خطأ، جرّب بعد شوي.');
}

export const nAnswers = (n: number) => (isEn ? `${n} answer${n === 1 ? '' : 's'}` : n === 1 ? 'إجابة وحدة' : n === 2 ? 'إجابتين' : n <= 10 ? `${n} إجابات` : `${n} إجابة`);

export type Stats = {
  balance: number; spent: number; role: string; impact: Impact | null;
  guide: { eligible: boolean; at: number; request: { status: 'pending' | 'approved' | 'rejected'; note: string } | null };
  points: number; level: number; levelName: string; levelAt: number; nextAt: number | null; nextName: string | null;
  counts: { questions: number; tips: number; photos: number; answers: number; best: number; thanks: number; trip: number };
  badges: { id: string; name: string; icon: string; goal: number; have: number; earned: boolean }[];
  activity: { type: 'post' | 'answer'; postId: number; text: string; kind: string; thanks: number; created: number }[];
};
export const myStats = () => api<Stats>('/v1/me/stats', { token: tok() });
export const requestGuide = (about: string) => api('/v1/me/guide', { method: 'POST', body: { about }, token: tok() });

/* ——— المساهمة: الأسئلة السريعة، الاقتراحات، أبطال الشهر ——— */
export type Fact = { k: string; q: string; yes: number; no: number; mine: 0 | 1 | null };
export const placeFacts = (id: number) => api<{ facts: Fact[]; ask: { k: string; q: string } | null }>(`/v1/places/${id}/facts`, { token: tok() });
export const answerFact = (id: number, k: string, v: 0 | 1) => api<{ ok: true; points: number }>(`/v1/places/${id}/facts`, { method: 'POST', body: { k, v }, token: tok() });
export const suggest = (b: { type: 'edit' | 'new' | 'closed'; placeId?: number; data: Record<string, unknown> }) =>
  api<{ id: number; status?: 'pending' | 'rejected'; message?: string }>('/v1/suggestions', { method: 'POST', body: b, token: tok() });
export type Similar = { id: number; title: string; city: string; thumb: string; why: string };
/** «هل تقصد…؟» قبل إضافة مكان */
export const similarPlaces = (o: { title: string; city?: string; lat?: number; lng?: number }) => {
  const q = new URLSearchParams({ title: o.title });
  if (o.city) q.set('city', o.city);
  if (o.lat && o.lng) { q.set('lat', String(o.lat)); q.set('lng', String(o.lng)); }
  return api<{ similar: Similar[] }>(`/v1/places/similar?${q}`).then((r) => r.similar).catch(() => [] as Similar[]);
};
export type Hero = { id: string; name: string; city: string; score: number; answers: number; reviews: number; visits: number; guide: boolean };
export const cityHeroes = (city?: string | null) => api<{ month: string; heroes: Hero[] }>(`/v1/community/heroes${city ? `?city=${city}` : ''}`);
export type Impact = { views: number; photoViews: number; thanks: number; helped: number; facts: number; suggestions: number };
