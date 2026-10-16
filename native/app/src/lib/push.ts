/**
 * إشعارات الجوال (Expo Push):
 * - الإذن ما ينطلب أول ما يفتح التطبيق؛ ينطلب بعد شاشة الترحيب أو لما يفعّل المستخدم إشعار من الإعدادات
 * - الجهاز يتسجّل عند السيرفر مع حسابه ومدنه وتفضيلاته، والسيرفر يرسل له الردود والعروض والرسائل
 * - الضغط على الإشعار يفتح الصفحة المرتبطة فيه
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { api } from './api';
import { session } from './auth';
import { tr } from './i18n';

/* eslint-disable @typescript-eslint/no-explicit-any */
let N: any = null;
let Device: any = null;
function mods() {
  if (Platform.OS === 'web') return false;
  try { N ??= require('expo-notifications'); Device ??= require('expo-device'); return true; } catch { return false; }
}

export type PushPrefs = { trip: boolean; community: boolean; offers: boolean; events: boolean; places: boolean };
export const PREFS_KEY = 'sg_notif_prefs_v1';
const DEFAULT: PushPrefs = { trip: true, community: true, offers: false, events: true, places: true };
export async function pushPrefs(): Promise<PushPrefs> {
  try { return { ...DEFAULT, ...JSON.parse((await AsyncStorage.getItem(PREFS_KEY)) || '{}') }; } catch { return DEFAULT; }
}

const PROJECT_ID = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
let token: string | null = null;

/** يسجّل الجهاز. ask=true يطلب الإذن لو ما انطلب قبل */
export async function registerPush(ask = false, logout = false): Promise<boolean> {
  if (!mods() || !Device.isDevice) return false;
  let { status } = await N.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await N.requestPermissionsAsync()).status;
  if (status !== 'granted') return false;
  if (Platform.OS === 'android') await N.setNotificationChannelAsync('default', { name: tr('دليل السعودية', 'Saudi Guide'), importance: N.AndroidImportance.DEFAULT }).catch(() => {});
  token ??= (await N.getExpoPushTokenAsync(PROJECT_ID ? { projectId: PROJECT_ID } : undefined)).data;
  const raw = await AsyncStorage.getItem('sg_interests_v1').catch(() => null);
  let cities: string[] = [];
  try { cities = (JSON.parse(raw || '{}') as { cities?: string[] }).cities || []; } catch { /* */ }
  await api('/v1/devices', { method: 'POST', body: { token, platform: Platform.OS, cities, prefs: await pushPrefs(), logout }, token: logout ? undefined : session().token || undefined }).catch(() => {});
  return true;
}

let started = false;
/** مرة وحدة عند التشغيل: طريقة عرض الإشعار وفتح الرابط لما ينضغط */
export function startPush() {
  if (started || !mods()) return;
  started = true;
  N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  const open = (resp: any) => {
    const link = resp?.notification?.request?.content?.data?.link;
    if (typeof link === 'string' && link.startsWith('/')) setTimeout(() => router.push(link as never), 300);
  };
  N.addNotificationResponseReceivedListener(open);
  N.getLastNotificationResponseAsync?.().then(open).catch(() => {});
  registerPush(false).catch(() => {});
}
