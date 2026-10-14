/** قياس الاستخدام (مجهول): نجمع أحداث بسيطة ونرسلها دفعات للسيرفر.
 *  ما فيه أي معلومة شخصية — معرّف الجهاز رقم عشوائي يتولد هنا. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { env } from '@/config/env';

type Ev = { e: string; id?: number | string; q?: string };
let queue: Ev[] = [];
let device = '';
let timer: ReturnType<typeof setTimeout> | null = null;
let lastOpen = 0;

async function deviceId() {
  if (device) return device;
  try {
    device = (await AsyncStorage.getItem('sg_device_v1')) || '';
    if (!device) { device = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); await AsyncStorage.setItem('sg_device_v1', device); }
  } catch { device = device || 'd' + Math.random().toString(36).slice(2, 12); }
  return device;
}

async function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length || !env.apiUrl) return;
  const events = queue.splice(0, 100);
  try {
    await fetch(env.apiUrl + '/v1/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: await deviceId(), platform: Platform.OS, version: Constants.expoConfig?.version ?? '', events }),
    });
  } catch { /* نتجاهل: القياس ما يعطّل التطبيق */ }
}

export function track(e: string, id?: number | string, q?: string) {
  queue.push({ e, id, q });
  if (queue.length >= 15) flush();
  else if (!timer) timer = setTimeout(flush, 15000);
}

/** فتح التطبيق: أول مرة، وكل ما رجع له بعد 30 دقيقة */
export function startTracking() {
  const open = () => { if (Date.now() - lastOpen > 30 * 60e3) { lastOpen = Date.now(); track('open'); } };
  open();
  AppState.addEventListener('change', (s) => { if (s === 'active') open(); else flush(); });
}
