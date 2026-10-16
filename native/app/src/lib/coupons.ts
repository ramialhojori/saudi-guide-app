/** الكوبونات وبوابة التجار: كل الطلبات للسيرفر في مكان واحد */
import { api } from './api';
import { session } from './auth';
import { isEn, t } from './i18n';

export type Biz = { id: number; name: string; kind: string; city: string; area: string; photo: string; verified: boolean; featured?: boolean; placeId: number | null; lat: number | null; lng: number | null; trust?: { n: number; ok: number; pct: number | null } };
export type Coupon = {
  id: number; kind: 'percent' | 'amount' | 'bogo' | 'gift'; value: string; off: string; title: string; terms: string; minOrder: number | null;
  perUser: boolean; qty: number | null; used: number; left: number | null; views: number; hours: string; start: string; end: string;
  status: 'pending' | 'active' | 'paused' | 'rejected' | 'hidden'; note: string; created: number;
  points: number; minLevel: number; levelName: string; license: string; saved?: boolean; usedByMe?: number; biz?: Biz;
};
export type Merchant = {
  id: number; name: string; name_en: string; kind: string; city: string; area: string; lat: number | null; lng: number | null; placeId: number | null;
  photos: string[]; hours: string; phone: string; cr: string; verified: boolean; maxCoupons: number; status: 'pending' | 'approved' | 'rejected' | 'hidden'; note: string;
  termsVersion: string; termsAt: number | null; termsOk: boolean;
  plan?: 'free' | 'plus' | 'pro'; planName?: string; planUntil?: number | null;
};
export type MStats = { used: number; saves: number; views: number; week: number[]; today: number };

export const BIZ_KINDS: [string, string][] = [['restaurant', t('مطعم')], ['cafe', t('مقهى')], ['sweets', t('مخبز وحلويات')], ['juice', t('عصيرات ومشروبات')], ['dates', t('تمور ومنتجات محلية')], ['perfume', t('عطور وبخور')], ['gifts', t('هدايا وتذكارات')], ['clothing', t('ملابس وعبايات')], ['shop', t('متجر')], ['mall', t('مول ومركز تسوق')], ['hotel', t('فندق وشقق فندقية')], ['resort', t('منتجع واستراحة')], ['experience', t('تجربة سياحية')], ['tours', t('جولات ومنظم رحلات')], ['fun', t('ترفيه وألعاب')], ['car', t('تأجير سيارات ونقل')], ['umrah', t('خدمات الحج والعمرة')], ['salon', t('صالون ومشغل')], ['other', t('نشاط آخر')]];
export const bizKind = (k: string) => BIZ_KINDS.find((x) => x[0] === k)?.[1] ?? '';
/** لون الكوبون حسب نوع النشاط (من ألوان الهوية) */
export const couponColor = (k?: string) => ({
  restaurant: '#F89743', cafe: '#8E65AB', sweets: '#EB839B', juice: '#E07B22', dates: '#B5762E', perfume: '#8E65AB', gifts: '#C9506F',
  clothing: '#604C87', shop: '#2E86B8', mall: '#2E86B8', hotel: '#604C87', resort: '#3E8E5A', experience: '#3E8E5A', tours: '#2E86B8',
  fun: '#C9506F', car: '#2B2745', umrah: '#3E8E5A', salon: '#EB839B', other: '#F89743',
} as Record<string, string>)[k || ''] || '#F89743';

const tok = () => session().token;
export type Me = { balance: number; level: number } | null;
export const cityCoupons = (city?: string | null) => api<{ coupons: Coupon[] }>(`/v1/coupons${city ? `?city=${city}` : ''}`, { token: tok() }).then((r) => r.coupons);
export const cityCouponsMe = (city?: string | null) => api<{ coupons: Coupon[]; me: Me }>(`/v1/coupons${city ? `?city=${city}` : ''}`, { token: tok() });
export const placeCoupons = (placeId: number) => api<{ coupons: Coupon[] }>(`/v1/coupons?place=${placeId}`, { token: tok() }).then((r) => r.coupons);
export const getCoupon = (id: number) => api<{ coupon: Coupon }>(`/v1/coupons/${id}`, { token: tok() }).then((r) => r.coupon);
export const getCouponMe = (id: number) => api<{ coupon: Coupon; me: Me }>(`/v1/coupons/${id}`, { token: tok() });
export const toggleSave = (id: number) => api<{ saved: boolean }>(`/v1/coupons/${id}/save`, { method: 'POST', token: tok() }).then((r) => r.saved);
export const couponAlert = (city: string) => api<{ on: boolean }>(`/v1/coupons/alert?city=${city}`, { token: tok() }).then((r) => r.on);
export const setCouponAlert = (city: string, on: boolean) => api<{ on: boolean }>('/v1/coupons/alert', { method: 'POST', body: { city, on }, token: tok() }).then((r) => r.on);
export const myCoupons = () => api<{ coupons: Coupon[] }>('/v1/me/coupons', { token: tok() }).then((r) => r.coupons);
export const couponCode = (id: number, since: number) =>
  api<{ code?: string; left?: number; redeemed: boolean; at?: number }>(`/v1/coupons/${id}/code?since=${since}`, { token: tok(), timeoutMs: 8000 });

export const merchantTerms = () => api<{ version: string; date: string; sections: [string, string[]][] }>('/v1/merchant/terms');
export const acceptMerchantTerms = (version: string) => api('/v1/merchant/terms', { method: 'POST', body: { accept: version }, token: tok() });
export const myMerchant = () => api<{ termsVersion: string; merchant: (Merchant & { strikes?: number }) | null; coupons: Coupon[]; stats?: MStats; trust?: { n: number; ok: number; pct: number | null; open: number } }>('/v1/merchant', { token: tok() });
export const saveMerchant = (b: Partial<Merchant> & { acceptTerms?: string }) => api<{ id: number; status: string }>('/v1/merchant', { method: 'POST', body: b, token: tok() });
export const createCoupon = (b: Record<string, unknown>) => api<{ id: number }>('/v1/merchant/coupons', { method: 'POST', body: b, token: tok() });
export const editCoupon = (id: number, b: Record<string, unknown>) => api<{ status: string }>(`/v1/merchant/coupons/${id}`, { method: 'POST', body: b, token: tok() });
export const reportCoupon = (id: number, reason: string, note: string) => api<{ ok: true; paused: boolean }>(`/v1/coupons/${id}/report`, { method: 'POST', body: { reason, note }, token: tok() });
export const couponFeedback = (id: number, ok: boolean) => api(`/v1/coupons/${id}/feedback`, { method: 'POST', body: { ok }, token: tok() });
export const OFFER_KINDS: [string, string][] = [['percent', t('خصم %')], ['amount', t('خصم بمبلغ')], ['bogo', '1+1'], ['gift', t('هدية')]];
export const redeem = (code: string) => api<{ ok: true; coupon: { id: number; title: string; off: string } }>('/v1/merchant/redeem', { method: 'POST', body: { code }, token: tok() });

const MONTHS = isEn ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
/** «15 نوفمبر» من 2026-11-15 */
export const dayLabel = (d: string) => { const [, m, dd] = d.split('-').map(Number); return m ? `${dd} ${MONTHS[m - 1]}` : ''; };
export function leftText(c: Coupon) {
  const p = [c.end ? t('حتى {d}', { d: dayLabel(c.end) }) : '', c.left != null ? t('باقي {n}', { n: c.left }) : ''].filter(Boolean);
  return p.join(' · ') || t('عرض مستمر');
}
export function couponErr(e: unknown) {
  const c = (e as { code?: string })?.code;
  return ({
    login_required: t('سجّل دخولك أول.'), limit: t('وصلت حد باقتك من الكوبونات الفعّالة. أوقف واحد أو شوف الباقات.'), too_many: t('سجّلت اهتمامك أكثر من مرة اليوم. بنتواصل معك قريب.'), bad_request: t('اكتب الاسم ووسيلة التواصل.'), title_required: t('اكتب عنوان الكوبون.'),
    value_required: t('حدد قيمة الخصم.'), bad_dates: t('تاريخ النهاية قبل البداية.'), name_required: t('اكتب اسم النشاط.'), bad_city: t('اختر المدينة.'),
    merchant_not_active: t('نشاطك ما انعتمد للحين.'), wrong_code: t('الرمز غلط أو انتهى. خل العميل يحدّث الكوبون.'), already_used: t('العميل استخدم هالكوبون قبل.'),
    sold_out: t('خلصت الكوبونات.'), need_points: t('نقاطك ما تكفي لهالكوبون.'), need_level: t('هالكوبون حصري لمستوى أعلى من مستواك.'),
    customer_points: t('نقاط العميل ما تكفي لهالكوبون.'), customer_level: t('العميل مستواه أقل من المطلوب للكوبون.'), already_guide: t('أنت خبير محلي موثّق من قبل.'), already_reported: t('بلّغت عن هالكوبون قبل، ونراجع بلاغك.'), terms_required: t('لازم توافق على الشروط والأحكام أول.'), license_required: t('اكتب رقم ترخيص التخفيضات من وزارة التجارة.'), declare_required: t('لازم توافق على الإقرار.'), pending: t('طلبك قيد المراجعة.'), wait: t('تقدر تطلب مرة ثانية بعد شهر من الرفض.'), too_short: t('اكتب شوي أكثر عن نفسك.'), rate_limited: t('محاولات كثيرة، انتظر دقيقة.'), not_available: t('الكوبون انتهى أو خلص.'), network: t('ما فيه اتصال، تأكد من النت.'),
    timeout: t('السيرفر تأخر، جرّب مرة ثانية.'), suspended: t('النشاط موقوف. تواصل معنا.'), consent_required: t('وافق على نشر الصور أول.'), bad_stars: t('اختر عدد النجوم.'),
    bad_size: t('الصورة ما وصلت كاملة. جرّب صورة ثانية أو أعد المحاولة.'), bad_type: t('نوع الصورة غير مدعوم، اختر صورة ثانية.'), media_not_configured: t('رفع الصور متوقف مؤقتاً.'),
    under_review: t('تقييمك السابق تحت المراجعة.'), not_found: t('المكان ما عاد موجود.'), unauthorized: t('انتهت جلستك، سجّل دخولك من جديد.'),
  } as Record<string, string>)[c || ''] || `${t('صار خطأ، جرّب بعد شوي.')}${c ? ` (${c})` : ''}`;
}

/* ——— دليل السعودية للأعمال: الباقات و«سجّل اهتمامك» ——— */
export type Plan = { id: 'free' | 'plus' | 'pro'; name: string; coupons: number; featured: boolean; features: string[]; available: boolean };
export const getPlans = () => api<{ onSale: boolean; plans: Plan[] }>('/v1/business');
export const sendInterest = (b: { name: string; contact: string; city?: string; kind?: string; plan: string; note?: string }) =>
  api<{ ok: boolean }>('/v1/business/interest', { method: 'POST', body: b, token: tok() });
