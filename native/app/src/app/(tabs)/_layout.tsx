import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';

/** الشريط السفلي العائم: الرئيسية، استكشف، الفعاليات، رحلتي، المجتمع — و«ملفي» من الصورة فوق */
export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'الرئيسية' }} />
      <Tabs.Screen name="explore" options={{ title: 'استكشف' }} />
      <Tabs.Screen name="events" options={{ title: 'الفعاليات' }} />
      <Tabs.Screen name="trip" options={{ title: 'رحلتي' }} />
      <Tabs.Screen name="community" options={{ title: 'المجتمع' }} />
      <Tabs.Screen name="profile" options={{ title: 'ملفي', href: null }} />
    </Tabs>
  );
}
