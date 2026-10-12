import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { colors, font } from '@/theme/tokens';
import { Icon, type IconName } from '@/components/Icon';
import { strings } from '@/i18n/ar';

const icon = (name: IconName) => ({ color }: { color: ColorValue }) => <Icon name={name} color={String(color)} size={23} />;

/** الشريط السفلي — نفس ترتيب قودبابر: الرئيسية، الدليل، رحلتي، فعاليات، المزيد */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopWidth: 0, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: strings.tabs.home, tabBarIcon: icon('home') }} />
      <Tabs.Screen name="guide" options={{ title: strings.tabs.guide, tabBarIcon: icon('compass') }} />
      <Tabs.Screen name="trip" options={{ title: strings.tabs.trip, tabBarIcon: icon('suitcase') }} />
      <Tabs.Screen name="events" options={{ title: strings.tabs.events, tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="more" options={{ title: strings.tabs.more, tabBarIcon: icon('menu') }} />
    </Tabs>
  );
}
