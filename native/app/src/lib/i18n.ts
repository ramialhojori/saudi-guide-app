/**
 * لغة التطبيق (عربي / إنجليزي)
 * - الجوال: اللغة = اتجاه التطبيق. أول تشغيل يتبع لغة الجوال (عربي → يمين، غيره → إنجليزي يسار).
 *   لما المستخدم يغيّر اللغة من الإعدادات نحفظ الاتجاه الجديد (forceRTL) ونعيد تشغيل التطبيق.
 * - الويب: من الرابط (/en/...) أو اختيار المستخدم المحفوظ أو لغة المتصفح.
 * - الترجمة: t('النص العربي') يرجع الإنجليزي من قاموس en.ts، ولو ما فيه ترجمة يرجع العربي نفسه.
 *   المتغيرات: t('{n} مكان', { n: 5 })
 */
import { I18nManager, Platform } from 'react-native';
import { EN } from './i18n.en';

export type Lang = 'ar' | 'en';

function detect(): Lang {
  if (Platform.OS !== 'web') return I18nManager.isRTL ? 'ar' : 'en';
  try {
    if (typeof location !== 'undefined' && /^\/en(\/|$)/.test(location.pathname)) return 'en';
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('sg_lang') : null;
    if (saved === 'ar' || saved === 'en') return saved;
    const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
    return nav && !nav.toLowerCase().startsWith('ar') ? 'en' : 'ar';
  } catch { return 'ar'; }
}

export const LANG: Lang = detect();
export const isEn = LANG === 'en';
export const isRtl = !isEn;

/** يترجم نص عربي للإنجليزي (لو اللغة إنجليزي) ويعوّض المتغيرات */
export function t(ar: string, vars?: Record<string, string | number>): string {
  let s = isEn ? EN[ar] ?? ar : ar;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** نص مختلف حسب اللغة بدون قاموس (للجمل الطويلة اللي تختلف صياغتها) */
export const tr = (ar: string, en: string) => (isEn ? en : ar);

/**
 * أول تشغيل على الجوال: نختار اللغة حسب لغة الجهاز (عربي → يمين، غيره → إنجليزي)
 * الاتجاه يحفظه ريأكت نيتف (forceRTL) ويطبّقه بعد إعادة التشغيل؛ بعدها اختيار المستخدم من الإعدادات هو اللي يمشي
 */
export async function initLang() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    if (await AsyncStorage.getItem('sg_lang_init')) return;
    await AsyncStorage.setItem('sg_lang_init', '1');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const code = (require('expo-localization').getLocales()?.[0]?.languageCode || 'ar').toLowerCase();
    const want: Lang = code === 'ar' ? 'ar' : 'en';
    if (want !== LANG) await applyLang(want);
  } catch { /* */ }
}

async function applyLang(l: Lang) {
  I18nManager.allowRTL(l === 'ar');
  I18nManager.forceRTL(l === 'ar');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates');
    await Updates.reloadAsync();
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DevSettings } = require('react-native');
    DevSettings.reload();
  }
}

/** يغيّر اللغة ويعيد التشغيل */
export async function setLang(l: Lang) {
  if (l === LANG) return;
  if (Platform.OS === 'web') {
    try { localStorage.setItem('sg_lang', l); } catch { /* */ }
    const p = location.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
    location.assign(l === 'en' ? `/en${p === '/' ? '' : p}` : p);
    return;
  }
  await applyLang(l);
}
