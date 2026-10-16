/**
 * متابعة الأعطال: أي خطأ يصير للمستخدم ينرسل للسيرفر (الرسالة وأول سطور مكانه + الصفحة والإصدار والجهاز)
 * - بدون أي بيانات شخصية، ونفس الخطأ ما ينرسل أكثر من مرة كل 10 دقايق من نفس الجهاز
 * - رامي يشوفها في اللوحة ← «الأعطال»
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { env } from '@/config/env';
import { deviceId } from './track';

let screen = '';
export const setErrorScreen = (s: string) => { screen = s.slice(0, 80); };
const sent = new Map<string, number>();

export async function reportError(err: unknown, fatal = false) {
  try {
    if (__DEV__ || !env.apiUrl) return;
    const e = err instanceof Error ? err : new Error(String(err));
    const key = e.message.slice(0, 120);
    if (Date.now() - (sent.get(key) || 0) < 10 * 60e3) return;
    sent.set(key, Date.now());
    await fetch(`${env.apiUrl}/v1/errors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: e.message || e.name, stack: e.stack || '', screen, fatal, platform: Platform.OS, version: Constants.expoConfig?.version ?? '', device: await deviceId() }),
    });
  } catch { /* الإبلاغ نفسه ما يوقّف التطبيق */ }
}

let installed = false;
/** مرة وحدة عند التشغيل: نلتقط الأخطاء اللي ما انمسكت (ونخلي التعامل الأصلي يكمل) */
export function installErrorReporting() {
  if (installed) return;
  installed = true;
  const EU = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, f?: boolean) => void; setGlobalHandler: (h: (e: unknown, f?: boolean) => void) => void } }).ErrorUtils;
  if (EU) {
    const prev = EU.getGlobalHandler();
    EU.setGlobalHandler((e, fatal) => { reportError(e, !!fatal); prev(e, fatal); });
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('error', (ev) => reportError(ev.error || ev.message));
    window.addEventListener('unhandledrejection', (ev) => reportError((ev as PromiseRejectionEvent).reason));
  }
}
