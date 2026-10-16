/** تعليقات الأخبار (السيرفر يراجع كل تعليق قبل النشر، والمسيء ينرفض فوراً) */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { api } from './api';
import { session } from './auth';
import { t } from './i18n';

export type Comment = { id: number; text: string; created: number; mine: boolean; status: 'visible' | 'pending'; author: { name: string; city: string } };
const tok = () => session().token;

export const getComments = (articleId: number) => api<{ comments: Comment[]; count: number }>(`/v1/articles/${articleId}/comments`, { token: tok() });
export const postComment = (articleId: number, text: string) => api<{ id: number; status: 'visible' | 'pending' }>(`/v1/articles/${articleId}/comments`, { method: 'POST', body: { text }, token: tok() });
export const reportComment = (id: number) => api(`/v1/comments/${id}/report`, { method: 'POST', body: {}, token: tok() });

export function commentErr(e: unknown) {
  const x = e as { code?: string };
  return ({
    login_required: t('سجّل دخولك عشان تعلّق.'), too_short: t('اكتب تعليقك أول.'), cooldown: t('وقفنا تعليقاتك يوم لأن أكثر من تعليق انرفض. خلّ أسلوبنا محترم.'),
    rate_limited: t('علّقت كثير اليوم، كمّل بكرة.'), suspended: t('مشاركتك موقوفة مؤقتاً.'), disabled: t('التعليقات متوقفة حالياً.'), already_reported: t('بلّغت عن هالتعليق قبل.'),
    network: t('ما فيه اتصال، تأكد من النت.'),
  } as Record<string, string>)[x?.code || ''] || t('صار خطأ، جرّب بعد شوي.');
}

/* حجم خط الأخبار: يتحفظ في الجوال ويتطبق على كل الأخبار */
const KEY = 'sg_font_scale';
export const FONT_STEPS = [0.9, 1, 1.15, 1.3, 1.5];
let scale = 1;
const subs = new Set<(v: number) => void>();
AsyncStorage.getItem(KEY).then((v) => { const n = Number(v); if (FONT_STEPS.includes(n)) { scale = n; subs.forEach((f) => f(n)); } }).catch(() => {});
export function useFontScale(): [number, (dir: 1 | -1) => void] {
  const [v, setV] = useState(scale);
  useEffect(() => { subs.add(setV); return () => { subs.delete(setV); }; }, []);
  const step = (dir: 1 | -1) => {
    const i = Math.max(0, Math.min(FONT_STEPS.length - 1, FONT_STEPS.indexOf(scale) + dir));
    scale = FONT_STEPS[i];
    AsyncStorage.setItem(KEY, String(scale)).catch(() => {});
    subs.forEach((f) => f(scale));
  };
  return [v, step];
}
