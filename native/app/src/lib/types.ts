export type City = {
  id: string; name: string; color: string; lat: number; lng: number;
  kind: 'city' | 'region'; cover: string; count: number;
};
export type Kind = { id: string; name: string };
export type Place = {
  id: number; city: string; title: string; kinds: string[]; cat: string;
  thumb: string; image: string; summary: string; lat: number | null; lng: number | null; km?: number;
};
export type PlaceFull = Place & {
  title_en: string; cats: string[]; body: string; images: string[];
  address: string; phone: string; website: string; email: string; url: string;
};
export type EventItem = {
  id: number; title: string; summary: string; thumb: string; image?: string; start: string; end: string;
  address: string; tickets: string; cats: string[]; city: string | null; lat?: number | null; lng?: number | null; body?: string; images?: string[]; url?: string;
};
export type Article = {
  id: number; title: string; author: string; date: string; summary: string; thumb: string; section: string;
  body?: string; images?: string[]; url?: string;
};
export type Home = { cities: City[]; picks: Place[]; events: EventItem[]; articles: Article[] };
