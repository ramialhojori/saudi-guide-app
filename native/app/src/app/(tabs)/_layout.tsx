import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { t } from '@/lib/i18n';

/** الشريط السفلي العائم: الرئيسية، استكشف، الفعاليات، رحلتي، المجتمع — و«ملفي» من الصورة فوق */
export default function TabsLayout() {
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
