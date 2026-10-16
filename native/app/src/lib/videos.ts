/** مراجعات الفيديو: رفع مقطع قصير عن المكان (قيد المراجعة) وعرض المعتمد */
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { env } from '@/config/env';
import { api } from './api';
import { session } from './auth';
import { t } from './i18n';

export type PlaceVideo = { id: number; url: string; caption: string; duration: number | null; at: number; name: string };
export const getPlaceVideos = (id: number) => api<{ videos: PlaceVideo[] }>(`/v1/places/${id}/videos`).then((r) => r.videos);

/* eslint-disable @typescript-eslint/no-require-imports */
/** مشغّل الفيديو موجود في النسخة المثبتة؟ (expo-video يحتاج بناء جديد) */
export function playerAvailable(): boolean {
  if (Platform.OS === 'web') return true;
  try { return !!require('expo-modules-core').requireOptionalNativeModule('ExpoVideo'); } catch { return false; }
}

/** يختار فيديو (لين دقيقة) ويرفعه. يرجّع رسالة خطأ أو null */
export async function pickAndUpload(placeId: number, camera: boolean, onProgress?: (s: string) => void): Promise<string | null> {
  try {
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return t('نحتاج إذن الكاميرا من الإعدادات.');
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['videos'], videoMaxDuration: 60, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium, shouldDownloadFromNetwork: true };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets[0]) return '';
    const a = r.assets[0];
    const dur = (a.duration ?? 0) / 1000;
    if (dur > 62) return t('الفيديو أطول من دقيقة. قصّه وجرّب مرة ثانية.');
    if (a.fileSize && a.fileSize > 40 * 1024 * 1024) return t('الفيديو كبير (أكثر من 40 ميقا). صوّر مقطع أقصر.');
    onProgress?.(t('جاري الرفع…'));
    const blob = await (await fetch(a.uri)).blob();
    const type = (a.mimeType || '').includes('quicktime') || a.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
    const res = await fetch(`${env.apiUrl}/v1/places/${placeId}/videos?duration=${Math.round(dur)}`, { method: 'POST', headers: { 'Content-Type': type, Authorization: `Bearer ${session().token}` }, body: blob });
    if (res.ok) return null;
    const e = (await res.json().catch(() => ({}))).error;
    return ({ too_many_pending: t('عندك 3 مقاطع تنتظر المراجعة. انتظر لين نراجعها.'), too_big: t('الفيديو كبير (أكثر من 40 ميقا).'), bad_type: t('صيغة الفيديو ما تنفع، جرّب مقطع ثاني.'), login_required: t('سجّل دخولك أول.') } as Record<string, string>)[e] || t('ما قدرنا نرفع الفيديو. تأكد من النت وجرّب مرة ثانية.');
  } catch { return t('ما قدرنا نرفع الفيديو. تأكد من النت وجرّب مرة ثانية.'); }
}
