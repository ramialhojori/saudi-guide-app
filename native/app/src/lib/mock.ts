/**
 * محتوى وهمي مؤقت للأجزاء اللي سيرفرها ما جهز للحين (الحساب، المجتمع، الأوسمة، الكوبونات، الطقس).
 * كل شي هنا يتبدل بقراءة من السيرفر في المراحل الجاية — نفس الأشكال.
 */
import { brand, type PhotoKey } from '@/theme/tokens';
import type { IconName } from '@/components/Icon';

export const me = {
  name: 'رامي الحجوري', first: 'رامي', initial: 'ر', handle: 'rami', since: 2024, city: 'المدينة المنورة', level: 7,
  bio: 'أحب المقاهي المختصة والطلعات البرية. أسألني عن المدينة وجدة.',
  points: 2340, nextLevelPts: 3000, nextLevel: 'سفير الدليل',
  stats: [{ v: '128', l: 'إجابة' }, { v: '73', l: 'تقييم' }, { v: '46', l: 'صورة' }, { v: '1.2 ألف', l: 'متابع' }],
};

export const weather = { city: 'المدينة المنورة', temp: 32, text: 'مشمس' };

export const badges: { icon: IconName; bg: string; fg: string; t: string; s: string; locked?: boolean }[] = [
  { icon: 'chat', bg: brand.purple, fg: '#fff', t: 'مرجع الديرة', s: '100 إجابة' },
  { icon: 'nature', bg: brand.sky, fg: '#fff', t: 'رحّال العلا', s: '10 معالم' },
  { icon: 'food', bg: brand.orange, fg: '#fff', t: 'ذوّاق جدة', s: '25 مطعم' },
  { icon: 'cam', bg: brand.pink, fg: '#fff', t: 'عدسة الدليل', s: '40 صورة' },
  { icon: 'cal', bg: brand.lilac, fg: '#fff', t: 'صيّاد الفعاليات', s: '15 فعالية' },
  { icon: 'star', bg: brand.ink, fg: '#F9A158', t: 'من الأوائل', s: 'أول 1000 عضو' },
  { icon: 'lock', bg: '#EEE9F2', fg: '#B9B1CC', t: 'مستكشف الشمال', s: 'زُر تبوك وحائل', locked: true },
  { icon: 'lock', bg: '#EEE9F2', fg: '#B9B1CC', t: 'سفير الدليل', s: 'باقي 10 أعلام', locked: true },
];

export const passport = {
  visited: ['المدينة المنورة', 'مكة المكرمة', 'الطائف', 'الرياض', 'جدة', 'العلا', 'أبها', 'ينبع', 'الدرعية'],
  total: 21,
};

export const coupons = [
  { biz: 'نون · أرياف', off: 'خصم 15%', code: 'SG15', until: 'ينتهي بعد 4 أيام', bg: brand.orange },
  { biz: 'قهوة المساء', off: 'قهوة مجاناً', code: 'SGCOF', until: 'هدية الوسم', bg: brand.lilac },
];

export const activity = [
  { icon: 'chat' as IconName, t: 'جاوبت على «أفضل وقت لزيارة جبل أحد؟»', pts: '+34 شكر' },
  { icon: 'star' as IconName, t: 'قيّمت «حي الطريف» بخمس نجوم وأضفت 3 صور', pts: '' },
];

export type Post = {
  id: number; who: string; av: string; c: string; where: string; when: string; badge?: string;
  kind: 'question' | 'photo' | 'tip'; text: string; photo?: PhotoKey; answers?: number; thanks?: number;
  best?: { who: string; badge: string; text: string };
};
export const posts: Post[] = [
  { id: 1, who: 'نورة', av: 'ن', c: brand.sky, where: 'زائرة من الكويت', when: 'قبل ساعة', kind: 'question',
    text: 'أول مرة أزور المدينة مع عائلتي، وش أحسن مكان نفطر فيه قريب من الحرم؟', answers: 7, thanks: 42,
    best: { who: 'رامي', badge: 'مرشد محلي موثّق', text: 'جرّبوا فطور «قباء» الشعبي بعد صلاة الفجر، الفول والتميس عندهم ممتاز وبعدها امشوا لمسجد قباء.' } },
  { id: 2, who: 'فهد', av: 'ف', c: brand.orange, where: 'في صخرة الفيل', when: 'من أبها', kind: 'photo', badge: 'عدسة الدليل', photo: 'rock',
    text: 'الغروب هنا شي ثاني.. نصيحة: تعالوا قبل 5 دقائق عشان تلقون جلسة قريبة.', thanks: 120 },
];

export const champions = [
  { av: 'م', c: brand.sky, n: 'منيرة', s: '64 إجابة', rank: 2 },
  { av: 'ر', c: brand.lilac, n: 'رامي', s: '91 إجابة', rank: 1 },
  { av: 'خ', c: brand.pink, n: 'خالد', s: '51 إجابة', rank: 3 },
];

export const challenge = { tag: 'تحدي الأسبوع', title: 'صوّر غروب كورنيش جدة', prize: 'الجائزة: وسم «عدسة الدليل» + كوبون', left: 'باقي 4 أيام · مشاركة 213', photo: 'water' as PhotoKey };

export type Coupon = { id: number; biz: string; area: string; off: string; desc: string; left: string; bg: string; photo: PhotoKey; min?: string };
export const cityCoupons: Coupon[] = [
  { id: 1, biz: 'مطعم بيت الحجاز', area: 'قباء', off: 'خصم 20%', desc: 'على وجبات الفطور', left: 'باقي 26 · حتى 15 نوفمبر', bg: brand.orange, photo: 'sea', min: 'الحد الأدنى 50 ر.س' },
  { id: 2, biz: 'حلويات المدينة', area: 'المركزية', off: 'هدية مجانية', desc: 'كنافة صغيرة مع أي طلب فوق 60 ر.س', left: 'باقي 80 · حتى 30 أكتوبر', bg: brand.lilac, photo: 'jold' },
  { id: 3, biz: 'جولة المدينة التاريخية', area: 'الحرم', off: 'خصم 25 ر.س', desc: 'على تذكرة الجولة بالحافلة', left: 'باقي 40 · حتى 20 نوفمبر', bg: brand.sky, photo: 'heritage' },
];
export const featuredCoupon = { biz: 'مقهى صباحيات · العوالي', off: '1+1 مجاناً', desc: 'على القهوة المختصة قبل 12 الظهر', photo: 'gate' as PhotoKey };

export const notes: { icon: IconName; bg: string; fg: string; t: string; s: string; when: string; unread?: boolean; day: 'today' | 'week' }[] = [
  { icon: 'bag', bg: brand.softOrange, fg: brand.orangeDeep, t: 'رحلتك للعلا بعد بكرة', s: 'الجو 24° وصافي. نزّل الخرائط للاستخدام بدون نت قبل ما تطلع.', when: 'قبل 20 دقيقة', unread: true, day: 'today' },
  { icon: 'chat', bg: brand.softPurple, fg: brand.purple, t: 'سارة جاوبت على سؤالك', s: '«احجز تذكرتك أونلاين قبل، وتعشّى في مطل البجيري…»', when: 'قبل ساعة', unread: true, day: 'today' },
  { icon: 'star', bg: brand.softPink, fg: brand.pinkDeep, t: 'مبروك! حصلت وسم «ذوّاق جدة»', s: '+200 نقطة. شارك وسمك مع أصحابك.', when: 'قبل 3 ساعات', unread: true, day: 'today' },
  { icon: 'ticket', bg: brand.softPink, fg: brand.pinkDeep, t: 'كوبون «بيت الحجاز» ينتهي بعد يومين', s: 'خصم 20% على الفطور، باقي 26 كوبون.', when: 'الأحد', day: 'week' },
  { icon: 'pin', bg: brand.softGreen, fg: brand.green, t: '7 أماكن جديدة في المدينة المنورة', s: 'مقاهي مختصة ومطاعم جديدة في قباء والعوالي.', when: 'السبت', day: 'week' },
  { icon: 'cal', bg: brand.softSky, fg: brand.skyDeep, t: 'موسم الرياض يفتتح الأربعاء', s: 'حفظت الفعالية، نذكّرك قبلها بيوم.', when: 'الجمعة', day: 'week' },
];
