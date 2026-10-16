/** تقييمات الأماكن وصور الزوار */
import { api } from './api';
import { session } from './auth';
import { t } from './i18n';

export type Review = { id: number; stars: number; tags: string[]; text: string; created: number; updated: number; author: { id: string; name: string; city: string }; mine: boolean; photos: string[]; status?: string };
export type PlaceReviews = {
  count: number; avg: number | null; dist: Record<string, number>; tags: { t: string; n: number }[];
  reviews: Review[]; photos: { id: number; url: string; name: string }[]; mine: Review | null; myPending: number;
};
export const REVIEW_TAGS = ['مناسب للعائلة', 'منظّم', 'يستاهل الزيارة', 'تصوير حلو', 'أسعار معقولة', 'خدمة ممتازة', 'هادئ', 'زحمة', 'مواقف صعبة', 'غالي'];
/** وسوم التقييم تنرسل للسيرفر بالعربي، والعرض يكون بـ t(tag) */
export const STAR_WORD = ['', t('ما عجبني'), t('عادي'), t('حلو'), t('رائع'), t('ممتاز')];

const tok = () => session().token;
export const placeReviews = (id: number) => api<PlaceReviews>(`/v1/places/${id}/reviews`, { token: tok() });
export const postReview = (id: number, b: { stars: number; tags: string[]; text: string; photos: string[]; consent: boolean }) =>
  api<{ id: number | null; points?: number; photosPending?: number; status?: 'rejected'; message?: string; pending?: boolean }>(`/v1/places/${id}/reviews`, { method: 'POST', body: b, token: tok() });
export const deleteReview = (id: number) => api(`/v1/places/${id}/reviews`, { method: 'DELETE', token: tok() });
export const reportReview = (id: number, reason = '') => api(`/v1/reviews/${id}/report`, { method: 'POST', body: { reason }, token: tok() });
export const reportPhoto = (id: number, reason = '') => api(`/v1/photos/${id}/report`, { method: 'POST', body: { reason }, token: tok() });
