/**
 * إعلانات داخلية: رامي يضيفها من اللوحة (ترويج لأقسام دليل أو راعي مجاني)
 *  - تطلع مكان إعلان قوقل بنسبة share (من اللوحة)، ولو إعلان قوقل ما وصل تطلع بداله
 *  - نفس قواعد الإعلانات: تختفي لمشتركي دليل+، ووقت «ساعة بدون إعلانات»، ولو الإعلانات مقفلة من اللوحة
 *  - الرابط: مسار داخل التطبيق (/plus) أو موقع https
 */
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { api } from './api';
import { isPlus, useAuth } from './auth';
import { useFeatures } from './features';
import { useAdFreeUntil } from './ads';
import { isEn } from './i18n';

export type HousePlacement = 'banner' | 'native';
type Raw = { id: number; title: string; titleEn: string; body: string; bodyEn: string; cta: string; ctaEn: string; image: string; link: string; sponsor: string; placements: HousePlacement[]; cities: string[]; weight: number };
export type HouseAd = { id: number; title: string; body: string; cta: string; image: string; link: string; sponsor: string };
type Resp = { share: number; ads: Raw[] };

const TTL = 10 * 60 * 1000;
let cache: Resp | null = null, at = 0;
let pending: Promise<Resp> | null = null;
function load(): Promise<Resp> {
  if (cache && Date.now() - at < TTL) return Promise.resolve(cache);
  return (pending ??= api<Resp>('/v1/house-ads', { timeoutMs: 6000 })
    .then((r) => { cache = { share: +r.share || 0, ads: Array.isArray(r.ads) ? r.ads : [] }; at = Date.now(); return cache; })
    .catch(() => cache || { share: 0, ads: [] })
    .finally(() => { pending = null; }));
}

/** يقدر يشوف إعلانات أصلاً؟ (بدون شرط مكتبة قوقل) */
export function useHouseAllowed(): boolean {
  const { user } = useAuth();
  const F = useFeatures();
  const free = useAdFreeUntil();
  return !isPlus(user) && F.ads !== false && !free;
}

const local = (a: Raw): HouseAd => ({
  id: a.id, image: a.image, link: a.link, sponsor: a.sponsor,
  title: (isEn && a.titleEn) || a.title, body: (isEn && a.bodyEn) || a.body, cta: (isEn && a.ctaEn) || a.cta,
});

function pick(r: Resp, placement: HousePlacement, city: string | undefined, roll: number): HouseAd | null {
  const list = r.ads.filter((a) => a.image && a.placements.includes(placement) && (!a.cities.length || (!!city && a.cities.includes(city))));
  if (!list.length) return null;
  const total = list.reduce((s, a) => s + Math.max(1, a.weight || 1), 0);
  let x = roll * total;
  for (const a of list) { x -= Math.max(1, a.weight || 1); if (x < 0) return local(a); }
  return local(list[list.length - 1]);
}

/**
 * لكل خانة إعلان: { ad, preferred }
 *  - ad: الإعلان الداخلي المناسب (أو null)
 *  - preferred: true يعني نعرضه بدل قوقل (حسب النسبة)، false يعني قوقل أول وهذا احتياط لو قوقل فشل
 */
export function useHouseAd(placement: HousePlacement, city?: string): { ad: HouseAd | null; preferred: boolean } {
  const allowed = useHouseAllowed();
  const [r, setR] = useState<Resp | null>(cache);
  const [rolls] = useState(() => [Math.random(), Math.random()]);
  useEffect(() => { if (allowed) load().then(setR); }, [allowed]);
  if (!allowed || !r) return { ad: null, preferred: false };
  const ad = pick(r, placement, city, rolls[0]);
  return { ad, preferred: !!ad && rolls[1] * 100 < r.share };
}

const seen = new Set<string>();
/** مشاهدة وحدة لكل إعلان في كل خانة */
export function houseView(id: number, slot: string) {
  const k = id + ':' + slot;
  if (seen.has(k)) return;
  seen.add(k);
  api(`/v1/house-ads/${id}/view`, { method: 'POST', body: {}, timeoutMs: 6000 }).catch(() => {});
}

export function openHouseAd(ad: HouseAd) {
  api(`/v1/house-ads/${ad.id}/click`, { method: 'POST', body: {}, timeoutMs: 6000 }).catch(() => {});
  const u = ad.link || '';
  if (u.startsWith('/')) router.push(u as never);
  else if (/^https:\/\//.test(u)) WebBrowser.openBrowserAsync(u).catch(() => {});
}
