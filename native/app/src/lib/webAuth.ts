/** الدخول بقوقل وآبل في نسخة الويب (saudi-guide.com) — مكتبات قوقل وآبل الرسمية للمتصفح */
import { Platform } from 'react-native';
import { api } from './api';
import { signInWithIdToken } from './auth';
import { isEn, t } from './i18n';

export type WebConfig = { googleWebClientId: string; appleServiceId: string; appStoreId: string; androidPackage: string };
let cfg: Promise<WebConfig> | null = null;
export const webConfig = () => (cfg ??= api<WebConfig>('/v1/web/config').catch(() => ({ googleWebClientId: '', appleServiceId: '', appStoreId: '1595843013', androidPackage: 'carizmaapps.saudiguide' })));

const loaded = new Map<string, Promise<void>>();
function loadScript(src: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return Promise.reject(new Error('web_only'));
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('script_failed'));
      document.head.appendChild(s);
    }));
  }
  return loaded.get(src)!;
}

type G = { accounts: { id: { initialize: (o: object) => void; renderButton: (el: HTMLElement, o: object) => void } } };
/** يرسم زر قوقل الرسمي داخل العنصر، ولما يختار حسابه يدخل مباشرة */
export async function renderGoogleButton(el: HTMLElement, width: number, onDone: () => void, onErr: (m: string) => void) {
  const c = await webConfig();
  if (!c.googleWebClientId) throw new Error('google_not_configured');
  await loadScript('https://accounts.google.com/gsi/client');
  const g = (window as unknown as { google: G }).google;
  g.accounts.id.initialize({
    client_id: c.googleWebClientId, ux_mode: 'popup', locale: isEn ? 'en' : 'ar',
    callback: async (r: { credential: string }) => {
      try { await signInWithIdToken('google', r.credential); onDone(); } catch (e) { onErr((e as Error)?.message || t('خطأ')); }
    },
  });
  g.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: isEn ? 'en' : 'ar', width: Math.min(400, Math.round(width)) });
}

type A = { auth: { init: (o: object) => void; signIn: () => Promise<{ authorization: { id_token: string }; user?: { name?: { firstName?: string; lastName?: string } } }> } };
export async function appleWebAvailable() { return !!(await webConfig()).appleServiceId; }
export async function signInWithAppleWeb(): Promise<'ok' | 'cancel'> {
  const c = await webConfig();
  if (!c.appleServiceId) throw new Error('apple_not_configured');
  await loadScript(`https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/${isEn ? 'en_US' : 'ar_SA'}/appleid.auth.js`);
  const AppleID = (window as unknown as { AppleID: A }).AppleID;
  AppleID.auth.init({ clientId: c.appleServiceId, scope: 'name email', redirectURI: window.location.origin, usePopup: true });
  try {
    const r = await AppleID.auth.signIn();
    const name = [r.user?.name?.firstName, r.user?.name?.lastName].filter(Boolean).join(' ');
    await signInWithIdToken('apple', r.authorization.id_token, name);
    return 'ok';
  } catch (e) {
    const err = (e as { error?: string })?.error;
    if (err === 'popup_closed_by_user' || err === 'user_cancelled_authorize') return 'cancel';
    throw e;
  }
}
