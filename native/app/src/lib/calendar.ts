/**
 * «التقويم والإجازات»: الإجازات المدرسية والمناسبات (من اللوحة) + المواسم والفعاليات
 * - «ذكّرني»: إشعار محلي قبلها بأسبوع (8 المساء) وقبلها بيوم (7 المساء) بتوقيت مكة
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { api } from './api';
import { session } from './auth';
import { isEn, t, tr } from './i18n';
import { cancelLocal, scheduleLocal } from './push';

export type CalKind = 'school' | 'national' | 'religious' | 'other' | 'season';
export type CalItem = { id: number | string; kind: CalKind; title: string; titleEn: string; start: string; end: string; note: string; noteEn: string; cities: string[] };

export const calTitle = (x: CalItem) => (isEn && x.titleEn) || x.title;
export const calNote = (x: CalItem) => (isEn && x.noteEn) || x.note;

export function getCalendar(): Promise<{ items: CalItem[]; going: number[] }> {
  return api<{ items: CalItem[]; going: number[] }>('/v1/calendar', { token: session().token, timeoutMs: 10000 })
    .catch(() => ({ items: [], going: [] }));
}

/** اليوم بتوقيت مكة YYYY-MM-DD */
export const todayKey = (offsetDays = 0) => new Date(Date.now() + 3 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);
const dayUTC = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const daysBetween = (a: string, b: string) => Math.round((dayUTC(b) - dayUTC(a)) / 86400e3);
export const lengthDays = (x: { start: string; end: string }) => daysBetween(x.start, x.end || x.start) + 1;
export const addDays = (d: string, n: number) => new Date(dayUTC(d) + n * 86400e3).toISOString().slice(0, 10);

/** «بعد 7 أيام» / «بكرة» / «اليوم» / «الحين» */
export function countdown(x: { start: string; end: string }): { label: string; live: boolean } {
  const today = todayKey();
  if (x.start <= today && (x.end || x.start) >= today) return { label: x.start === (x.end || x.start) ? t('اليوم') : t('الحين'), live: true };
  const n = daysBetween(today, x.start);
  if (n === 1) return { label: t('بكرة'), live: false };
  if (isEn) return { label: `In ${n} days`, live: false };
  return { label: n === 2 ? 'بعد يومين' : n <= 10 ? `بعد ${n} أيام` : `بعد ${n} يوم`, live: false };
}

/** أفضل مدن حسب الشهر (لو الإجازة ما لها مدن من اللوحة) */
const BEST_BY_MONTH: Record<number, string[]> = {
  1: ['alula', 'tabuk-region', 'hail', 'riyadh'], 2: ['alula', 'diriyah', 'riyadh', 'jeddah'], 3: ['jeddah', 'eastern-region', 'medina', 'alula'],
  4: ['taif', 'jeddah', 'yanbu', 'umluj'], 5: ['abha', 'taif', 'albaha'], 6: ['abha', 'asir-region', 'taif', 'albaha'],
  7: ['abha', 'asir-region', 'taif', 'albaha'], 8: ['abha', 'taif', 'albaha', 'tabuk-region'], 9: ['taif', 'abha', 'riyadh'],
  10: ['alula', 'riyadh', 'jeddah', 'tabuk-region'], 11: ['alula', 'tabuk-region', 'riyadh', 'jeddah'], 12: ['alula', 'tabuk-region', 'hail', 'riyadh'],
};
export const bestCities = (x: CalItem) => (x.cities?.length ? x.cities : BEST_BY_MONTH[+x.start.slice(5, 7)] || []);

/* ---------- ذكّرني ---------- */
const KEY = 'sg_cal_reminders_v1';
let rem: Record<string, string[]> = {};
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
(async () => { try { rem = JSON.parse((await AsyncStorage.getItem(KEY)) || '{}'); } catch { rem = {}; } loaded = true; emit(); })();
const persist = () => AsyncStorage.setItem(KEY, JSON.stringify(rem)).catch(() => {});
export const remKey = (x: CalItem) => `${x.kind}:${x.id}`;
export const useReminders = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => (loaded ? rem : rem));

/** يفعّل/يلغي التذكير. يرجع الحالة الجديدة (false لو ما فيه إذن إشعارات) */
export async function toggleReminder(x: CalItem): Promise<boolean> {
  const k = remKey(x);
  if (rem[k]) {
    for (const id of rem[k]) await cancelLocal(id);
    const { [k]: _, ...rest } = rem; rem = rest; persist(); emit();
    return false;
  }
  const name = calTitle(x);
  const at = (d: string, hourMakkah: number) => new Date(`${d}T${String(hourMakkah).padStart(2, '0')}:00:00+03:00`);
  const ids: string[] = [];
  const week = await scheduleLocal(tr('باقي أسبوع', 'One week to go'), tr(`${name} بعد أسبوع. خطط لها من الحين في دليل السعودية.`, `${name} is a week away. Plan it now in Saudi Guide.`), at(addDays(x.start, -7), 20), '/calendar');
  if (week) ids.push(week);
  const day = await scheduleLocal(tr(`${name} بكرة`, `${name} is tomorrow`), calNote(x) || tr('جهّز نفسك، وشوف وش يناسبك في التقويم.', 'Get ready. See what fits you in the calendar.'), at(addDays(x.start, -1), 19), '/calendar');
  if (day) ids.push(day);
  if (!ids.length) return false;
  rem = { ...rem, [k]: ids }; persist(); emit();
  return true;
}
