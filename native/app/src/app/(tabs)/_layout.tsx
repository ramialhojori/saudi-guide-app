import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { setupQuickActions } from '@/lib/quickActions';
import { TabBar } from '@/components/TabBar';
import { t } from '@/lib/i18n';

/** الشريط السفلي العائم: الرئيسية، استكشف، الفعاليات، رحلتي، المجتمع — و«ملفي» من الصورة فوق */
export default function TabsLayout() {
  // اختصارات أيقونة التطبيق (الضغطة المطولة): ننشئها مرة، ونفتح الصفحة لما ينضغط واحد منها
  useQuickActionRouting();
  useEffect(() => { setupQuickActions(); }, []);
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t('الرئيسية') }} />
      <Tabs.Screen name="explore" options={{ title: t('استكشف') }} />
      <Tabs.Screen name="events" options={{ title: t('الفعاليات') }} />
      <Tabs.Screen name="trip" options={{ title: t('رحلتي') }} />
      <Tabs.Screen name="community" options={{ title: t('المجتمع') }} />
      <Tabs.Screen name="profile" options={{ title: t('ملفي'), href: null }} />
    </Tabs>
  );
}
