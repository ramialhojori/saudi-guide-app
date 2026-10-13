/** جواز السعودية: ختم الزيارة بالموقع */
import * as Location from 'expo-location';
import { api, ApiError } from './api';
import { session } from './auth';
import type { CPost } from './community';

export type Passport = { cities: { id: string; count: number; first: number }[]; recent: { id: number; title: string; city: string; created: number }[]; places: number; all: { id: string; name: string }[] };
export type PlaceSocial = { visits: number; posts: number; been: boolean; tip: { id: number; text: string; name: string; badge: string } | null };

const tok = () => session().token;
export const getPassport = () => api<Passport>('/v1/me/passport', { token: tok() });
export const placeSocial = (id: number) => api<PlaceSocial>(`/v1/community/place/${id}`, { token: tok() });
export const placePosts = (id: number) => api<{ posts: CPost[] }>(`/v1/community?place=${id}`, { token: tok() }).then((r) => r.posts);

/** يجيب موقعك ويرسله للسيرفر — السيرفر يتأكد إنك على بعد أقل من 500 متر */
export async function checkIn(placeId: number): Promise<{ ok: true; newCity?: boolean; points?: number; already?: boolean } | { ok: false; msg: string }> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return { ok: false, msg: 'نحتاج إذن الموقع عشان نتأكد إنك في المكان. فعّله من الإعدادات.' };
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
  if (!pos) return { ok: false, msg: 'ما قدرنا نحدد موقعك. جرّب في مكان مفتوح.' };
  try {
    const r = await api<{ newCity?: boolean; points?: number; already?: boolean }>('/v1/me/visits', { method: 'POST', body: { placeId, lat: pos.coords.latitude, lng: pos.coords.longitude }, token: tok() });
    return { ok: true, newCity: r.newCity, points: r.points, already: r.already };
  } catch (e) {
    const err = e as ApiError;
    if (err.code === 'too_far') return { ok: false, msg: 'لازم تكون في المكان عشان تختم جوازك. قرّب وجرّب مرة ثانية.' };
    if (err.code === 'place_has_no_location') return { ok: false, msg: 'المكان هذا ما له موقع على الخريطة للحين.' };
    return { ok: false, msg: 'ما قدرنا نختم الحين، جرّب بعد شوي.' };
  }
}
