import type { Place } from './types';

export type Cluster = { key: string; lat: number; lng: number; items: Place[] };

/**
 * تجميع الدبابيس: نقسم الشاشة لشبكة تقريباً 7×7، والأماكن في نفس الخانة تصير دائرة فيها رقم.
 * لما المستخدم يقرّب كفاية (أقل من ~1 كم) نعرض كل الدبابيس بدون تجميع.
 */
export function clusterPlaces(places: Place[], region: { latitudeDelta: number; longitudeDelta: number }, keep?: number): Cluster[] {
  const pts = places.filter((p) => p.lat && p.lng);
  if (region.latitudeDelta < 0.012) return pts.map((p) => ({ key: 'p' + p.id, lat: p.lat!, lng: p.lng!, items: [p] }));
  const cy = region.latitudeDelta / 7, cx = region.longitudeDelta / 7;
  const cells = new Map<string, Place[]>();
  const out: Cluster[] = [];
  for (const p of pts) {
    if (p.id === keep) { out.push({ key: 'p' + p.id, lat: p.lat!, lng: p.lng!, items: [p] }); continue; }
    const k = `${Math.floor(p.lat! / cy)}:${Math.floor(p.lng! / cx)}`;
    const a = cells.get(k); if (a) a.push(p); else cells.set(k, [p]);
  }
  cells.forEach((items, k) => {
    const lat = items.reduce((s, p) => s + p.lat!, 0) / items.length, lng = items.reduce((s, p) => s + p.lng!, 0) / items.length;
    out.push(items.length === 1 ? { key: 'p' + items[0].id, lat: items[0].lat!, lng: items[0].lng!, items } : { key: `c${k}:${items.length}`, lat, lng, items });
  });
  return out;
}

