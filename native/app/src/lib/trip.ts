/**
 * «رحلتي»: الأماكن اللي حفظها المستخدم، مرتبة حسب ما يبي.
 * تنحفظ في الجوال الحين، وفي المرحلة 2 تتزامن مع حسابه في السيرفر (نفس الشكل).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'sg_trip_v1';
let ids: number[] = [];
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

AsyncStorage.getItem(KEY)
  .then((v) => {
    try { ids = (JSON.parse(v || '[]') as unknown[]).map(Number).filter(Boolean); } catch { ids = []; }
  })
  .finally(() => { loaded = true; emit(); });

const save = () => { AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {}); emit(); };

export const trip = {
  has: (id: number) => ids.includes(id),
  toggle(id: number) { ids = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]; save(); },
  remove(id: number) { ids = ids.filter((x) => x !== id); save(); },
  move(id: number, dir: -1 | 1) {
    const i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    ids = next; save();
  },
  clear() { ids = []; save(); },
};

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export function useTrip(): { ids: number[]; loaded: boolean } {
  const snap = useSyncExternalStore(subscribe, () => ids);
  return { ids: snap, loaded };
}
