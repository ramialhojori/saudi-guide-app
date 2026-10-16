/** الطقس الحين من Open-Meteo (مجاني وبدون مفتاح) — لأقرب مدينة لك */
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { allCities } from './content';
import { km } from './text';
import { t } from './i18n';

const TEXT: [number[], string][] = [
  [[0], t('صحو')], [[1, 2], t('غائم جزئياً')], [[3], t('غائم')], [[45, 48], t('ضباب')],
  [[51, 53, 55, 56, 57], t('رذاذ')], [[61, 63, 65, 66, 67, 80, 81, 82], t('ممطر')], [[71, 73, 75, 77, 85, 86], t('ثلج')], [[95, 96, 99], t('عواصف رعدية')],
];
const desc = (code: number) => TEXT.find(([c]) => c.includes(code))?.[1] ?? '';
let cache: { at: number; key: string; v: Weather } | null = null;
export type Weather = { city: string; temp: number; text: string };

export function useWeather(homeCity?: string) {
  const [w, setW] = useState<Weather | null>(cache?.v ?? null);
  useEffect(() => {
    let alive = true;
    (async () => {
      let lat = 24.4672, lng = 39.6111;
      const home = allCities.find((c) => c.id === homeCity);
      if (home) { lat = home.lat; lng = home.lng; }
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted) { const pos = await Location.getLastKnownPositionAsync(); if (pos) { lat = pos.coords.latitude; lng = pos.coords.longitude; } }
      } catch {}
      const near = [...allCities].filter((c) => c.lat && c.lng).sort((a, b) => km(lat, lng, a.lat, a.lng) - km(lat, lng, b.lat, b.lng))[0];
      const key = `${lat.toFixed(1)},${lng.toFixed(1)}`;
      if (cache && cache.key === key && Date.now() - cache.at < 30 * 60e3) { if (alive) setW(cache.v); return; }
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=Asia%2FRiyadh`).then((x) => x.json());
        const v = { city: near?.name ?? t('السعودية'), temp: Math.round(r.current.temperature_2m), text: desc(r.current.weather_code) };
        cache = { at: Date.now(), key, v };
        if (alive) setW(v);
      } catch { /* بدون نت: نخفي الطقس */ }
    })();
    return () => { alive = false; };
  }, [homeCity]);
  return w;
}
