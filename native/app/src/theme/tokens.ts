/**
 * هوية دليل السعودية — المصدر الوحيد للألوان والمسافات والخطوط.
 * مطابقة للوحة التصميم (Design artifact · الاتجاه الأول): خلفية دافئة، حبر بنفسجي غامق،
 * وألوان الهوية موزعة على العناصر (ما نعتمد على البرتقالي لكل شي).
 */
import { Appearance } from 'react-native';

/** الوضع الليلي يتبع إعداد الآيفون (نقرأه أول ما يفتح التطبيق، ونعيد التحميل لو تغيّر — شوف _layout) */
export const isDark = Appearance.getColorScheme() === 'dark';

const LIGHT = {
  ink: '#2B2745', // خلفيات غامقة (الشريط السفلي، أزرار غامقة)
  text: '#2B2745', // لون النص الأساسي
  muted: '#6B6585',
  faint: '#9C94B5',
  purple: '#604C87',
  lilac: '#8E65AB',
  orange: '#F89743',
  orangeDeep: '#E07B22',
  orangeInk: '#995306',
  pink: '#EB839B',
  pinkDeep: '#C9506F',
  sky: '#62B9E8',
  skyDeep: '#2E86B8',
  green: '#3E8E5A',
  bg: '#F4F1EE',
  white: '#FFFFFF', // سطح البطاقات (يصير غامق في الوضع الليلي)
  card: '#FFFFFF',
  line: '#E2DAEC',
  chip: '#F1ECF6',
  inactive: '#C6C0DA',
  // خلفيات ناعمة للشارات
  softOrange: '#FDE7D3',
  softPink: '#FBE3EA',
  softPurple: '#ECE5F3',
  softSky: '#E2F1FA',
  softGreen: '#E2F0E6',
  softBrown: '#F6E6D8',
  link: '#604C87', // روابط ونصوص بنفسجية على البطاقات
};
/** ألوان الوضع الليلي — من تصاميم MainDark وأخواتها */
const DARK: typeof LIGHT = {
  ...LIGHT,
  ink: '#2C2748',
  text: '#EEEAF6',
  muted: '#A79FC0',
  faint: '#7D7598',
  orangeInk: '#F9A158',
  bg: '#15122A',
  white: '#221E3A',
  card: '#221E3A',
  line: '#3A3358',
  chip: '#2F2950',
  inactive: '#6E6790',
  softOrange: '#3D2B1C',
  softPink: '#3B2230',
  softPurple: '#332B55',
  softSky: '#1C3042',
  softGreen: '#1F3428',
  softBrown: '#3A2C22',
  link: '#C3ADEB',
};
export const brand = isDark ? DARK : LIGHT;

/** لون مميز لكل نوع مكان — نفس الفكرة في كل شاشات التطبيق */
export const kindStyle: Record<string, { fg: string; bg: string; icon: string }> = {
  sights: { fg: brand.lilac, bg: brand.softPurple, icon: 'sights' },
  heritage: { fg: brand.orangeInk, bg: brand.softBrown, icon: 'heritage' },
  islamic: { fg: brand.green, bg: brand.softGreen, icon: 'mosque' },
  nature: { fg: brand.green, bg: brand.softGreen, icon: 'nature' },
  fun: { fg: brand.skyDeep, bg: brand.softSky, icon: 'fun' },
  food: { fg: brand.orangeDeep, bg: brand.softOrange, icon: 'food' },
  cafe: { fg: brand.pinkDeep, bg: brand.softPink, icon: 'cafe' },
  shopping: { fg: brand.purple, bg: brand.softPurple, icon: 'shop' },
};
export const kindColor: Record<string, string> = Object.fromEntries(Object.entries(kindStyle).map(([k, v]) => [k, v.fg]));

export const colors = {
  bg: brand.bg,
  surface: brand.white,
  surfaceAlt: brand.chip,
  border: brand.line,
  text: brand.text,
  textMuted: brand.muted,
  header: brand.purple,
  onHeader: '#FFFFFF',
  primary: brand.purple,
  accent: brand.orange,
  chipOn: brand.purple,
  heart: brand.pink,
  tabBar: brand.ink,
  tabActive: brand.orange,
  tabInactive: brand.inactive,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32 } as const;
export const radius = { sm: 12, md: 16, lg: 20, xl: 24, xxl: 30, pill: 999 } as const;

export const font = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

export const type = {
  hero: { fontFamily: font.bold, fontSize: 30, lineHeight: 42 },
  title: { fontFamily: font.bold, fontSize: 22, lineHeight: 32 },
  section: { fontFamily: font.bold, fontSize: 18, lineHeight: 28 },
  heading: { fontFamily: font.semibold, fontSize: 15, lineHeight: 24 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 26 },
  small: { fontFamily: font.regular, fontSize: 12.5, lineHeight: 19 },
  tiny: { fontFamily: font.medium, fontSize: 11.5, lineHeight: 17 },
} as const;

/** صور الهوية المحلية (حقوقها يشتريها رامي) — تستخدم في الرئيسية والبطاقات لين يجي محتوى نهائي */
export const photos = {
  rock: require('../../assets/photos/alula-rock.jpg'),
  land: require('../../assets/photos/alula-land.jpg'),
  riyadh: require('../../assets/photos/riyadh.jpg'),
  gate: require('../../assets/photos/jeddah-gate.jpg'),
  heritage: require('../../assets/photos/heritage.jpg'),
  jold: require('../../assets/photos/jeddah-old.jpg'),
  water: require('../../assets/photos/waterfront.jpg'),
  sea: require('../../assets/photos/seafood.jpg'),
  art: require('../../assets/photos/art.jpg'),
  fest: require('../../assets/photos/festival.jpg'),
} as const;
export type PhotoKey = keyof typeof photos;

/**
 * محاذاة النص لليمين في كل المنصات.
 * على الجوال مع RTL، ريأكت نيتف يقلب left/right: «left» تصير بداية السطر = اليمين.
 * على الويب ما فيه قلب، فنستخدم right مباشرة.
 */
import { I18nManager, Platform } from 'react-native';
export const START: 'left' | 'right' = Platform.OS !== 'web' && I18nManager.isRTL ? 'left' : 'right';
/** حقول الكتابة (TextInput) ما تنقلب مع اتجاه التطبيق على الآيفون — نحطها يمين دايماً */
export const INPUT_START = 'right' as const;
