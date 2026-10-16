/**
 * نافذة التقييم داخل التطبيق (نافذة آبل/قوقل الرسمية «قيّم التطبيق» بدون ما يطلع من التطبيق)
 * - تطلع بعد «لحظة حلوة»: حفظ مكان في الرحلة، نسخ كوبون، تخطيط رحلة، متابعة صحيفة…
 * - بشروط عشان ما تزعج: بعد 3 لحظات حلوة، وبعد يومين من أول تشغيل، ومرة كل 40 يوم، و3 مرات بالسنة كحد أقصى
 * - لو النسخة المثبتة ما فيها المكتبة (بناء قديم) ما يصير شي
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { track } from './track';

const KEY = 'sg_review_v1';
type State = { first: number; happy: number; asks: number[] };
const DAY = 86400e3;

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
function lib(): any {
  if (Platform.OS === 'web') return null;
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (!requireOptionalNativeModule('ExpoStoreReview')) return null;
    return require('expo-store-review');
  } catch { return null; }
}

async function load(): Promise<State> {
  try { const s = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null'); if (s?.first) return s; } catch { /* */ }
  const s = { first: Date.now(), happy: 0, asks: [] };
  AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
  return s;
}
load(); // نسجّل أول تشغيل

let busy = false;
/** لحظة حلوة: نعدّها، ولو تحققت الشروط نطلب التقييم بعد ثانيتين (بعد ما يشوف نتيجة اللي سواه) */
export async function happyMoment(why: string) {
  if (busy) return;
  busy = true;
  try {
    const s = await load();
    s.happy += 1;
    const now = Date.now();
    s.asks = s.asks.filter((t) => now - t < 365 * DAY);
    const ok = s.happy >= 3 && now - s.first > 2 * DAY && s.asks.length < 3 && (!s.asks.length || now - s.asks[s.asks.length - 1] > 40 * DAY);
    const L = ok ? lib() : null;
    if (L && (await L.hasAction().catch(() => false))) {
      s.asks.push(now); s.happy = 0;
      setTimeout(() => { L.requestReview().catch(() => {}); track('review_prompt', undefined, why); }, 2000);
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* */ } finally { busy = false; }
}
