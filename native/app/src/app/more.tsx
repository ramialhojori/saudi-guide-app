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
import { t } from '@/lib/i18n';

type Item = { icon: IconName; label: string; color: string; on: () => void; soon?: boolean };

const ITEMS: Item[] = [
  { icon: 'star', label: t('اشترك في دليل+'), color: brand.orangeDeep, on: () => router.push('/plus') },
  { icon: 'spark', label: t('اسأل الدليل (مساعد ذكي)'), color: brand.purple, on: () => router.push('/ask-ai') },
  { icon: 'route', label: t('خطط لي رحلتي'), color: brand.orange, on: () => router.push('/planner') },
  { icon: 'news', label: t('الأخبار'), color: brand.sky, on: () => router.push('/news') },
  { icon: 'chat', label: t('اسأل أهل المدينة'), color: brand.pink, on: () => router.push('/community') },
  { icon: 'ticket', label: t('العروض والكوبونات'), color: brand.orange, on: () => router.push('/offers') },
  { icon: 'shop', label: t('عندك نشاط تجاري؟ دليل السعودية للأعمال'), color: brand.orangeDeep, on: () => router.push('/business') },
  { icon: 'share', label: t('تابعنا على إكس'), color: brand.purple, on: () => Linking.openURL('https://x.com/SAUDIA_GUIDE') },
  { icon: 'phone', label: t('تواصل معنا'), color: '#3E8E5A', on: () => router.push('/contact') },
];

export default function MoreScreen() {
  return (
    <Screen>
      <View style={styles.card}>
        {ITEMS.map((it, i) => (
          <Pressable key={it.label} onPress={it.soon ? undefined : it.on} style={[styles.row, i > 0 && styles.line]} accessibilityRole="button" disabled={it.soon}>
            <View style={[styles.ic, { backgroundColor: it.color }]}><Icon name={it.icon} color="#fff" size={18} /></View>
            <AppText style={{ flex: 1 }}>{it.label}</AppText>
            {it.soon ? <AppText variant="small" color={brand.orange}>{t('قريباً')}</AppText> : <Icon name="chevron" color={colors.textMuted} size={18} />}
          </Pressable>
        ))}
      </View>
      <AppText variant="small" muted center>{t(strings.appName)} · {t(strings.tagline)} · {t('الإصدار {v}', { v: Constants.expoConfig?.version ?? '' })}</AppText>
    </Screen>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: brand.card, borderRadius: radius.lg, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  line: { borderTopWidth: 1, borderTopColor: colors.border },
  ic: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
