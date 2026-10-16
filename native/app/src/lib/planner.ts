/** مخطط الرحلات: يرتب أماكن المدينة على أيام، كل يوم بترتيب قريب من بعض (بدون لف) */
import { getCityPlaces } from './content';
import { km } from './text';
import { t } from './i18n';
import type { Place } from './types';

export type Pace = 'calm' | 'normal' | 'full';
export const PACE: Record<Pace, { label: string; n: number }> = { calm: { label: 'هادية', n: 3 }, normal: { label: 'متوسطة', n: 4 }, full: { label: 'مكثّفة', n: 5 } };
export type PlanStop = Place & { slot: string; driveMin?: number };

// كل فترة باليوم وش يناسبها
const SLOTS: { t: string; kinds: string[] }[] = [
  { t: t('9:00 ص · الصباح'), kinds: ['islamic', 'heritage', 'sights', 'nature'] },
  { t: t('11:30 ص · قبل الظهر'), kinds: ['sights', 'heritage', 'nature', 'shopping'] },
  { t: t('1:30 م · الغداء'), kinds: ['food'] },
  { t: t('4:30 م · العصر'), kinds: ['fun', 'nature', 'sights', 'shopping'] },
  { t: t('7:30 م · المساء'), kinds: ['cafe', 'food', 'fun'] },
];
const ORDER: Record<number, number[]> = { 3: [0, 2, 4], 4: [0, 2, 3, 4], 5: [0, 1, 2, 3, 4] };

export async function makePlan(city: string, days: number, interests: string[], pace: Pace): Promise<PlanStop[][]> {
  // نجيب كل نوع لحاله عشان ما يطغى نوع على الباقي (مثلاً المعالم على المطاعم)
  const need = [...new Set([...SLOTS.flatMap((x) => x.kinds), ...interests])];
  const lists = await Promise.all(need.map((k) => getCityPlaces(city, k).then((r) => r.places).catch(() => [] as Place[])));
  const seen = new Set<number>();
  const pool = lists.flat().filter((p) => p.lat && p.lng && !seen.has(p.id) && (seen.add(p.id), true));
  const want = new Set(interests);
  const score = (p: Place) => (p.kinds.some((k) => want.has(k)) ? 3 : 0) + (p.image || p.thumb ? 1 : 0) + (p.summary ? 0.5 : 0);
  const used = new Set<number>();
  const per = PACE[pace].n;
  const out: PlanStop[][] = [];
  for (let d = 0; d < days; d++) {
    const day: PlanStop[] = [];
    let at: Place | null = null;
    for (const si of ORDER[per]) {
      const slot = SLOTS[si];
      const cands = pool.filter((p) => !used.has(p.id) && p.kinds.some((k) => slot.kinds.includes(k)));
      const strict = slot.kinds.length === 1; // الغداء لازم مطعم، وإذا ما فيه نتخطاه
      const list = cands.length ? cands : strict ? [] : pool.filter((p) => !used.has(p.id));
      if (!list.length) continue;
      // الأفضل = تقييم عالي وقريب من آخر مكان
      const best = list.map((p) => ({ p, v: score(p) - (at ? Math.min(km(at.lat!, at.lng!, p.lat!, p.lng!), 40) / 8 : 0) })).sort((a, b) => b.v - a.v)[0].p;
      used.add(best.id);
      const dist = at ? km(at.lat!, at.lng!, best.lat!, best.lng!) : 0;
      day.push({ ...best, slot: slot.t, driveMin: at ? Math.max(5, Math.round(dist * 1.8 + 4)) : undefined });
      at = best;
    }
    if (day.length) out.push(day);
  }
  return out;
}
