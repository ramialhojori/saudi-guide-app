/**
 * العروض الرسمية: عروض البنوك والمتاجر وتطبيقات التوصيل (منفصلة عن كوبونات المحلات في coupons.ts)
 * السيرفر يرجع الفعّالة بس (اللي ما انتهت)، وكل عرض معه رابط مصدره
 */
import { api } from './api';
import { t } from './i18n';

export type Offer = {
  id: number; store: string; category: string; city: string; cityName: string; value: number | null; unit: string; off: string; title: string;
  code: string; channel: string; sourceUrl: string; useUrl: string; startsAt: string; expiresAt: string; minOrder: number | null; maxDiscount: number | null;
  newOnly: boolean; deliveryApp: string; terms: string; plusOnly?: boolean; hasCode?: boolean;
};

export const getOffers = (city?: string) => api<{ offers: Offer[] }>(`/v1/offers${city ? `?city=${city}` : ''}`).then((r) => r.offers);
/** عدّاد: نسخ الكود أو فتح الرابط (للوحة) */
/** كود عرض حصري (للمشترك في دليل+) */
export const getPlusCode = (id: number, token: string) => api<{ code: string }>(`/v1/offers/${id}/code`, { token }).then((r) => r.code);
export const offerOpened = (id: number, act: 'copy' | 'open') => api(`/v1/offers/${id}/open`, { method: 'POST', body: { act } }).catch(() => {});

export const OFFER_CATS: [string, string][] = [
  ['food', t('مطاعم')], ['cafe', t('مقاهي')], ['delivery', t('توصيل')], ['grocery', t('سوبرماركت')], ['hotel', t('فنادق')], ['travel', t('طيران وسفر')],
  ['car', t('تأجير سيارات')], ['fun', t('ترفيه')], ['shop', t('تسوق وأزياء')], ['electronics', t('إلكترونيات')], ['beauty', t('صحة وجمال')], ['other', t('أخرى')],
];
/** لون وأيقونة كل تصنيف (بطاقة العرض وفلتر التصنيفات) */
export const OFFER_STYLE: Record<string, { color: string; icon: string }> = {
  food: { color: '#E8833A', icon: 'food' }, cafe: { color: '#8E65AB', icon: 'cafe' }, delivery: { color: '#D9534F', icon: 'nav' }, grocery: { color: '#3E9B6B', icon: 'bag' },
  hotel: { color: '#604C87', icon: 'star' }, travel: { color: '#2E86B8', icon: 'globe' }, car: { color: '#4A5A78', icon: 'route' }, fun: { color: '#C2456B', icon: 'fun' },
  shop: { color: '#B8682E', icon: 'shop' }, electronics: { color: '#3B6FD4', icon: 'phone' }, beauty: { color: '#C25D9A', icon: 'spark' }, other: { color: '#7A7290', icon: 'ticket' },
};
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
