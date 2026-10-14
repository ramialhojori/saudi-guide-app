import type { ComponentProps } from 'react';
import type { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand } from '@/theme/tokens';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
import { Icon, type IconName } from './Icon';

const ICON: Record<string, IconName> = { index: 'home', map: 'map', trip: 'bag', community: 'people', profile: 'user' };

/** الشريط السفلي العائم (داكن، والزر النشط برتقالي) — مثل التصميم */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[st.wrap, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
      <View style={st.bar}>
        {state.routes.map((r, i) => {
          const on = state.index === i;
          const { options } = descriptors[r.key];
          return (
            <Pressable key={r.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={options.title}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
                if (!on && !e.defaultPrevented) { navigation.navigate(r.name); Haptics.selectionAsync().catch(() => {}); }
              }}
              style={[st.item, on && st.on]}>
              <Icon name={ICON[r.name] ?? 'home'} color={on ? '#fff' : brand.inactive} size={24} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: { height: 70, borderRadius: 26, backgroundColor: brand.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    shadowColor: '#140A28', shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  item: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: brand.orange },
});
