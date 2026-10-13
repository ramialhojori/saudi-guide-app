/**
 * المواسم: كل موسم يتكوّن من فعالياته (تصنيف «موسم …» أو «لحظات العلا» في قودبابر).
 * المواعيد والمناطق تنحسب من الفعاليات نفسها — ما نكتب تواريخ يدوياً.
 * الشكل (اللون والصورة والوصف) من هنا لين ينضاف في لوحة التحكم.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { EventItem } from './types';
import { brand, type PhotoKey } from '@/theme/tokens';

export const SEASON_RE = /^(موسم|لحظات)/;
const LOOK: Record<string, { color: string; photo: PhotoKey; line: string }> = {
  'موسم الرياض': { color: brand.purple, photo: 'riyadh', line: 'حفلات ومسرح ورياضة وتجارب في قلب العاصمة' },
  'موسم جدة': { color: brand.skyDeep, photo: 'water', line: 'البحر والبلد والتجارب على الكورنيش' },
  'موسم الدرعية': { color: brand.orangeDeep, photo: 'heritage', line: 'فن وتراث في مهد الدولة السعودية' },
  'لحظات العلا': { color: brand.pinkDeep, photo: 'rock', line: 'مهرجانات وسماء صافية بين الصخور' },
};
export const slug = (name: string) => encodeURIComponent(name);

export type Season = { name: string; color: string; photo: PhotoKey; line: string; start: number; end: number; events: EventItem[]; zones: { name: string; n: number }[]; live: boolean };

export function seasonsFrom(events: EventItem[], now = Date.now()): Season[] {
  const names = [...new Set(events.flatMap((e) => (e.cats || []).filter((c) => SEASON_RE.test(c))))];
  return names.map((name) => {
    const ev = events.filter((e) => (e.cats || []).includes(name)).sort((a, b) => a.start.localeCompare(b.start));
    const start = Math.min(...ev.map((e) => new Date(e.start).getTime()));
    const end = Math.max(...ev.map((e) => new Date(e.end || e.start).getTime()));
    const z = new Map<string, number>();
    for (const e of ev) {
      const zone = (e.address || '').split(/[،,]/)[0].trim();
      if (zone && !/^https?:/.test(zone)) z.set(zone, (z.get(zone) ?? 0) + 1);
    }
    const look = LOOK[name] ?? { color: brand.lilac, photo: 'fest' as PhotoKey, line: 'فعاليات وتجارب الموسم' };
    return { name, ...look, start, end, events: ev, zones: [...z.entries()].map(([n, c]) => ({ name: n, n: c })).sort((a, b) => b.n - a.n).slice(0, 8), live: start <= now && end >= now };
  }).filter((s) => s.end >= now).sort((a, b) => Number(b.live) - Number(a.live) || b.events.length - a.events.length);
}

export function seasonStatus(s: Season, now = Date.now()) {
  const d = (ms: number) => Math.max(1, Math.ceil(ms / 86400e3));
  return s.live ? `شغّال الحين · باقي ${d(s.end - now)} يوم` : `يبدأ بعد ${d(s.start - now)} يوم`;
}

/* متابعة المواسم (محلياً — تنتقل للحساب مع الإشعارات) */
const KEY = 'sg_follow_seasons_v1';
let followed: string[] = [];
const subs = new Set<() => void>();
AsyncStorage.getItem(KEY).then((v) => { try { followed = JSON.parse(v || '[]'); } catch {} subs.forEach((f) => f()); }).catch(() => {});
export function toggleFollow(name: string) {
  followed = followed.includes(name) ? followed.filter((x) => x !== name) : [...followed, name];
  AsyncStorage.setItem(KEY, JSON.stringify(followed)).catch(() => {});
  subs.forEach((f) => f());
}
export const useFollowed = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => followed);

/** عدّ الفعاليات بالعربي الصحيح */
export const countEvents = (n: number) => (n === 1 ? 'فعالية وحدة' : n === 2 ? 'فعاليتين' : n <= 10 ? `${n} فعاليات` : `${n} فعالية`);
