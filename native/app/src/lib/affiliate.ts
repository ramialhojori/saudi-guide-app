/** الحجز بالعمولة (Travelpayouts): الروابط تجي من السيرفر، ورامي يشغّلها ويعدّلها من اللوحة */
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { api } from './api';
import { CITY_EN } from './content';
import { track } from './track';

export type BookKind = 'hotels' | 'flights' | 'tours' | 'cars';
type Aff = { on: boolean; links: Partial<Record<BookKind, string>> };
let cache: Aff | null = null;
let pending: Promise<Aff> | null = null;
const load = () => (pending ??= api<Aff>('/v1/affiliate', { timeoutMs: 6000 }).then((r) => (cache = r)).catch(() => (cache = { on: false, links: {} })));

/** روابط الحجز المتاحة (فاضية لو مقفلة) */
export function useAffiliate(): Aff['links'] {
  const [a, setA] = useState(cache);
  useEffect(() => { if (!cache) load().then(setA); }, []);
  return a?.on ? a.links : {};
}

export type BookCtx = { city?: string; lat?: number; lng?: number; place?: string };
export function openBooking(kind: BookKind, tpl: string, c: BookCtx) {
  const v: Record<string, string> = {
    city: c.city || '', city_en: (c.city && CITY_EN[c.city]) || '', lat: c.lat != null ? String(c.lat) : '', lng: c.lng != null ? String(c.lng) : '', place: c.place || '',
  };
  const url = tpl.replace(/\{(city_en|city|lat|lng|place)\}/g, (_, k) => encodeURIComponent(v[k]));
  track('book_click', kind, c.city);
  WebBrowser.openBrowserAsync(url).catch(() => {});
}
