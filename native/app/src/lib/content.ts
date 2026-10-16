/**
 * مصدر المحتوى الموحّد للشاشات.
 * - لو السيرفر مضبوط (EXPO_PUBLIC_API_URL) نقرأ منه.
 * - لو ما فيه سيرفر أو ما فيه نت، نرجع للنسخة المدمجة snapshot.json (من تصدير قودبابر).
 * الشاشات ما تعرف الفرق — نفس الأشكال (types.ts) من المصدرين.
 */
import { api } from './api';
import { searchKey, km } from './text';
import type { Article, City, EventItem, Home, Kind, Place, PlaceFull } from './types';
import snapshot from '@/data/snapshot.json';
import weekly from '@/data/weekly_pool.json';
import { isEn } from './i18n';
import { offlineCity, offlinePlace } from './offline';

type SnapPlace = { id: number; c: string; t: string; k: string[]; cat: string; th: string; img: string; s: string; lat: number | null; lng: number | null };
const SNAP = snapshot as unknown as {
  cities: City[]; kinds: Kind[]; places: SnapPlace[]; events: EventItem[]; articles: Article[];
};

const fromSnap = (p: SnapPlace): Place => ({
  id: p.id, city: p.c, title: p.t, kinds: p.k, cat: p.cat, thumb: p.th, image: p.img, summary: p.s, lat: p.lat, lng: p.lng,
});
const PLACES = SNAP.places.map(fromSnap);
const BY_ID = new Map(PLACES.map((p) => [p.id, p]));
const KEYS = new Map(PLACES.map((p) => [p.id, searchKey(p.title + ' ' + p.cat)]));
const withImageFirst = (a: Place[]) => [...a.filter((p) => p.thumb), ...a.filter((p) => !p.thumb)];

async function tryApi<T>(path: string, fallback: () => T | Promise<T>): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback();
  }
}

/* أسماء المدن والتصنيفات بالإنجليزي (نفس اللي في السيرفر backend/src/i18n.js) */
const CITY_EN: Record<string, string> = {
  riyadh: 'Riyadh', medina: 'Madinah', 'makkah-region': 'Makkah', alula: 'AlUla', 'asir-region': 'Asir', taif: 'Taif', jeddah: 'Jeddah',
  jizan: 'Jazan', abha: 'Abha', diriyah: 'Diriyah', yanbu: 'Yanbu', albaha: 'Al-Baha', 'riyadh-region': 'Riyadh Region', 'tabuk-region': 'Tabuk',
  'qassim-region': 'Al-Qassim', 'eastern-region': 'Eastern Province', umluj: 'Umluj & the Red Sea', hail: 'Hail', 'aljawf-region': 'Al-Jouf',
  najran: 'Najran', 'northern-border': 'Northern Borders',
};
const KIND_EN: Record<string, string> = { sights: 'Sights', heritage: 'Heritage & Culture', islamic: 'Islamic Landmarks', nature: 'Nature & Valleys', fun: 'Entertainment', food: 'Restaurants', cafe: 'Cafés', shopping: 'Shopping' };
if (isEn) {
  for (const c of SNAP.cities) c.name = CITY_EN[c.id] ?? c.name;
  for (const k of SNAP.kinds) k.name = KIND_EN[k.id] ?? k.name;
}
export const kinds: Kind[] = SNAP.kinds;
/** كل مدن الدليل بالترتيب المعتمد (المجتمع، الإعدادات، النشر) */
export const ALL_CITY_IDS = ['medina', 'makkah-region', 'riyadh', 'jeddah', 'alula', 'taif', 'abha', 'asir-region', 'diriyah', 'yanbu', 'umluj', 'eastern-region', 'tabuk-region', 'hail', 'qassim-region', 'albaha', 'jizan', 'najran', 'aljawf-region', 'northern-border', 'riyadh-region'];
export const cityName = (id: string) => SNAP.cities.find((c) => c.id === id)?.name ?? '';
export const allCities = SNAP.cities;

/** مختارات الأسبوع — نفس المنطق في السيرفر وفي الصفحة الرئيسية بقودبابر */
export function weeklyPicks(now = new Date()): Place[] {
  const pool = (weekly as { pool: { id: number; s: string; x?: number }[] }).pool;
  const t = new Date(now.getTime() + 3 * 3600e3);
  const days = Math.floor(t.getTime() / 86400e3);
  const sun = days - ((days + 4) % 7);
  const wk = Math.floor(sun / 7);
  const m = t.getUTCMonth() + 1;
  const ok = m >= 11 || m <= 3 ? 'wa' : m >= 5 && m <= 9 ? 'sa' : 'wsa';
  const list = pool.filter((p) => ok.includes(p.s) && BY_ID.has(p.id));
  let seed = ok.length * 7919;
  for (let i = list.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  const stars = list.filter((p) => p.x), rest = list.filter((p) => !p.x);
  const pick: Place[] = [], cs = new Set<string>();
  if (stars.length) { const s = BY_ID.get(stars[wk % stars.length].id)!; pick.push(s); cs.add(s.city); }
  for (let k = 0, start = (wk * 4) % Math.max(rest.length, 1); k < rest.length && pick.length < 5; k++) {
    const r = BY_ID.get(rest[(start + k) % rest.length].id)!;
    if (cs.has(r.city)) continue;
    cs.add(r.city); pick.push(r);
  }
  return pick;
}

/** «مختارات الأسبوع · 11–17 أكتوبر» */
export function weekLabel(now = new Date()): string {
  const MO = isEn ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const t = new Date(now.getTime() + 3 * 3600e3);
  const days = Math.floor(t.getTime() / 86400e3);
  const sun = days - ((days + 4) % 7);
  const a = new Date(sun * 86400e3), b = new Date((sun + 6) * 86400e3);
  return `${a.getUTCDate()}${a.getUTCMonth() === b.getUTCMonth() ? '' : ' ' + MO[a.getUTCMonth()]}–${b.getUTCDate()} ${MO[b.getUTCMonth()]}`;
}

const upcoming = (e: EventItem) => new Date(e.end || e.start).getTime() >= Date.now() - 86400e3;
/** القادمة أولاً بالتاريخ، وبعدها المستمرة (اللي بدأت وما خلصت) */
const byWhen = (a: EventItem, b: EventItem) => {
  const now = Date.now(), sa = new Date(a.start).getTime() < now ? 1 : 0, sb = new Date(b.start).getTime() < now ? 1 : 0;
  return sa - sb || new Date(a.start).getTime() - new Date(b.start).getTime();
};

export const getHome = () =>
  tryApi<Home>('/v1/home', () => ({
    cities: SNAP.cities,
    picks: weeklyPicks(),
    events: SNAP.events.filter(upcoming).sort(byWhen).slice(0, 10),
    articles: [...SNAP.articles].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
  })).then((h) => (h.picks?.length ? h : { ...h, picks: weeklyPicks() }));

export const getCities = () => tryApi<{ cities: City[] }>('/v1/cities', () => ({ cities: SNAP.cities })).then((r) => r.cities);

export function getCityPlaces(city: string, kind?: string, q?: string) {
  const qs = new URLSearchParams({ per: '100', ...(kind ? { kind } : {}), ...(q ? { q } : {}) });
  return tryApi<{ total: number; places: Place[] }>(`/v1/cities/${city}/places?${qs}`, async () => {
    const k = q ? searchKey(q) : '';
    // بدون نت: المدينة المحمّلة أول (أحدث وفيها التفاصيل)، وإلا النسخة المدمجة
    const off = await offlineCity(city);
    const src: Place[] = off ? off.places : PLACES.filter((p) => p.city === city);
    const list = withImageFirst(src.filter((p) => (!kind || p.kinds.includes(kind)) && (!k || searchKey(p.title + ' ' + p.cat).includes(k))));
    return { total: list.length, places: list };
  });
}

/** أنواع الأماكن الموجودة فعلاً في المدينة (للأزرار فوق القائمة) */
export function cityKinds(city: string): (Kind & { n: number })[] {
  const n: Record<string, number> = {};
  for (const p of PLACES) if (p.city === city) for (const k of p.kinds) n[k] = (n[k] || 0) + 1;
  return kinds.filter((k) => n[k.id]).map((k) => ({ ...k, n: n[k.id] })).sort((a, b) => b.n - a.n);
}

export const getPlace = (id: number) =>
  tryApi<{ place: PlaceFull }>(`/v1/places/${id}`, async () => {
    const off = await offlinePlace(id);
    if (off) return { place: off };
    const p = BY_ID.get(id);
    if (!p) throw new Error('not_found');
    return { place: { ...p, title_en: '', cats: [p.cat], body: '', images: p.image ? [p.image] : [], address: '', phone: '', website: '', email: '', url: '' } };
  }).then((r) => r.place);

export const getPlacesByIds = (ids: number[]) =>
  ids.length
    ? tryApi<{ places: Place[] }>(`/v1/places?ids=${ids.join(',')}`, () => ({ places: ids.map((i) => BY_ID.get(i)).filter(Boolean) as Place[] })).then((r) => {
        const m = new Map(r.places.map((p) => [p.id, p]));
        return ids.map((i) => m.get(i)).filter(Boolean) as Place[];
      })
    : Promise.resolve([]);

export function search(q: string) {
  return tryApi<{ places: Place[] }>(`/v1/search?q=${encodeURIComponent(q)}`, () => {
    const k = searchKey(q);
    if (k.length < 2) return { places: [] };
    return { places: withImageFirst(PLACES.filter((p) => KEYS.get(p.id)!.includes(k))).slice(0, 40) };
  }).then((r) => r.places);
}

/** البحث الشامل: أماكن + فعاليات + كوبونات + أسئلة + مدن (Search 2.0) */
export type SearchAll = {
  places: Place[]; events: EventItem[]; coupons: import('./coupons').Coupon[];
  questions: { id: number; text: string; city: string; answers: number }[];
  cities: { id: string; name: string }[]; relaxed?: boolean; parsed?: { city: string | null; kind: string | null };
};
export function searchAll(q: string, o: { city?: string; kind?: string; lat?: number; lng?: number; sort?: 'best' | 'near'; home?: string } = {}) {
  const u = new URLSearchParams({ q });
  Object.entries(o).forEach(([k, v]) => { if (v != null && v !== '') u.set(k, String(v)); });
  return tryApi<SearchAll>(`/v1/search?${u.toString()}`, () => {
    const k = searchKey(q);
    const places = k.length < 2 ? [] : withImageFirst(PLACES.filter((p) => KEYS.get(p.id)!.includes(k) && (!o.city || p.city === o.city) && (!o.kind || p.kinds.includes(o.kind)))).slice(0, 40);
    return { places, events: [], coupons: [], questions: [], cities: [] };
  });
}
export const popularSearches = () => tryApi<{ popular: string[] }>('/v1/search/popular', () => ({ popular: [] })).then((r) => r.popular);

export function nearby(lat: number, lng: number, radiusKm = 25) {
  return tryApi<{ places: Place[] }>(`/v1/nearby?lat=${lat}&lng=${lng}&km=${radiusKm}`, () => ({
    places: PLACES.filter((p) => p.lat && p.lng)
      .map((p) => ({ ...p, km: Math.round(km(lat, lng, p.lat!, p.lng!) * 10) / 10 }))
      .filter((p) => p.km <= radiusKm)
      .sort((a, b) => a.km - b.km)
      .slice(0, 60),
  })).then((r) => r.places);
}

export const getEvents = () =>
  tryApi<{ events: EventItem[] }>('/v1/events', () => ({ events: SNAP.events.filter(upcoming).sort(byWhen) })).then((r) => r.events);
export const getEvent = (id: number) =>
  tryApi<{ event: EventItem }>(`/v1/events/${id}`, () => {
    const e = SNAP.events.find((x) => x.id === id);
    if (!e) throw new Error('not_found');
    return { event: e };
  }).then((r) => r.event);

export const getArticles = () =>
  tryApi<{ articles: Article[] }>('/v1/articles', () => ({ articles: [...SNAP.articles].sort((a, b) => b.date.localeCompare(a.date)) })).then((r) => r.articles);
/** صفحة الأخبار: 20 خبر بالصفحة */
export const getArticlesPage = (page: number, cat?: string | null) =>
  tryApi<{ articles: Article[] }>(`/v1/articles?page=${page}${cat ? `&cat=${encodeURIComponent(cat)}` : ''}`, () => ({
    articles: page === 1 ? [...SNAP.articles].filter((a) => !cat || (a.cats || []).includes(cat)).sort((a, b) => b.date.localeCompare(a.date)) : [],
  })).then((r) => r.articles);
export const getArticle = (id: number) =>
  tryApi<{ article: Article }>(`/v1/articles/${id}`, () => {
    const a = SNAP.articles.find((x) => x.id === id);
    if (!a) throw new Error('not_found');
    return { article: a };
  }).then((r) => r.article);

/** تصفح نوع واحد في كل المدن (من الرئيسية) — من النسخة المدمجة لين يجهز مسار السيرفر */
export function kindPlaces(kind: string, city?: string): Place[] {
  return withImageFirst(PLACES.filter((p) => p.kinds.includes(kind) && (!city || p.city === city))).slice(0, 80);
}
