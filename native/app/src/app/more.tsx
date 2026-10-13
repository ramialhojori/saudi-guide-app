import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { brand, colors, radius, space } from '@/theme/tokens';
import { env } from '@/config/env';
import { strings } from '@/i18n/ar';

type Item = { icon: IconName; label: string; color: string; on: () => void; soon?: boolean };

const ITEMS: Item[] = [
  { icon: 'news', label: 'الأخبار', color: brand.sky, on: () => {}, soon: true },
  { icon: 'chat', label: 'اسأل أهل المدينة', color: brand.pink, on: () => {}, soon: true },
  { icon: 'ticket', label: 'العروض والكوبونات', color: brand.orange, on: () => {}, soon: true },
  { icon: 'globe', label: 'موقع دليل السعودية', color: brand.purple, on: () => WebBrowser.openBrowserAsync(env.siteUrl) },
  { icon: 'share', label: 'تابعنا على إكس', color: brand.purple, on: () => Linking.openURL('https://x.com/SAUDIA_GUIDE') },
  { icon: 'phone', label: 'تواصل معنا', color: '#3E8E5A', on: () => Linking.openURL('mailto:info@saudi-guide.com') },
];

export default function MoreScreen() {
  return (
    <Screen>
      <View style={styles.card}>
        {ITEMS.map((it, i) => (
          <Pressable key={it.label} onPress={it.soon ? undefined : it.on} style={[styles.row, i > 0 && styles.line]} accessibilityRole="button" disabled={it.soon}>
            <View style={[styles.ic, { backgroundColor: it.color }]}><Icon name={it.icon} color="#fff" size={18} /></View>
            <AppText style={{ flex: 1 }}>{it.label}</AppText>
            {it.soon ? <AppText variant="small" color={brand.orange}>قريباً</AppText> : <Icon name="chevron" color={colors.textMuted} size={18} />}
          </Pressable>
        ))}
      </View>
      <AppText variant="small" muted center>{strings.appName} · {strings.tagline} · الإصدار {Constants.expoConfig?.version}</AppText>
    </Screen>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  line: { borderTopWidth: 1, borderTopColor: colors.border },
  ic: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
