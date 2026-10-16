/** «تواصل معنا» والصفحات القانونية — كلها من سيرفرنا، بدون الموقع القديم */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';
import { session } from './auth';
import { t } from './i18n';

const tok = () => session().token;
export type ContactKind = { id: string; name: string };
export type ContactMsg = { id: number; kind: string; kindName: string; text: string; status: string; reply: string; replied: number | null; created: number };
export const CONTACT_KINDS: (ContactKind & { icon: string; hint: string })[] = [
  { id: 'suggestion', name: t('اقتراح أو فكرة'), icon: 'spark', hint: t('وش تحب نضيف أو نحسّن في الدليل؟') },
  { id: 'complaint', name: t('شكوى'), icon: 'flag', hint: t('وش اللي صار بالضبط؟ ومتى؟') },
  { id: 'correction', name: t('تصحيح معلومة'), icon: 'edit', hint: t('اسم المكان أو الفعالية، ووش الصحيح؟') },
  { id: 'bug', name: t('مشكلة في التطبيق'), icon: 'gear', hint: t('وش كنت تسوي لما طلعت المشكلة؟') },
  { id: 'ads', name: t('إعلان أو شراكة'), icon: 'shop', hint: t('عرّفنا على جهتك ووش تبي تعلن عنه.') },
  { id: 'merchant', name: t('استفسار تاجر'), icon: 'ticket', hint: t('اسم نشاطك ومدينتك واستفسارك.') },
  { id: 'question', name: t('سؤال'), icon: 'chat', hint: t('اكتب سؤالك وبنرد عليك هنا.') },
  { id: 'other', name: t('شي ثاني'), icon: 'info', hint: t('اكتب رسالتك.') },
];
export const sendContact = (kind: string, text: string, replyTo?: string) =>
  api<{ ok: boolean; id: number }>('/v1/contact', { method: 'POST', token: tok(), body: { kind, text, reply_to: replyTo, app: `${Platform.OS} ${Constants.expoConfig?.version ?? ''}` } });
export const myContact = () => api<{ items: ContactMsg[] }>('/v1/contact/mine', { token: tok() }).then((r) => r.items);
export type LegalDoc = { title: string; intro: string; sections: [string, string[]][]; date: string };
export const getLegal = (doc: 'privacy' | 'terms' | 'community') => api<LegalDoc>(`/v1/legal/${doc}`);
