/**
 * شراء «دليل+» من آبل (StoreKit 2 عن طريق expo-iap).
 * - الشراء يرجع «إيصال» موقّع من آبل → نرسله للسيرفر يتحقق منه ويفعّل دليل+ للحساب → بعدها نقفل العملية عند آبل
 * - أي عملية ما انقفلت (انقطاع نت، تجديد تلقائي) ترجع تلقائياً أول ما يفتح التطبيق ونعالجها بنفس الطريقة
 * - appAccountToken = معرّف الحساب عندنا، عشان آبل تربط الاشتراك بالحساب
 */
import { Platform } from 'react-native';
import { api, ApiError } from './api';
import { session, setPlusUntil } from './auth';

export const PLUS_SKUS = { yearly: 'com.yearly', monthly: 'com.monthly' } as const;
export type PlusPlan = keyof typeof PLUS_SKUS;

/* eslint-disable @typescript-eslint/no-explicit-any */
let mod: any = null;
function iap(): any {
  if (mod) return mod;
  if (Platform.OS !== 'ios') throw new IapError('not_ios');
  try { mod = require('expo-iap'); } catch { throw new IapError('needs_update'); }
  return mod;
}

export class IapError extends Error {}

/** رسالة مفهومة للمستخدم */
export function iapMessage(e: unknown): string {
  const m = String((e as Error)?.message || e);
  if (m === 'not_ios') return 'الاشتراك متوفر حالياً من تطبيق الآيفون.';
  if (m === 'needs_update') return 'حدّث التطبيق لآخر نسخة عشان تقدر تشترك.';
  if (m === 'login_required') return 'سجّل دخولك أول عشان يرتبط الاشتراك بحسابك.';
  if (m === 'no_products') return 'ما قدرنا نجيب الأسعار من App Store. تأكد من النت وجرّب مرة ثانية.';
  if (m === 'nothing_to_restore') return 'ما لقينا اشتراك سابق على حساب Apple هذا.';
  return `ما قدرنا نكمل الاشتراك. جرّب مرة ثانية (${m.slice(0, 50)})`;
}

let connected: Promise<void> | null = null;
let listening = false;
const waiters = new Set<{ ok: (v: number) => void; fail: (e: unknown) => void }>();

async function verify(jws: string | string[]): Promise<number> {
  const token = session().token;
  if (!token) throw new IapError('login_required');
  const r = await api<{ ok?: boolean; plusUntil: number }>('/v1/iap/apple', { method: 'POST', body: { jws }, token });
  setPlusUntil(r.plusUntil || 0);
  return r.plusUntil || 0;
}

/** يجهز الاتصال بالمتجر ويستقبل كل عمليات الشراء (الجديدة واللي رجعت) */
export function startIap() {
  if (Platform.OS !== 'ios') return Promise.resolve();
  connected ??= (async () => {
    const m = iap();
    await m.initConnection();
    if (listening) return;
    listening = true;
    m.purchaseUpdatedListener(async (p: any) => {
      try {
        if (!p?.purchaseToken || !session().token) return; // بدون حساب: تبقى العملية مفتوحة لين يسجّل
        const until = await verify(p.purchaseToken);
        await m.finishTransaction({ purchase: p, isConsumable: false }).catch(() => {});
        waiters.forEach((w) => w.ok(until));
      } catch (e) {
        waiters.forEach((w) => w.fail(e));
      } finally { waiters.clear(); }
    });
    m.purchaseErrorListener((e: any) => {
      const cancelled = e?.code === 'user-cancelled' || /cancel/i.test(String(e?.code || e?.message));
      waiters.forEach((w) => w.fail(cancelled ? new IapError('cancelled') : e));
      waiters.clear();
    });
  })().catch((e) => { connected = null; throw e; });
  return connected;
}

export type PlanPrice = { id: PlusPlan; price: string; trial: boolean };

/** الأسعار من App Store بعملة جهاز المستخدم */
export async function loadPrices(): Promise<PlanPrice[]> {
  await startIap();
  const list: any[] = await iap().fetchProducts({ skus: Object.values(PLUS_SKUS), type: 'subs' });
  if (!list?.length) throw new IapError('no_products');
  return (Object.keys(PLUS_SKUS) as PlusPlan[]).flatMap((id) => {
    const p = list.find((x) => x.id === PLUS_SKUS[id]);
    return p ? [{ id, price: p.displayPrice, trial: p.introductoryPricePaymentModeIOS === 'free-trial' || p.introductoryPricePaymentModeIOS === 'FREE_TRIAL' }] : [];
  });
}

/** يفتح نافذة الدفع من آبل؛ يرجع نهاية الاشتراك (ثواني) أو يرمي IapError('cancelled') */
export async function buyPlus(plan: PlusPlan): Promise<number> {
  const u = session().user;
  if (!u) throw new IapError('login_required');
  await startIap();
  const done = new Promise<number>((ok, fail) => waiters.add({ ok, fail }));
  await iap().requestPurchase({ request: { apple: { sku: PLUS_SKUS[plan], appAccountToken: u.id } }, type: 'subs' });
  return done;
}

/** «استعادة المشتريات»: يرسل كل اشتراكات حساب Apple للسيرفر */
export async function restorePlus(): Promise<number> {
  if (!session().user) throw new IapError('login_required');
  await startIap();
  const m = iap();
  await m.restorePurchases().catch(() => {});
  const list: any[] = await m.getAvailablePurchases();
  const jws = list.filter((p) => Object.values(PLUS_SKUS).includes(p.productId) && p.purchaseToken).map((p) => p.purchaseToken);
  if (!jws.length) throw new IapError('nothing_to_restore');
  try { return await verify(jws); } catch (e) {
    if (e instanceof ApiError) return 0;
    throw e;
  }
}

/** يفتح صفحة إدارة الاشتراكات في App Store */
export const manageSubscriptions = () => iap().deepLinkToSubscriptions({}).catch(() => {});
