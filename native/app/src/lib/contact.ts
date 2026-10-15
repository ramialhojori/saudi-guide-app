/** «تواصل معنا» والصفحات القانونية — كلها من سيرفرنا، بدون الموقع القديم */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';
import { session } from './auth';

const tok = () => session().token;
export type ContactKind = { id: string; name: string };
export type ContactMsg = { id: number; kind: string; kindName: string; text: string; status: string; reply: string; replied: number | null; created: number };
export const CONTACT_KINDS: (ContactKind & { icon: string; hint: string })[] = [
  { id: 'suggestion', name: 'اقتراح أو فكرة', icon: 'spark', hint: 'وش تحب نضيف أو نحسّن في الدليل؟' },
  { id: 'complaint', name: 'شكوى', icon: 'flag', hint: 'وش اللي صار بالضبط؟ ومتى؟' },
  { id: 'correction', name: 'تصحيح معلومة', icon: 'edit', hint: 'اسم المكان أو الفعالية، ووش الصحيح؟' },
  { id: 'bug', name: 'مشكلة في التطبيق', icon: 'gear', hint: 'وش كنت تسوي لما طلعت المشكلة؟' },
  { id: 'ads', name: 'إعلان أو شراكة', icon: 'shop', hint: 'عرّفنا على جهتك ووش تبي تعلن عنه.' },
  { id: 'merchant', name: 'استفسار تاجر', icon: 'ticket', hint: 'اسم نشاطك ومدينتك واستفسارك.' },
  { id: 'question', name: 'سؤال', icon: 'chat', hint: 'اكتب سؤالك وبنرد عليك هنا.' },
  { id: 'other', name: 'شي ثاني', icon: 'info', hint: 'اكتب رسالتك.' },
];
export const sendContact = (kind: string, text: string, replyTo?: string) =>
  api<{ ok: boolean; id: number }>('/v1/contact', { method: 'POST', token: tok(), body: { kind, text, reply_to: replyTo, app: `${Platform.OS} ${Constants.expoConfig?.version ?? ''}` } });
export const myContact = () => api<{ items: ContactMsg[] }>('/v1/contact/mine', { token: tok() }).then((r) => r.items);
export type LegalDoc = { title: string; intro: string; sections: [string, string[]][]; date: string };
export const getLegal = (doc: 'privacy' | 'terms' | 'community') => api<LegalDoc>(`/v1/legal/${doc}`);
