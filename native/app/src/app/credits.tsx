import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { cityName } from '@/lib/content';
import { isEn, t } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';

/* حقوق الصور المجانية (Unsplash/Pexels) والبيانات — مكانها هنا بدل ما تطلع على الصور نفسها
   صور شوترستوك المشتراة ما تحتاج ذكر، وشهادات رخصها في مجلد «صور-المدن» على جهاز رامي */
const PHOTOS: [string, string, string][] = [
  ['riyadh', 'Hala AlGhanim', 'Unsplash'],
  ['alula', 'SALEH', 'Unsplash'],
  ['abha', 'Dr Muhammad Amer', 'Unsplash'],
  ['medina', 'Yasir Gürbüz', 'Pexels'],
  ['tabuk-region', 'NEOM', 'Unsplash'],
  ['makkah-region', 'Sam Riz', 'Unsplash'],
  ['umluj', isEn ? 'Red Sea Global' : 'البحر الأحمر الدولية', ''],
];

export default function Credits() {
  return (
    <Screen showBack title={t('حقوق الصور والبيانات')}>
      <View style={st.card}>
        <AppText style={{ fontFamily: font.bold, fontSize: 15 }}>{t('صور المدن')}</AppText>
        {PHOTOS.map(([c, who, site]) => (
          <View key={c} style={st.row}>
            <AppText variant="small" style={{ fontFamily: font.semibold }}>{cityName(c)}</AppText>
            <AppText variant="small" muted>{site ? t('{who} عبر {site}', { who, site }) : who}</AppText>
          </View>
        ))}
        <AppText variant="tiny" muted style={{ marginTop: 6, lineHeight: 18 }}>{t('باقي صور المدن مرخّصة من شوترستوك.')}</AppText>
      </View>
      <View style={st.card}>
        <AppText style={{ fontFamily: font.bold, fontSize: 15 }}>{t('بيانات الطقس')}</AppText>
        <AppText variant="small" muted style={{ lineHeight: 21 }}>{t('درجات الحرارة من معهد الأرصاد النرويجي MET Norway (api.met.no)، برخصة CC BY 4.0.')}</AppText>
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: brand.card, borderRadius: 20, padding: 16, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 4, borderTopWidth: 1, borderTopColor: brand.chip },
});
