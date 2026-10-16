/** «رحلات جاهزة»: رحلات منسقة لكل مدينة نحفظها في «رحلتي» بضغطة */
import { api } from './api';
import { session } from './auth';
import { isEn } from './i18n';

export type ReadyTrip = { id: number; city: string; title: string; titleEn: string; intro: string; introEn: string; tags: string[]; cover: string; dayCount: number; placeCount: number; saves: number; plusOnly?: boolean };
export type ReadyTripFull = ReadyTrip & { locked?: boolean; days: { title: string; note: string; places: number[] }[] };

export const tripTitle = (x: ReadyTrip) => (isEn && x.titleEn ? x.titleEn : x.title);
export const tripIntro = (x: ReadyTrip) => (isEn && x.introEn ? x.introEn : x.intro);
export const getReadyTrips = (city?: string) => api<{ trips: ReadyTrip[] }>(`/v1/trips${city ? `?city=${city}` : ''}`).then((r) => r.trips);
export const getReadyTrip = (id: number) => api<{ trip: ReadyTripFull }>(`/v1/trips/${id}`, { token: session().token }).then((r) => r.trip);
export const countSave = (id: number) => api(`/v1/trips/${id}/save`, { method: 'POST', body: {} }).catch(() => {});
