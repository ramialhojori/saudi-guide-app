/** مفاتيح المميزات: رامي يخفي أي ميزة من اللوحة («المميزات») بدون تحديث التطبيق */
import { useEffect, useState } from 'react';
import { api } from './api';

export type Features = {
  coupons: boolean; merchants: boolean; points: boolean; reviews: boolean; photos: boolean; passport: boolean;
  guides: boolean; impact: boolean; facts: boolean; suggest: boolean; heroes: boolean; challenge: boolean;
  ai_chat: boolean; ai_planner: boolean; comments: boolean;
};
const ALL_ON: Features = { coupons: true, merchants: true, points: true, reviews: true, photos: true, passport: true, guides: true, impact: true, facts: true, suggest: true, heroes: true, challenge: true, ai_chat: true, ai_planner: true, comments: true };

let cur: Features = ALL_ON;
let at = 0;
let pending: Promise<void> | null = null;
const subs = new Set<(f: Features) => void>();

function refresh() {
  if (pending || Date.now() - at < 5 * 60e3) return pending;
  pending = api<{ features: Partial<Features> }>('/v1/features', { timeoutMs: 6000 })
    .then((r) => { cur = { ...ALL_ON, ...r.features }; at = Date.now(); subs.forEach((f) => f(cur)); })
    .catch(() => {})
    .finally(() => { pending = null; });
  return pending;
}

/** يرجع المميزات الحالية (كلها شغالة لين يرد السيرفر) ويتحدث كل 5 دقائق */
export function useFeatures(): Features {
  const [f, setF] = useState(cur);
  useEffect(() => { subs.add(setF); refresh(); return () => { subs.delete(setF); }; }, []);
  return f;
}
