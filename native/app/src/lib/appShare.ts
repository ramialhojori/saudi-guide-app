/**
 * مشاركة التطبيق وتقييمه
 * - المشاركة: رابط موحد (/app) يودي كل جوال لمتجره، والكمبيوتر للموقع
 * - التقييم: صفحة كتابة التقييم في متجر آبل / قوقل بلاي مباشرة
 */
import { Linking, Platform, Share } from 'react-native';
import { t } from './i18n';
import { track } from './track';

const APP_STORE_ID = '1595843013';
const ANDROID_PKG = 'carizmaapps.saudiguide';

export function shareApp() {
  // روابط المتاجر مباشرة (رابط الموقع الموحد /app يشتغل بعد نقل الدومين)
  const ios = `https://apps.apple.com/app/id${APP_STORE_ID}`, android = `https://play.google.com/store/apps/details?id=${ANDROID_PKG}`;
  track('share_app');
  Share.share({
    message: t('أنصحك بتطبيق دليل السعودية: الأماكن والفعاليات والعروض في كل مدن المملكة، ومخطط رحلات ذكي.') + `\n\n${t('آيفون')}: ${ios}\n${t('أندرويد')}: ${android}`,
    url: Platform.OS === 'android' ? undefined : ios,
  }).catch(() => {});
}

export function rateApp() {
  track('rate_app');
  const url = Platform.OS === 'ios'
    ? `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`
    : Platform.OS === 'android' ? `market://details?id=${ANDROID_PKG}`
      : `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
  const web = Platform.OS === 'android' ? `https://play.google.com/store/apps/details?id=${ANDROID_PKG}` : `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`;
  Linking.openURL(url).catch(() => Linking.openURL(web).catch(() => {}));
}
