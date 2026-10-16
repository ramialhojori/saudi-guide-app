/** الذكاء الاصطناعي (دليل+): «اسأل الدليل» و«خطط لي رحلة» الذكي — كله عن طريق سيرفرنا */
import { api } from './api';
import { session } from './auth';
import { t } from './i18n';

const tok = () => session().token;
export type Quota = { plus: boolean; limit: number | null; used: number; left: number | null };
export type AiStatus = { login: boolean; chat: boolean; plan: boolean; quota?: { chat: Quota; plan: Quota } };
export type AiPlace = { id: number; title: string; city: string; kinds: string[]; thumb: string; summary: string };
export type AiEvent = { id: number; title: string; city: string; start: string; end: string; thumb: string };
export type AiAnswer = { answer: string; places: AiPlace[]; events: AiEvent[]; followups: string[]; quota: Quota };
export type AiMsg = { role: 'user' | 'assistant'; content: string; places?: AiPlace[]; events?: AiEvent[]; followups?: string[] };

export const aiStatus = () => api<AiStatus>('/v1/ai/status', { token: tok() });
export const aiAsk = (messages: AiMsg[], city?: string | null) =>
  api<AiAnswer>('/v1/ai/ask', { method: 'POST', token: tok(), timeoutMs: 60000, body: { city, messages: messages.map((m) => ({ role: m.role, content: m.content })) } });

export type AiStop = { type: 'place' | 'event'; id: number; time: string; why: string; title: string; thumb: string; kinds?: string[]; summary?: string; start?: string; address?: string };
export type AiPlan = { title: string; days: { title: string; stops: AiStop[] }[]; tips: string[]; quota: Quota };
export const aiPlan = (b: { city: string; days: number; start?: string; party?: string; budget?: string; pace?: string; interests: string[]; notes?: string }) =>
  api<AiPlan>('/v1/ai/plan', { method: 'POST', token: tok(), timeoutMs: 90000, body: b });

export function aiErr(e: unknown) {
  const c = (e as { code?: string })?.code;
  return ({
    login_required: t('سجّل دخولك عشان تستخدم المساعد.'), quota: t('خلصت محاولاتك المجانية لليوم. مع دليل+ تستخدمه بدون حد، أو ارجع بكرة.'),
    plus_required: t('الخطة الذكية خاصة بمشتركين دليل+.'), plan_quota: t('استخدمت خطتك الذكية المجانية لهالشهر. جرّب دليل+ 3 أيام مجاناً وخطط كل رحلاتك بدون حد.'), feature_off: t('الميزة متوقفة مؤقتاً.'), ai_not_configured: t('المساعد مو جاهز للحين.'), ai_failed: t('ما قدرنا نجهز الرد، جرّب مرة ثانية.'),
    timeout: t('تأخر الرد، جرّب مرة ثانية.'), network: t('ما فيه اتصال، تأكد من النت.'),
  } as Record<string, string>)[c || ''] || t('صار خطأ، جرّب بعد شوي.');
}
