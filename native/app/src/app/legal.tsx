import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Loading } from '@/components/State';
import { BackButton } from '@/components/ui';
import { getLegal } from '@/lib/contact';
import { useAsync } from '@/lib/useAsync';
import { brand, font } from '@/theme/tokens';
import { t } from '@/lib/i18n';

/** سياسة الخصوصية / شروط الاستخدام / قواعد المجتمع — داخل التطبيق */
export default function Legal() {
  const insets = useSafeAreaInsets();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const d = (['privacy', 'terms', 'community'] as const).find((x) => x === doc) ?? 'privacy';
  const { data, loading, error } = useAsync(() => getLegal(d), [d]);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 60, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <AppText variant="title">{data?.title ?? ''}</AppText>
          {data ? <AppText variant="tiny" muted>{t('آخر تحديث {date}', { date: data.date })}</AppText> : null}
        </View>
      </View>
      {loading && !data ? <Loading /> : null}
      {error && !data ? <AppText muted center style={{ marginTop: 40 }}>{t('ما قدرنا نفتح الصفحة، تأكد من النت.')}</AppText> : null}
      {data ? (
        <>
          <AppText style={{ lineHeight: 26, marginTop: 16 }}>{data.intro}</AppText>
          {data.sections.map(([h, items]) => (
            <View key={h} style={st.card}>
              <AppText style={{ fontFamily: font.bold, fontSize: 16 }}>{h}</AppText>
              {items.map((x) => <AppText key={x} variant="small" style={{ lineHeight: 24 }}>• {x}</AppText>)}
            </View>
          ))}
          <AppText variant="tiny" muted center style={{ marginTop: 18 }}>{t('لأي سؤال: الإعدادات ← تواصل معنا')}</AppText>
        </>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: brand.card, borderRadius: 20, padding: 16, marginTop: 12, gap: 6 },
});
