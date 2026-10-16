/**
 * ودجت الشاشة الرئيسية (iOS): التطبيق يجهز البيانات ويحطها في App Group، والودجت يقراها
 * - «اليوم في مدينتك»: طقس + فعالية/مكان اليوم
 * - «فعالياتي»: عد تنازلي لأقرب فعالية «رايح» (ويطلع في شاشة القفل)
 * - «عرض اليوم»
 * الودجت يحدث نفسه كل ساعتين من السيرفر، والتطبيق يحدثه كل ما تغيرت المدينة أو «رايح» أو طلعت منه
 * لو النسخة المثبتة ما فيها الودجت (بناء قديم/الويب) ما يصير شي
 */
import { AppState, Platform } from 'react-native';
import { api } from './api';
import { session } from './auth';

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
export const APP_GROUP = 'group.com.saudiguide';
let store: any = null;
function storage() {
  if (Platform.OS !== 'ios') return null;
  if (store) return store;
  try { const { ExtensionStorage } = require('@bacons/apple-targets'); store = { S: ExtensionStorage, s: new ExtensionStorage(APP_GROUP) }; } catch { store = null; }
  return store;
}

let busy = false;
let last = 0;
/** يجيب بيانات الودجت من السيرفر ويحفظها للودجت ويطلب منه يتحدث */
export async function syncWidget(force = false) {
  const st = storage();
  if (!st || busy || (!force && Date.now() - last < 60e3)) return;
  busy = true;
  try {
    const { user, token } = session();
    const city = user?.city || 'riyadh';
    const d = await api<Record<string, unknown>>(`/v1/widget?city=${encodeURIComponent(city)}`, { token, timeoutMs: 8000 });
    st.s.set('payload', JSON.stringify(d));
    st.s.set('city', city);
    st.S.reloadWidget();
    last = Date.now();
  } catch { /* بدون نت: يبقى آخر شي */ } finally { busy = false; }
}

let installed = false;
/** مرة وحدة عند التشغيل: تحديث أول، وكل ما يطلع المستخدم من التطبيق */
export function installWidgetSync() {
  if (installed || Platform.OS !== 'ios') return;
  installed = true;
  setTimeout(() => syncWidget(true), 4000);
  AppState.addEventListener('change', (s) => { if (s === 'background') syncWidget(); });
}
