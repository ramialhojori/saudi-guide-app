import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { openBooking, useAffiliate, type BookCtx, type BookKind } from '@/lib/affiliate';
import { t } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';

const META: Record<BookKind, { label: string; icon: 'home' | 'globe' | 'ticket' | 'nav'; color: string }> = {
  hotels: { label: 'فنادق قريبة', icon: 'home', color: brand.purple },
  flights: { label: 'احجز طيرانك', icon: 'globe', color: brand.skyDeep },
  tours: { label: 'جولات وتذاكر', icon: 'ticket', color: brand.orangeDeep },
  cars: { label: 'استأجر سيارة', icon: 'nav', color: brand.green },
};

/** «خطط لحجزك»: أزرار تفتح مواقع الحجز الشريكة (تختفي لو الحجز مقفل من اللوحة) */
export function BookStrip({ kinds = ['hotels', 'flights', 'tours', 'cars'], title, style, ...ctx }: BookCtx & { kinds?: BookKind[]; title?: string; style?: object }) {
  const links = useAffiliate();
  const ks = kinds.filter((k) => links[k]);
  if (!ks.length) return null;
  return (
    <View style={[{ marginTop: 18 }, style]}>
      <AppText variant="section" style={{ paddingHorizontal: 16, marginBottom: 8 }}>{title || t('احجز رحلتك')}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {ks.map((k) => (
          <Pressable key={k} style={st.btn} onPress={() => openBooking(k, links[k]!, ctx)} accessibilityRole="link">
            <View style={[st.ic, { backgroundColor: META[k].color }]}><Icon name={META[k].icon} color="#fff" size={16} /></View>
            <AppText style={{ fontFamily: font.bold, fontSize: 14 }}>{t(META[k].label)}</AppText>
          </Pressable>
        ))}
      </ScrollView>
      <AppText variant="tiny" muted style={{ paddingHorizontal: 16, marginTop: 6 }}>{t('الحجز يتم في موقع الشريك، وقد نحصل على عمولة بدون أي تكلفة إضافية عليك.')}</AppText>
    </View>
  );
}

const st = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 12, paddingEnd: 16, borderRadius: 16, backgroundColor: brand.card },
  ic: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
