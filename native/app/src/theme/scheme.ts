/**
 * مظهر التطبيق: تلقائي (يتبع الآيفون) أو فاتح أو ليلي — يختاره المستخدم من الإعدادات
 * - ينقرأ بشكل متزامن أول ما يفتح التطبيق (قبل حساب الألوان في tokens.ts)
 * - التغيير يحفظ الاختيار ويعيد تشغيل التطبيق عشان تتبدل كل الألوان
 */
import { Appearance, Platform } from 'react-native';

export type SchemePref = 'auto' | 'light' | 'dark';
const KEY = 'sg_scheme_pref';

function read(): SchemePref {
  try {
    let v: string | null = null;
    if (Platform.OS === 'web') v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    else v = require('expo-secure-store').getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch { return 'auto'; }
}

export const schemePref: SchemePref = read();
// نجبر مظهر النظام (لوحة المفاتيح، القوائم، شريط الحالة) يمشي مع اختيار المستخدم
if (schemePref !== 'auto' && Platform.OS !== 'web') { try { Appearance.setColorScheme?.(schemePref); } catch { /* */ } }

export const schemeIsDark = schemePref === 'auto' ? Appearance.getColorScheme() === 'dark' : schemePref === 'dark';

/** يحفظ الاختيار ويعيد تشغيل التطبيق */
export async function setSchemePref(p: SchemePref) {
  if (p === schemePref) return;
  try {
    if (Platform.OS === 'web') { localStorage.setItem(KEY, p); location.reload(); return; }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-secure-store').setItem(KEY, p);
  } catch { /* */ }
  try { Appearance.setColorScheme?.(p === 'auto' ? 'unspecified' : p); } catch { /* */ }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    await require('expo-updates').reloadAsync();
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native').DevSettings.reload();
  }
}
