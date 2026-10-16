/**
 * الإعلانات (Google AdMob) — بهدوء وبدون ما تخرب شكل التطبيق:
 *  - إعلانات مدمجة بنفس شكل بطاقات الأماكن داخل القوائم والأخبار، وبانر صغير في آخر الخبر وصفحة المكان
 *  - ما فيه إعلانات تغطي الشاشة ولا فيديو يقطع التصفح
 *  - تختفي لمشتركي دليل+، وفي نسخة الويب، ولو قفلها رامي من اللوحة (الميزات ← ads)
 *  - معرّفات الوحدات من حساب AdMob حق تطبيق «دليل السياحة السعودية» (نفس التطبيق في المتجر)
 *  - المكتبة تنحمّل وقت التشغيل: لو النسخة المثبتة ما فيها الإعلانات (بناء قديم) التطبيق يكمل عادي بدون إعلانات
 */
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// rewarded: وحدة «شاهد إعلان وأخفِ الإعلانات ساعة» — فاضية لين ننشئها في AdMob (الزر يختفي لو فاضية، إلا وقت التطوير)
const IDS = {
  ios: { native: 'ca-app-pub-5413358932647152/6627712784', banner: 'ca-app-pub-5413358932647152/2667666067', rewarded: '' },
  android: { native: 'ca-app-pub-5413358932647152/2857409612', banner: 'ca-app-pub-5413358932647152/4412810817', rewarded: '' },
};
type Kind = 'native' | 'banner' | 'rewarded';
/** معرّف الوحدة (إعلانات تجريبية وقت التطوير عشان ما ينحظر الحساب) */
export function unitId(kind: Kind): string {
  const L = adsLib();
  if (__DEV__ && L?.TestIds) return ({ native: L.TestIds.NATIVE, banner: L.TestIds.ADAPTIVE_BANNER, rewarded: L.TestIds.REWARDED } as Record<Kind, string>)[kind];
  return (Platform.OS === 'ios' ? IDS.ios : IDS.android)[kind];
}

/* ——— «بدون إعلانات لمدة ساعة» مقابل مشاهدة إعلان بمكافأة ——— */
const FREE_KEY = 'sg_ad_free_until';
const FREE_MS = 60 * 60 * 1000;
let freeUntil = 0;
const freeSubs = new Set<() => void>();
AsyncStorage.getItem(FREE_KEY).then((v) => { freeUntil = +(v || 0); freeSubs.forEach((f) => f()); }).catch(() => {});
let tick: ReturnType<typeof setTimeout> | null = null;
function setFree(until: number) {
  freeUntil = until;
  AsyncStorage.setItem(FREE_KEY, String(until)).catch(() => {});
  freeSubs.forEach((f) => f());
  if (tick) clearTimeout(tick);
  tick = setTimeout(() => freeSubs.forEach((f) => f()), Math.max(0, until - Date.now()) + 500); // ترجع الإعلانات لحالها بعد الساعة
}
const subFree = (f: () => void) => { freeSubs.add(f); return () => { freeSubs.delete(f); }; };
/** متى تنتهي فترة «بدون إعلانات» (0 = مو مفعّلة) */
export const useAdFreeUntil = () => { const u = useSyncExternalStore(subFree, () => freeUntil); return u > Date.now() ? u : 0; };
/** هل نقدر نعرض زر «شاهد إعلان وأخفِ الإعلانات ساعة»؟ */
export const rewardedAvailable = () => !!adsLib() && !!unitId('rewarded');

/** يعرض إعلان المكافأة؛ لو شاهده كامل نخفي الإعلانات ساعة. يرجع true لو انخفت */
export function watchForAdFree(): Promise<boolean> {
  const L = adsLib();
  if (!L || !unitId('rewarded')) return Promise.resolve(false);
  return new Promise((resolve) => {
    let earned = false, done = false;
    const finish = (ok: boolean) => { if (done) return; done = true; subs.forEach((u) => u()); resolve(ok); };
    const ad = L.RewardedAd.createForAdRequest(unitId('rewarded'));
    const subs = [
      ad.addAdEventListener(L.RewardedAdEventType.LOADED, () => { ad.show().catch(() => finish(false)); }),
      ad.addAdEventListener(L.RewardedAdEventType.EARNED_REWARD, () => { earned = true; setFree(Date.now() + FREE_MS); }),
      ad.addAdEventListener(L.AdEventType.CLOSED, () => finish(earned)),
      ad.addAdEventListener(L.AdEventType.ERROR, () => finish(false)),
    ];
    start().then(() => ad.load());
    setTimeout(() => finish(earned), 45000); // ما وصل إعلان خلال 45 ثانية
  });
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
  const free = useAdFreeUntil();
  const allowed = Platform.OS !== 'web' && !isPlus(user) && F.ads !== false && !free && !!adsLib();
  const [ready, setReady] = useState(false);
  useEffect(() => { if (allowed) start().then(setReady); }, [allowed]);
  return allowed && ready;
}
