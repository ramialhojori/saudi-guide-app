/**
 * الإعلانات (Google AdMob) — بهدوء وبدون ما تخرب شكل التطبيق:
 *  - إعلانات مدمجة بنفس شكل بطاقات الأماكن داخل القوائم والأخبار، وبانر صغير في آخر الخبر وصفحة المكان
 *  - ما فيه إعلانات تغطي الشاشة ولا فيديو يقطع التصفح
 *  - تختفي لمشتركي دليل+، وفي نسخة الويب، ولو قفلها رامي من اللوحة (الميزات ← ads)
 *  - معرّفات الوحدات من حساب AdMob حق تطبيق «دليل السياحة السعودية» (نفس التطبيق في المتجر)
 *  - المكتبة تنحمّل وقت التشغيل: لو النسخة المثبتة ما فيها الإعلانات (بناء قديم) التطبيق يكمل عادي بدون إعلانات
 */
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import { useEffect, useState } from 'react';
import { isPlus, useAuth } from './auth';
import { useFeatures } from './features';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
let lib: any = null;
let tried = false;
export function adsLib(): any {
  if (tried) return lib;
  tried = true;
  if (Platform.OS === 'web') return null;
  // النسخة المثبتة لازم تكون مبنية مع AdMob؛ نتأكد قبل التحميل (وإلا وضع التطوير يطلع خطأ يقفل الشاشة)
  let native: unknown = null;
  try { native = TurboModuleRegistry.get('RNGoogleMobileAdsModule') ?? NativeModules.RNGoogleMobileAdsModule; } catch { native = null; }
  if (!native) return null;
  try { lib = require('react-native-google-mobile-ads'); } catch { lib = null; }
  return lib;
}

const IDS = {
  ios: { native: 'ca-app-pub-5413358932647152/6627712784', banner: 'ca-app-pub-5413358932647152/2667666067' },
  android: { native: 'ca-app-pub-5413358932647152/2857409612', banner: 'ca-app-pub-5413358932647152/4412810817' },
};
/** معرّف الوحدة (إعلانات تجريبية وقت التطوير عشان ما ينحظر الحساب) */
export function unitId(kind: 'native' | 'banner'): string {
  const L = adsLib();
  if (__DEV__ && L?.TestIds) return kind === 'native' ? L.TestIds.NATIVE : L.TestIds.ADAPTIVE_BANNER;
  return (Platform.OS === 'ios' ? IDS.ios : IDS.android)[kind];
}

let started: Promise<boolean> | null = null;
/** موافقة الخصوصية (UMP/ATT) ثم تشغيل AdMob — مرة وحدة */
function start(): Promise<boolean> {
  if (started) return started;
  started = (async () => {
    const L = adsLib();
    if (!L) return false;
    try { await L.AdsConsent.gatherConsent(); } catch { /* المستخدم رفض أو ما فيه نت: نكمل بإعلانات غير مخصصة */ }
    try { await L.default().initialize(); return true; } catch { return false; }
  })();
  return started;
}

/** هل نعرض إعلانات لهذا المستخدم؟ (بعد ما تجهز المكتبة) */
export function useAds(): boolean {
  const { user } = useAuth();
  const F = useFeatures();
  const allowed = Platform.OS !== 'web' && !isPlus(user) && F.ads !== false && !!adsLib();
  const [ready, setReady] = useState(false);
  useEffect(() => { if (allowed) start().then(setReady); }, [allowed]);
  return allowed && ready;
}
