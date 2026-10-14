/**
 * «رحلتي»: الأماكن مقسّمة على أيام. كل يوم قائمة أماكن بالترتيب.
 * تنحفظ في الجوال، وتتزامن مع الحساب (السيرفر يحفظ اليوم والترتيب).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'sg_trip_v1';        // القديم: قائمة مسطّحة
const KEY_DAYS = 'sg_trip_days_v2'; // الجديد: أيام
let days: number[][] = [[]];
let ids: number[] = [];
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const flat = () => days.flat();
const clean = (d: number[][]) => { const seen = new Set<number>(); const out = d.map((day) => day.filter((x) => x && !seen.has(x) && (seen.add(x), true))); return out.length ? out : [[]]; };
const chunk = (a: number[], n: number) => { const o: number[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o.length ? o : [[]]; };

(async () => {
  try {
    const v2 = await AsyncStorage.getItem(KEY_DAYS);
    if (v2) days = clean((JSON.parse(v2) as unknown[][]).map((d) => d.map(Number)));
    else {
      const v1 = await AsyncStorage.getItem(KEY); // نقل من الشكل القديم: كل 3 أماكن يوم
      const old = (JSON.parse(v1 || '[]') as unknown[]).map(Number).filter(Boolean);
      days = chunk(old, 3);
    }
  } catch { days = [[]]; }
  ids = flat(); loaded = true; emit();
})();

const listeners = new Set<(ids: number[], days: number[][]) => void>();
const commit = (next: number[][], notify = true) => {
  days = clean(next); ids = flat();
  AsyncStorage.setItem(KEY_DAYS, JSON.stringify(days)).catch(() => {});
  AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {});
  emit();
  if (notify) listeners.forEach((f) => f(ids, days));
};
const without = (id: number) => days.map((d) => d.filter((x) => x !== id));

export const trip = {
  has: (id: number) => ids.includes(id),
  /** القلب وزر «أضف لرحلتي»: يضيف لآخر يوم، أو يشيل لو موجود */
  toggle(id: number) {
    if (ids.includes(id)) return commit(without(id));
    const d = days.map((x) => [...x]); d[d.length - 1].push(id); commit(d);
  },
  /** يضيف ليوم معيّن (أو ينقله له لو موجود في يوم ثاني) */
  addTo(id: number, day: number) {
    const d = without(id).map((x) => [...x]);
    while (d.length <= day) d.push([]);
    d[day].push(id); commit(d);
  },
  remove(id: number) { commit(without(id)); },
  moveToDay(id: number, day: number) { trip.addTo(id, day); },
  move(id: number, dir: -1 | 1) {
    const d = days.map((x) => [...x]);
    const di = d.findIndex((x) => x.includes(id)); if (di < 0) return;
    const i = d[di].indexOf(id), j = i + dir;
    if (j < 0 || j >= d[di].length) return;
    [d[di][i], d[di][j]] = [d[di][j], d[di][i]]; commit(d);
  },
  addDay() { commit([...days.map((x) => [...x]), []]); return days.length - 1; },
  removeDay(day: number) { const d = days.map((x) => [...x]); const [gone] = d.splice(day, 1); if (d.length && gone?.length) d[Math.max(0, day - 1)].push(...gone); commit(d.length ? d : [[]]); },
  clear() { commit([[]]); },
  /** خطة كاملة بالأيام (من مخطط الرحلات) */
  setDays(next: number[][]) { commit(next); },
  set(next: number[]) { commit(chunk([...new Set(next)], 3)); },
  /** بعد الدمج مع الحساب: بدون ما نرجع نرسلها */
  replaceDays(next: number[][]) { commit(next, false); },
  replace(next: number[]) { commit(chunk(next, 3), false); },
  all: () => ids,
  days: () => days,
  onChange(f: (ids: number[], days: number[][]) => void) { listeners.add(f); return () => { listeners.delete(f); }; },
};

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export function useTrip(): { ids: number[]; days: number[][]; loaded: boolean } {
  const d = useSyncExternalStore(subscribe, () => days);
  return { ids: ids, days: d, loaded };
}
