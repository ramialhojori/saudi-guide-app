/**
 * البحث بالصوت: تقول «مطعم مندي قريب» ويتكتب في خانة البحث
 * - يستخدم تعرّف الكلام في الجوال نفسه (عربي أو إنجليزي حسب لغة التطبيق)
 * - المكتبة اختيارية: لو النسخة المثبتة ما فيها (بناء قديم) الزر ما يطلع
 */
import { Platform } from 'react-native';
import { isEn } from './i18n';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
let mod: any = undefined;
function M(): any {
  if (mod !== undefined) return mod;
  mod = null;
  if (Platform.OS === 'web') return null;
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (requireOptionalNativeModule('ExpoSpeechRecognition')) mod = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
  } catch { mod = null; }
  return mod;
}
export const voiceAvailable = () => !!M();

/** يبدأ الاستماع. onText يوصله النص أول بأول، وonEnd لما يخلص. يرجّع دالة توقف الاستماع */
export async function listen(onText: (s: string, final: boolean) => void, onEnd: (err?: string) => void): Promise<() => void> {
  const S = M();
  if (!S) { onEnd('unavailable'); return () => {}; }
  const perm = await S.requestPermissionsAsync().catch(() => ({ granted: false }));
  if (!perm.granted) { onEnd('permission'); return () => {}; }
  const subs = [
    S.addListener('result', (e: any) => onText(e.results?.[0]?.transcript ?? '', !!e.isFinal)),
    S.addListener('error', (e: any) => { cleanup(); onEnd(e.error || 'error'); }),
    S.addListener('end', () => { cleanup(); onEnd(); }),
  ];
  let done = false;
  function cleanup() { if (done) return; done = true; subs.forEach((s) => s.remove?.()); }
  S.start({ lang: isEn ? 'en-US' : 'ar-SA', interimResults: true, continuous: false, addsPunctuation: false, contextualStrings: ['مطعم', 'مقهى', 'قريب', 'العلا', 'جدة', 'الرياض'] });
  return () => { try { S.stop(); } catch { /* */ } };
}
