/**
 * «رحلتي»: الأماكن مقسّمة على أيام. كل يوم قائمة أماكن بالترتيب.
 * تنحفظ في الجوال، وتتزامن مع الحساب (السيرفر يحفظ اليوم والترتيب).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { happyMoment } from './review';

const KEY = 'sg_trip_v1';        // القديم: قائمة مسطّحة
const KEY_DAYS = 'sg_trip_days_v2'; // الجديد: أيام
const KEY_START = 'sg_trip_start'; // تاريخ أول يوم (YYYY-MM-DD) لو حدده المستخدم
let days: number[][] = [[]];
let start = '';
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
  try { start = (await AsyncStorage.getItem(KEY_START)) || ''; } catch { /* */ }
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
function setStart(d: string) {
  start = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
  AsyncStorage.setItem(KEY_START, start).catch(() => {});
  emit();
  // تذكير قبل الرحلة بيوم (push.ts يحمّل مكتبة الإشعارات بس في الجوال)
  try { require('./push').tripReminder(start); } catch { /* */ }
}
const without = (id: number) => days.map((d) => d.filter((x) => x !== id));

export const trip = {
  has: (id: number) => ids.includes(id),
  /** القلب وزر «أضف لرحلتي»: يضيف لآخر يوم، أو يشيل لو موجود */
  toggle(id: number) {
    if (ids.includes(id)) return commit(without(id));
    const d = days.map((x) => [...x]); d[d.length - 1].push(id); commit(d);
    happyMoment('trip_add');
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
  clear() { setStart(''); commit([[]]); },
  /** تاريخ بداية الرحلة (فاضي = ما حدد) */
  start: () => start,
  setStart: (d: string) => setStart(d),
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
export function useTrip(): { ids: number[]; days: number[][]; loaded: boolean; start: string } {
  const d = useSyncExternalStore(subscribe, () => days);
  const s = useSyncExternalStore(subscribe, () => start);
  return { ids: ids, days: d, loaded, start: s };
}

/** تاريخ يوم معيّن من الرحلة (i من صفر) بصيغة قصيرة، أو فاضي لو ما فيه تاريخ بداية */
export function tripDayDate(startDate: string, i: number, en: boolean, withWeekday = true): string {
  if (!startDate) return '';
  const d = new Date(startDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + i);
  return d.toLocaleDateString(en ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { timeZone: 'UTC', day: 'numeric', month: 'short', ...(withWeekday ? { weekday: 'short' } : {}) });
}

/* ——— مشاركة الرحلة برابط ———
   الرحلة كلها داخل الرابط نفسه (بدون سيرفر): أرقام الأماكن بنظام 36 ويفصلها «.»، والأيام يفصلها «_»
   مثال: https://www.saudi-guide.com/plan/a3.b7_cc  ← يومين: (370، 403) ثم (444)
   الرابط يفتح التطبيق مباشرة لو منزّل (applinks)، وإلا يفتح نسخة الويب */
export const encodeTrip = (d: number[][]) => d.filter((x) => x.length).map((x) => x.map((id) => id.toString(36)).join('.')).join('_');
export const decodeTrip = (code: string): number[][] =>
  String(code || '').slice(0, 1500).split('_').map((x) => x.split('.').map((s) => parseInt(s, 36)).filter((n) => Number.isFinite(n) && n > 0).slice(0, 30)).filter((x) => x.length).slice(0, 14);
