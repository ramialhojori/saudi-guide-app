/**
 * العروض الرسمية: عروض البنوك والمتاجر وتطبيقات التوصيل (منفصلة عن كوبونات المحلات في coupons.ts)
 * السيرفر يرجع الفعّالة بس (اللي ما انتهت)، وكل عرض معه رابط مصدره
 */
import { api } from './api';
import { t } from './i18n';

export type Offer = {
  id: number; store: string; category: string; city: string; cityName: string; value: number | null; unit: string; off: string; title: string;
  code: string; channel: string; sourceUrl: string; useUrl: string; startsAt: string; expiresAt: string; minOrder: number | null; maxDiscount: number | null;
  newOnly: boolean; deliveryApp: string; terms: string;
};

export const getOffers = (city?: string) => api<{ offers: Offer[] }>(`/v1/offers${city ? `?city=${city}` : ''}`).then((r) => r.offers);
/** عدّاد: نسخ الكود أو فتح الرابط (للوحة) */
export const offerOpened = (id: number, act: 'copy' | 'open') => api(`/v1/offers/${id}/open`, { method: 'POST', body: { act } }).catch(() => {});

export const OFFER_CATS: [string, string][] = [['food', t('مطاعم')], ['cafe', t('مقاهي')], ['hotel', t('فنادق')], ['fun', t('ترفيه')], ['shop', t('تسوق')], ['other', t('أخرى')]];
export const CHANNEL: Record<string, string> = { any: t('في المتجر وأونلاين'), store: t('في المتجر'), online: t('أونلاين'), app: t('من التطبيق'), delivery: t('تطبيقات التوصيل') };

/** نص الخصم الكبير في البطاقة */
export function offBadge(o: Offer) {
  const v = o.value != null ? +(+o.value).toFixed(2) : null;
  return ({ pct: v ? `${v}%` : t('خصم'), sar: v ? `${v} ${t('ر.س')}` : t('خصم'), gift: t('هدية'), bogo: '1+1', free_delivery: t('توصيل مجاني'), fixed_price: v ? `${v} ${t('ر.س')}` : t('سعر خاص'), cashback: v ? `${v}%` : t('كاش باك'), other: t('عرض') } as Record<string, string>)[o.unit] || t('عرض');
}
/** كم يوم باقي على الانتهاء (بتوقيت مكة)، أو null لو بدون تاريخ */
export function daysLeft(o: Offer) {
  if (!o.expiresAt) return null;
  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  return Math.round((Date.parse(o.expiresAt) - Date.parse(today)) / 86400e3);
}
