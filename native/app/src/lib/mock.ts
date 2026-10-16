/**
 * محتوى وهمي مؤقت للأجزاء اللي سيرفرها ما جهز للحين (الحساب، المجتمع، الأوسمة، الكوبونات، الطقس).
 * كل شي هنا يتبدل بقراءة من السيرفر في المراحل الجاية — نفس الأشكال.
 */
import { brand, type PhotoKey } from '@/theme/tokens';
import type { IconName } from '@/components/Icon';
import { tr } from './i18n';

export const me = {
  // مثال يشوفه الزائر قبل ما يسجّل (بدون اسم شخص حقيقي)
  name: tr('اسمك هنا', 'Your name here'), first: tr('أنت', 'You'), initial: tr('د', 'S'), handle: 'username', since: 2026, city: tr('مدينتك', 'Your city'), level: 7,
  bio: tr('نبذة قصيرة عنك تظهر هنا، مثل: أحب المقاهي المختصة والطلعات البرية.', 'A short bio about you shows here, like: I love specialty cafes and desert trips.'),
  points: 2340, nextLevelPts: 3000, nextLevel: tr('سفير الدليل', 'Guide Ambassador'),
  stats: [{ v: '128', l: tr('إجابة', 'Answers') }, { v: '73', l: tr('تقييم', 'Reviews') }, { v: '46', l: tr('صورة', 'Photos') }, { v: tr('1.2 ألف', '1.2K'), l: tr('متابع', 'Followers') }],
};

export const weather = { city: tr('المدينة المنورة', 'Madinah'), temp: 32, text: tr('مشمس', 'Sunny') };

export const badges: { icon: IconName; bg: string; fg: string; t: string; s: string; locked?: boolean }[] = [
  { icon: 'chat', bg: brand.purple, fg: '#fff', t: tr('مرجع الديرة', 'Local Expert'), s: tr('100 إجابة', '100 answers') },
  { icon: 'nature', bg: brand.sky, fg: '#fff', t: tr('رحّال العلا', 'AlUla Explorer'), s: tr('10 معالم', '10 sights') },
  { icon: 'food', bg: brand.orange, fg: '#fff', t: tr('ذوّاق جدة', 'Jeddah Foodie'), s: tr('25 مطعم', '25 restaurants') },
  { icon: 'cam', bg: brand.pink, fg: '#fff', t: tr('عدسة الدليل', 'Guide Lens'), s: tr('40 صورة', '40 photos') },
  { icon: 'cal', bg: brand.lilac, fg: '#fff', t: tr('صيّاد الفعاليات', 'Event Hunter'), s: tr('15 فعالية', '15 events') },
  { icon: 'star', bg: brand.ink, fg: '#F9A158', t: tr('من الأوائل', 'Early Bird'), s: tr('أول 1000 عضو', 'First 1,000 members') },
  { icon: 'lock', bg: '#EEE9F2', fg: '#B9B1CC', t: tr('مستكشف الشمال', 'Northern Explorer'), s: tr('زُر تبوك وحائل', 'Visit Tabuk and Hail'), locked: true },
  { icon: 'lock', bg: '#EEE9F2', fg: '#B9B1CC', t: tr('سفير الدليل', 'Guide Ambassador'), s: tr('باقي 10 أعلام', '10 landmarks to go'), locked: true },
];

export const passport = {
  visited: [tr('المدينة المنورة', 'Madinah'), tr('مكة المكرمة', 'Makkah'), tr('الطائف', 'Taif'), tr('الرياض', 'Riyadh'), tr('جدة', 'Jeddah'), tr('العلا', 'AlUla'), tr('أبها', 'Abha'), tr('ينبع', 'Yanbu'), tr('الدرعية', 'Diriyah')],
  total: 21,
};

export const coupons = [
  { biz: tr('نون · أرياف', 'Noon · Aryaf'), off: tr('خصم 15%', '15% off'), code: 'SG15', until: tr('ينتهي بعد 4 أيام', 'Ends in 4 days'), bg: brand.orange },
  { biz: tr('قهوة المساء', 'Evening Coffee'), off: tr('قهوة مجاناً', 'Free coffee'), code: 'SGCOF', until: tr('هدية الوسم', 'Badge gift'), bg: brand.lilac },
];

export const activity = [
  { icon: 'chat' as IconName, t: tr('جاوبت على «أفضل وقت لزيارة جبل أحد؟»', 'Answered "Best time to visit Mount Uhud?"'), pts: tr('+34 شكر', '+34 thanks') },
  { icon: 'star' as IconName, t: tr('قيّمت «حي الطريف» بخمس نجوم وأضفت 3 صور', 'Rated "At-Turaif District" 5 stars and added 3 photos'), pts: '' },
];

export type Post = {
  id: number; who: string; av: string; c: string; where: string; when: string; badge?: string;
  kind: 'question' | 'photo' | 'tip'; text: string; photo?: PhotoKey; answers?: number; thanks?: number;
  best?: { who: string; badge: string; text: string };
};
export const posts: Post[] = [
  { id: 1, who: tr('نورة', 'Noura'), av: tr('ن', 'N'), c: brand.sky, where: tr('زائرة من الكويت', 'Visitor from Kuwait'), when: tr('قبل ساعة', '1 hour ago'), kind: 'question',
    text: tr('أول مرة أزور المدينة مع عائلتي، وش أحسن مكان نفطر فيه قريب من الحرم؟', 'First time visiting Madinah with my family. What\'s the best breakfast spot near the Haram?'), answers: 7, thanks: 42,
    best: { who: tr('رامي', 'Rami'), badge: tr('مرشد محلي موثّق', 'Verified local guide'), text: tr('جرّبوا فطور «قباء» الشعبي بعد صلاة الفجر، الفول والتميس عندهم ممتاز وبعدها امشوا لمسجد قباء.', 'Try the traditional "Quba" breakfast after Fajr prayer. Their foul and tamees are excellent, then walk to Quba Mosque.') } },
  { id: 2, who: tr('فهد', 'Fahad'), av: tr('ف', 'F'), c: brand.orange, where: tr('في صخرة الفيل', 'At Elephant Rock'), when: tr('صورة من العلا', 'Photo from AlUla'), kind: 'photo', badge: tr('عدسة الدليل', 'Guide Lens'), photo: 'rock',
    text: tr('الغروب هنا شي ثاني.. نصيحة: تعالوا قبل 5 دقائق عشان تلقون جلسة قريبة.', 'Sunset here is something else.. Tip: come 5 minutes early to get a close spot.'), thanks: 120 },
];

export const champions = [
  { av: tr('م', 'M'), c: brand.sky, n: tr('منيرة', 'Munira'), s: tr('64 إجابة', '64 answers'), rank: 2 },
  { av: tr('ر', 'R'), c: brand.lilac, n: tr('رامي', 'Rami'), s: tr('91 إجابة', '91 answers'), rank: 1 },
  { av: tr('خ', 'K'), c: brand.pink, n: tr('خالد', 'Khalid'), s: tr('51 إجابة', '51 answers'), rank: 3 },
];

export const challenge = { tag: tr('تحدي الأسبوع', 'Weekly challenge'), title: tr('صوّر غروب كورنيش جدة', 'Shoot the Jeddah Corniche sunset'), prize: tr('الجائزة: وسم «عدسة الدليل» + كوبون', 'Prize: "Guide Lens" badge + coupon'), left: tr('باقي 4 أيام · مشاركة 213', '4 days left · 213 entries'), photo: 'water' as PhotoKey };

export type Coupon = { id: number; biz: string; area: string; off: string; desc: string; left: string; bg: string; photo: PhotoKey; min?: string };
export const cityCoupons: Coupon[] = [
  { id: 1, biz: tr('مطعم بيت الحجاز', 'Bait Al Hijaz Restaurant'), area: tr('قباء', 'Quba'), off: tr('خصم 20%', '20% off'), desc: tr('على وجبات الفطور', 'On breakfast meals'), left: tr('باقي 26 · حتى 15 نوفمبر', '26 left · until Nov 15'), bg: brand.orange, photo: 'sea', min: tr('الحد الأدنى 50 ر.س', 'Minimum SAR 50') },
  { id: 2, biz: tr('حلويات المدينة', 'Madinah Sweets'), area: tr('المركزية', 'Central Area'), off: tr('هدية مجانية', 'Free gift'), desc: tr('كنافة صغيرة مع أي طلب فوق 60 ر.س', 'Small kunafa with any order over SAR 60'), left: tr('باقي 80 · حتى 30 أكتوبر', '80 left · until Oct 30'), bg: brand.lilac, photo: 'jold' },
  { id: 3, biz: tr('جولة المدينة التاريخية', 'Historic Madinah Tour'), area: tr('الحرم', 'Haram'), off: tr('خصم 25 ر.س', 'SAR 25 off'), desc: tr('على تذكرة الجولة بالحافلة', 'On the bus tour ticket'), left: tr('باقي 40 · حتى 20 نوفمبر', '40 left · until Nov 20'), bg: brand.sky, photo: 'heritage' },
];
export const featuredCoupon = { biz: tr('مقهى صباحيات · العوالي', 'Sabahiyat Cafe · Al Awali'), off: tr('1+1 مجاناً', 'Buy 1 get 1 free'), desc: tr('على القهوة المختصة قبل 12 الظهر', 'On specialty coffee before 12 noon'), photo: 'gate' as PhotoKey };

export const notes: { icon: IconName; bg: string; fg: string; t: string; s: string; when: string; unread?: boolean; day: 'today' | 'week' }[] = [
  { icon: 'bag', bg: brand.softOrange, fg: brand.orangeDeep, t: tr('رحلتك للعلا بعد بكرة', 'Your AlUla trip is the day after tomorrow'), s: tr('الجو 24° وصافي. نزّل الخرائط للاستخدام بدون نت قبل ما تطلع.', '24° and clear. Download offline maps before you head out.'), when: tr('قبل 20 دقيقة', '20 min ago'), unread: true, day: 'today' },
  { icon: 'chat', bg: brand.softPurple, fg: brand.purple, t: tr('سارة جاوبت على سؤالك', 'Sara answered your question'), s: tr('«احجز تذكرتك أونلاين قبل، وتعشّى في مطل البجيري…»', '"Book your ticket online in advance, and have dinner at Bujairi Terrace…"'), when: tr('قبل ساعة', '1 hour ago'), unread: true, day: 'today' },
  { icon: 'star', bg: brand.softPink, fg: brand.pinkDeep, t: tr('مبروك! حصلت وسم «ذوّاق جدة»', 'Congrats! You earned the "Jeddah Foodie" badge'), s: tr('+200 نقطة. شارك وسمك مع أصحابك.', '+200 points. Share your badge with friends.'), when: tr('قبل 3 ساعات', '3 hours ago'), unread: true, day: 'today' },
  { icon: 'ticket', bg: brand.softPink, fg: brand.pinkDeep, t: tr('كوبون «بيت الحجاز» ينتهي بعد يومين', '"Bait Al Hijaz" coupon ends in 2 days'), s: tr('خصم 20% على الفطور، باقي 26 كوبون.', '20% off breakfast, 26 coupons left.'), when: tr('الأحد', 'Sunday'), day: 'week' },
  { icon: 'pin', bg: brand.softGreen, fg: brand.green, t: tr('7 أماكن جديدة في المدينة المنورة', '7 new places in Madinah'), s: tr('مقاهي مختصة ومطاعم جديدة في قباء والعوالي.', 'New specialty cafes and restaurants in Quba and Al Awali.'), when: tr('السبت', 'Saturday'), day: 'week' },
  { icon: 'cal', bg: brand.softSky, fg: brand.skyDeep, t: tr('موسم الرياض يفتتح الأربعاء', 'Riyadh Season opens Wednesday'), s: tr('حفظت الفعالية، نذكّرك قبلها بيوم.', 'You saved this event. We\'ll remind you a day before.'), when: tr('الجمعة', 'Friday'), day: 'week' },
];
