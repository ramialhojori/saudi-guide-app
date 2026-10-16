/**
 * الصحف السعودية: قائمة الصحف، آخر أخبارها، والمتابعة («أخباري»)
 * - المتابعة تنحفظ في الجهاز (يشتغل بدون حساب)، ولو مسجّل تنحفظ في حسابه وتنتقل لأجهزته الثانية
 * - بعد أي تغيير نعيد تسجيل الجهاز عشان السيرفر يعرف وش يرسل له في الإشعار المجمّع
 * - الخبر يفتح في موقع الصحيفة نفسها
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { useSyncExternalStore } from 'react';
import { api } from './api';
import { session } from './auth';
import { registerPush } from './push';
import { happyMoment } from './review';

export type Paper = { id: string; name: string; site: string; logo: string | null; lang: 'ar' | 'en'; items: number };
export type PaperItem = { id: number; source: string; sourceName: string; logo: string | null; title: string; link: string; image: string | null; snippet: string; at: number };

const KEY = 'sg_papers_v1';
let follows: string[] = [];
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

AsyncStorage.getItem(KEY).then((v) => { try { follows = JSON.parse(v || '[]'); } catch { follows = []; } loaded = true; emit(); syncFromAccount(); }).catch(() => { loaded = true; });

/** لو مسجّل: ندمج متابعات الحساب مع الجهاز (مرة عند التشغيل) */
async function syncFromAccount() {
  const tk = session().token;
  if (!tk) return;
  try {
    const r = await api<{ sources: string[] }>('/v1/papers/follows', { token: tk });
    const merged = [...new Set([...follows, ...r.sources])];
    if (merged.length !== follows.length) { follows = merged; save(false); }
    if (merged.length !== r.sources.length) pushAccount();
  } catch { /* */ }
}
const pushAccount = () => { const tk = session().token; if (tk) api('/v1/papers/follows', { method: 'POST', body: { sources: follows }, token: tk }).catch(() => {}); };
function save(sync = true) {
  AsyncStorage.setItem(KEY, JSON.stringify(follows)).catch(() => {});
  emit();
  if (sync) { pushAccount(); registerPush(false).catch(() => {}); }
}

export function toggleFollow(id: string) {
  follows = follows.includes(id) ? follows.filter((x) => x !== id) : [...follows, id];
  save();
  // أول متابعة: نطلب إذن الإشعارات (لو ما انطلب) عشان يوصله الجديد
  if (follows.length === 1) registerPush(true).catch(() => {});
  else if (follows.includes(id)) happyMoment('paper_follow');
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useFollows = () => useSyncExternalStore(subscribe, () => follows);
export const followsLoaded = () => loaded;

export const getPapers = () => api<{ sources: Paper[] }>('/v1/papers').then((r) => r.sources);
export const getPapersFeed = (o: { sources?: string[]; before?: number; lang?: 'ar' | 'en' } = {}) => {
  const q = new URLSearchParams();
  if (o.sources?.length) q.set('s', o.sources.join(','));
  if (o.before) q.set('before', String(o.before));
  if (o.lang) q.set('l', o.lang);
  return api<{ items: PaperItem[]; more: boolean }>(`/v1/papers/feed?${q}`);
};

export function openPaperItem(it: PaperItem) {
  api(`/v1/papers/items/${it.id}/open`, { method: 'POST', body: {} }).catch(() => {});
  WebBrowser.openBrowserAsync(it.link).catch(() => {});
}
