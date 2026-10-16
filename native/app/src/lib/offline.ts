/**
 * تحميل المدينة للاستخدام بدون نت (الجوال بس):
 * - السيرفر يرجع كل أماكن المدينة بالتفاصيل + فعالياتها الجاية (/v1/cities/:id/offline)
 * - نحفظها ملف في مجلد التطبيق، ونحمّل صور الأماكن في ذاكرة الصور (expo-image) عشان تطلع بدون نت
 * - content.ts يرجع لها لما ما يكون فيه نت، قبل النسخة المدمجة في التطبيق
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { api } from './api';
import type { EventItem, PlaceFull } from './types';

export type OfflineCity = { city: string; at: number; places: PlaceFull[]; events: EventItem[] };
type Entry = { at: number; places: number; images: number };
const KEY = 'sg_offline_v1';
export const offlineSupported = Platform.OS !== 'web';

let index: Record<string, Entry> = {};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const mem = new Map<string, OfflineCity>();

AsyncStorage.getItem(KEY).then((v) => { try { index = JSON.parse(v || '{}'); } catch { index = {}; } emit(); }).catch(() => {});
const saveIndex = () => AsyncStorage.setItem(KEY, JSON.stringify(index)).catch(() => {});

/* eslint-disable @typescript-eslint/no-require-imports */
function fileOf(city: string) {
  const { Directory, File, Paths } = require('expo-file-system');
  const dir = new Directory(Paths.document, 'offline');
  if (!dir.exists) dir.create();
  return new File(dir, `${city}.json`);
}

/** يحمّل المدينة. onProgress(0..1) */
export async function downloadCity(city: string, onProgress?: (p: number) => void): Promise<Entry> {
  if (!offlineSupported) throw new Error('unsupported');
  onProgress?.(0.02);
  const data = await api<OfflineCity>(`/v1/cities/${city}/offline`, { timeoutMs: 60000 });
  onProgress?.(0.15);
  fileOf(city).write(JSON.stringify(data));
  mem.set(city, data);
  // الصور: الصغيرة لكل الأماكن، والكبيرة لأول صورة بس (عشان ما ياخذ مساحة كبيرة)
  const urls = [...new Set([
    ...data.places.flatMap((p) => [p.thumb, p.image]),
    ...data.events.flatMap((e) => [e.thumb, e.image]),
  ].filter((u): u is string => !!u && /^https?:/.test(u)))];
  let done = 0;
  for (let i = 0; i < urls.length; i += 8) {
    await Image.prefetch(urls.slice(i, i + 8), { cachePolicy: 'disk' }).catch(() => false);
    done = Math.min(urls.length, i + 8);
    onProgress?.(0.15 + 0.85 * (done / urls.length));
  }
  const e: Entry = { at: data.at || Math.floor(Date.now() / 1000), places: data.places.length, images: urls.length };
  index = { ...index, [city]: e };
  saveIndex(); emit();
  onProgress?.(1);
  return e;
}

/** يشيل المدينة المحمّلة (الصور تبقى في ذاكرة الصور لين النظام ينظفها) */
export function removeCity(city: string) {
  try { const f = fileOf(city); if (f.exists) f.delete(); } catch { /* */ }
  mem.delete(city);
  const next = { ...index }; delete next[city]; index = next;
  saveIndex(); emit();
}

/** بيانات مدينة محمّلة (أو null) */
export async function offlineCity(city: string): Promise<OfflineCity | null> {
  if (!offlineSupported || !index[city]) return null;
  if (mem.has(city)) return mem.get(city)!;
  try {
    const f = fileOf(city);
    if (!f.exists) return null;
    const d = JSON.parse(await f.text()) as OfflineCity;
    mem.set(city, d);
    return d;
  } catch { return null; }
}

/** يدور مكان في كل المدن المحمّلة */
export async function offlinePlace(id: number): Promise<PlaceFull | null> {
  for (const c of Object.keys(index)) {
    const d = await offlineCity(c);
    const p = d?.places.find((x) => x.id === id);
    if (p) return p;
  }
  return null;
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
/** المدن المحمّلة (تتحدث تلقائياً) */
export const useOffline = () => useSyncExternalStore(subscribe, () => index);
