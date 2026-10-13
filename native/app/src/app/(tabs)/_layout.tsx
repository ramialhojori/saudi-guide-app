import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';

/** الشريط السفلي العائم: الرئيسية، الخريطة، رحلتي، المجتمع، ملفي */
export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'الرئيسية' }} />
      <Tabs.Screen name="map" options={{ title: 'الخريطة' }} />
      <Tabs.Screen name="trip" options={{ title: 'رحلتي' }} />
      <Tabs.Screen name="community" options={{ title: 'المجتمع' }} />
      <Tabs.Screen name="profile" options={{ title: 'ملفي' }} />
    </Tabs>
  );
}
