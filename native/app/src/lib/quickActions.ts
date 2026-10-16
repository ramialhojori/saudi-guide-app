/**
 * اختصارات أيقونة التطبيق: ضغطة مطولة على الأيقونة تطلع «العروض» و«أخباري» و«خطط رحلة» و«ابحث»
 * - المكتبة اختيارية: لو النسخة المثبتة ما فيها (بناء قديم) أو على الويب، ما يصير شي
 * - الأيقونات: رموز آبل (SF Symbols) على الآيفون، والأندرويد بدون أيقونات
 */
import { Platform } from 'react-native';
import { setItems } from 'expo-quick-actions';
import { t } from './i18n';

export function setupQuickActions() {
  if (Platform.OS === 'web') return;
  const ios = Platform.OS === 'ios';
  setItems([
    { id: 'offers', title: t('العروض والكوبونات'), icon: ios ? 'symbol:ticket' : null, params: { href: '/offers' } },
    { id: 'news', title: t('أخباري'), icon: ios ? 'symbol:newspaper' : null, params: { href: '/news?tab=mine' } },
    { id: 'plan', title: t('خطط لي رحلة'), icon: ios ? 'symbol:map' : null, params: { href: '/planner' } },
    { id: 'search', title: t('ابحث عن مكان'), icon: ios ? 'symbol:magnifyingglass' : null, params: { href: '/search' } },
  ]).catch(() => {});
}
