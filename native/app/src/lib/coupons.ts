/** الكوبونات وبوابة التجار: كل الطلبات للسيرفر في مكان واحد */
import { api } from './api';
import { session } from './auth';

export type Biz = { id: number; name: string; kind: string; city: string; area: string; photo: string; verified: boolean; placeId: number | null; lat: number | null; lng: number | null };
export type Coupon = {
  id: number; kind: 'percent' | 'amount' | 'bogo' | 'gift'; value: string; off: string; title: string; terms: string; minOrder: number | null;
  perUser: boolean; qty: number | null; used: number; left: number | null; views: number; hours: string; start: string; end: string;
  status: 'pending' | 'active' | 'paused' | 'rejected' | 'hidden'; note: string; created: number;
  points: number; minLevel: number; levelName: string; saved?: boolean; usedByMe?: number; biz?: Biz;
};
export type Merchant = {
  id: number; name: string; name_en: string; kind: string; city: string; area: string; lat: number | null; lng: number | null; placeId: number | null;
  photos: string[]; hours: string; phone: string; cr: string; verified: boolean; maxCoupons: number; status: 'pending' | 'approved' | 'rejected' | 'hidden'; note: string;
};
export type MStats = { used: number; saves: number; views: number; week: number[]; today: number };

export const BIZ_KINDS: [string, string][] = [['restaurant', 'مطعم'], ['cafe', 'مقهى'], ['sweets', 'مخبز وحلويات'], ['juice', 'عصيرات ومشروبات'], ['dates', 'تمور ومنتجات محلية'], ['perfume', 'عطور وبخور'], ['gifts', 'هدايا وتذكارات'], ['clothing', 'ملابس وعبايات'], ['shop', 'متجر'], ['mall', 'مول ومركز تسوق'], ['hotel', 'فندق وشقق فندقية'], ['resort', 'منتجع واستراحة'], ['experience', 'تجربة سياحية'], ['tours', 'جولات ومنظم رحلات'], ['fun', 'ترفيه وألعاب'], ['car', 'تأجير سيارات ونقل'], ['umrah', 'خدمات الحج والعمرة'], ['salon', 'صالون ومشغل'], ['other', 'نشاط آخر']];
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
export const myCoupons = () => api<{ coupons: Coupon[] }>('/v1/me/coupons', { token: tok() }).then((r) => r.coupons);
export const couponCode = (id: number, since: number) =>
  api<{ code?: string; left?: number; redeemed: boolean; at?: number }>(`/v1/coupons/${id}/code?since=${since}`, { token: tok(), timeoutMs: 8000 });

export const myMerchant = () => api<{ merchant: Merchant | null; coupons: Coupon[]; stats?: MStats }>('/v1/merchant', { token: tok() });
export const saveMerchant = (b: Partial<Merchant>) => api<{ id: number; status: string }>('/v1/merchant', { method: 'POST', body: b, token: tok() });
export const createCoupon = (b: Record<string, unknown>) => api<{ id: number }>('/v1/merchant/coupons', { method: 'POST', body: b, token: tok() });
export const editCoupon = (id: number, b: Record<string, unknown>) => api<{ status: string }>(`/v1/merchant/coupons/${id}`, { method: 'POST', body: b, token: tok() });
export const redeem = (code: string) => api<{ ok: true; coupon: { id: number; title: string; off: string } }>('/v1/merchant/redeem', { method: 'POST', body: { code }, token: tok() });

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
/** «15 نوفمبر» من 2026-11-15 */
export const dayLabel = (d: string) => { const [, m, dd] = d.split('-').map(Number); return m ? `${dd} ${MONTHS[m - 1]}` : ''; };
export function leftText(c: Coupon) {
  const p = [c.end ? `حتى ${dayLabel(c.end)}` : '', c.left != null ? `باقي ${c.left}` : ''].filter(Boolean);
  return p.join(' · ') || 'عرض مستمر';
}
export function couponErr(e: unknown) {
  const c = (e as { code?: string })?.code;
  return ({
    login_required: 'سجّل دخولك أول.', limit: 'باقتك تسمح بكوبون فعّال واحد. أوقف الحالي أو تواصل معنا.', title_required: 'اكتب عنوان الكوبون.',
    value_required: 'حدد قيمة الخصم.', bad_dates: 'تاريخ النهاية قبل البداية.', name_required: 'اكتب اسم النشاط.', bad_city: 'اختر المدينة.',
    merchant_not_active: 'نشاطك ما انعتمد للحين.', wrong_code: 'الرمز غلط أو انتهى. خل العميل يحدّث الكوبون.', already_used: 'العميل استخدم هالكوبون قبل.',
    sold_out: 'خلصت الكوبونات.', need_points: 'نقاطك ما تكفي لهالكوبون.', need_level: 'هالكوبون حصري لمستوى أعلى من مستواك.',
    customer_points: 'نقاط العميل ما تكفي لهالكوبون.', customer_level: 'العميل مستواه أقل من المطلوب للكوبون.', already_guide: 'أنت مرشد موثّق من قبل.', pending: 'طلبك قيد المراجعة.', wait: 'تقدر تطلب مرة ثانية بعد شهر من الرفض.', too_short: 'اكتب شوي أكثر عن نفسك.', rate_limited: 'محاولات كثيرة، انتظر دقيقة.', not_available: 'الكوبون انتهى أو خلص.', network: 'ما فيه اتصال، تأكد من النت.',
    timeout: 'السيرفر تأخر، جرّب مرة ثانية.', suspended: 'النشاط موقوف. تواصل معنا.', consent_required: 'وافق على نشر الصور أول.', bad_stars: 'اختر عدد النجوم.',
  } as Record<string, string>)[c || ''] || 'صار خطأ، جرّب بعد شوي.';
}
