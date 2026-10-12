/**
 * هوية دليل السعودية — المصدر الوحيد للألوان والمسافات والخطوط.
 * الألوان من دليل الهوية (06-Colors.pdf) وألوان الشعار. الهوية فرائحية وملونة:
 * نوزّع الألوان على العناصر وما نعتمد على البرتقالي لكل شي.
 */
export const brand = {
  purple: '#8E65AB', // رئيسي
  purpleDeep: '#604C87', // الترويسة
  purpleInk: '#4D3B70',
  orange: '#F89743', // دبوس الشعار
  peach: '#EFA56C',
  pink: '#EB839B',
  orchid: '#BC77B2',
  lilac: '#C2A4CE',
  lilacSoft: '#C6C0DA',
  sky: '#62B9E8',
  navy: '#373D63', // النصوص
  bg: '#F0EFEF',
  white: '#FFFFFF',
} as const;

/** لون مميز لكل نوع مكان — نفس الفكرة في كل شاشات التطبيق */
export const kindColor: Record<string, string> = {
  sights: brand.purple,
  heritage: '#995306',
  islamic: '#195B7B',
  nature: '#3E8E5A',
  fun: brand.pink,
  food: brand.orange,
  cafe: '#913715',
  shopping: brand.orchid,
};

export const colors = {
  bg: brand.bg,
  surface: brand.white,
  surfaceAlt: '#F6F4F8',
  border: 'rgba(55,61,99,0.12)',
  text: brand.navy,
  textMuted: '#5A5F80',
  header: brand.purpleDeep,
  onHeader: brand.white,
  primary: brand.purpleDeep,
  accent: brand.orange,
  chipOn: brand.purpleDeep,
  heart: brand.pink,
  tabBar: '#373D63',
  tabActive: brand.orange,
  tabInactive: '#C6C0DA',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

export const font = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

export const type = {
  hero: { fontFamily: font.bold, fontSize: 28, lineHeight: 40 },
  title: { fontFamily: font.bold, fontSize: 20, lineHeight: 30 },
  heading: { fontFamily: font.semibold, fontSize: 16, lineHeight: 26 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 25 },
  small: { fontFamily: font.regular, fontSize: 12.5, lineHeight: 19 },
} as const;
