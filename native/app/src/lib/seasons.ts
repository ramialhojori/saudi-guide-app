/**
 * المواسم: كل موسم يتكوّن من فعالياته (تصنيف «موسم …» أو «لحظات العلا» في قودبابر).
 * المواعيد والمناطق تنحسب من الفعاليات نفسها — ما نكتب تواريخ يدوياً.
 * الشكل (اللون والصورة والوصف) من هنا لين ينضاف في لوحة التحكم.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { EventItem } from './types';
import { api } from './api';
import { brand, type PhotoKey } from '@/theme/tokens';

export const SEASON_RE = /^(موسم|لحظات) /;
const LOOK: Record<string, { color: string; photo: PhotoKey; line: string }> = {
  'موسم الرياض': { color: brand.purple, photo: 'riyadh', line: 'حفلات ومسرح ورياضة وتجارب في قلب العاصمة' },
  'موسم جدة': { color: brand.skyDeep, photo: 'water', line: 'البحر والبلد والتجارب على الكورنيش' },
  'موسم الدرعية': { color: brand.orangeDeep, photo: 'heritage', line: 'فن وتراث في مهد الدولة السعودية' },
  'لحظات العلا': { color: brand.pinkDeep, photo: 'rock', line: 'مهرجانات وسماء صافية بين الصخور' },
  'موسم عسير': { color: brand.green, photo: 'land', line: 'جبال وضباب وتجارب صيفية' },
  'موسم الخبر': { color: brand.skyDeep, photo: 'sea', line: 'الواجهة البحرية والعروض في الشرقية' },
  'مهرجان صيف تبوك': { color: brand.lilac, photo: 'land', line: 'أجواء صيفية معتدلة وفعاليات للعائلة' },
  'مدل بيست': { color: brand.ink, photo: 'fest', line: 'أكبر مهرجان موسيقى في المنطقة' },
  'شتاء طنطورة': { color: brand.pinkDeep, photo: 'rock', line: 'مهرجان شتوي في العلا' },
  'مهرجان الرياض للكوميديا': { color: brand.orangeDeep, photo: 'art', line: 'عروض ستاند أب لأشهر الكوميديين' },
  'رالي حائل': { color: brand.orangeDeep, photo: 'land', line: 'رالي حائل الدولي في رمال النفود' },
};
export const slug = (name: string) => encodeURIComponent(name);

/** بيانات المواسم الرسمية من اللوحة (التواريخ والوصف والغلاف و«سيعود قريباً») */
export type SeasonMeta = { name: string; city: string; start: string; end: string; line: string; link: string; cover: string; returning: boolean; when: string };
export const getSeasonMeta = () => api<{ seasons: SeasonMeta[] }>('/v1/seasons').then((r) => r.seasons).catch(() => [] as SeasonMeta[]);

export type Season = {
  name: string; color: string; photo: PhotoKey; line: string; start: number; end: number; events: EventItem[]; zones: { name: string; n: number }[]; live: boolean;
  /** انتهى ويرجع (ما له فعاليات قادمة) */
  returning: boolean; cover: string; link: string; when: string;
};

const dayMs = (d: string, endOfDay = false) => new Date(`${d}T${endOfDay ? '23:59:00' : '00:00:00'}+03:00`).getTime();

export function seasonsFrom(events: EventItem[], now = Date.now(), meta: SeasonMeta[] = []): Season[] {
  const names = [...new Set([...events.flatMap((e) => (e.cats || []).filter((c) => SEASON_RE.test(c) || meta.some((m) => m.name === c))), ...meta.map((m) => m.name)])];
  const out = names.map((name) => {
    const md = meta.find((m) => m.name === name);
    const ev = events.filter((e) => (e.cats || []).includes(name)).sort((a, b) => a.start.localeCompare(b.start));
    const evStart = ev.length ? Math.min(...ev.map((e) => new Date(e.start).getTime())) : NaN;
    const evEnd = ev.length ? Math.max(...ev.map((e) => new Date(e.end || e.start).getTime())) : NaN;
    // التاريخ الرسمي يغلب، وإلا من الفعاليات
    const start = md?.start ? dayMs(md.start) : evStart;
    const end = md?.end ? dayMs(md.end, true) : evEnd;
    const z = new Map<string, number>();
    for (const e of ev) {
      const zone = (e.address || '').split(/[،,]/)[0].trim();
      if (zone && !/^https?:/.test(zone)) z.set(zone, (z.get(zone) ?? 0) + 1);
    }
    const look = LOOK[name] ?? { color: brand.lilac, photo: 'fest' as PhotoKey, line: 'فعاليات وتجارب الموسم' };
    const active = !isNaN(end) && end >= now;
    return {
      name, ...look, line: md?.line || look.line, start, end, events: ev,
      zones: [...z.entries()].map(([n, c]) => ({ name: n, n: c })).sort((a, b) => b.n - a.n).slice(0, 8),
      live: active && start <= now, returning: !active && !!md?.returning, cover: md?.cover || '', link: md?.link || '', when: md?.when || '',
    };
  });
  return out.filter((s) => s.returning || (!isNaN(s.end) && s.end >= now))
    .sort((a, b) => Number(a.returning) - Number(b.returning) || Number(b.live) - Number(a.live) || b.events.length - a.events.length);
}

export function seasonStatus(s: Season, now = Date.now()) {
  const d = (ms: number) => Math.max(1, Math.ceil(ms / 86400e3));
  if (s.returning) return `سيعود قريباً${s.when ? ' · ' + s.when : ''}`;
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
