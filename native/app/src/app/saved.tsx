import { useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { HeartButton } from '@/components/HeartButton';
import { Empty } from '@/components/State';
import { BackButton, Chip, ImageRow } from '@/components/ui';
import { cityName, getPlacesByIds } from '@/lib/content';
import { useTrip } from '@/lib/trip';
import { useAsync } from '@/lib/useAsync';
import { brand, font, kindStyle } from '@/theme/tokens';
import { t } from '@/lib/i18n';

/** محفوظاتي: الأماكن المحفوظة مجمعة حسب المدينة */
export default function Saved() {
  const insets = useSafeAreaInsets();
  const { ids } = useTrip();
  const { data } = useAsync(() => getPlacesByIds(ids), [ids.join(',')]);
  const [tab, setTab] = useState(0);
  const places = data ?? [];
  const byCity = new Map<string, typeof places>();
  for (const p of places) byCity.set(p.city, [...(byCity.get(p.city) ?? []), p]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 60 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
        <BackButton />
        <View><AppText variant="title">{t('محفوظاتي')}</AppText><AppText variant="small" muted>{t('{n} عنصر', { n: places.length })}</AppText></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16, paddingBottom: 4 }}>
        {[`${t('أماكن')} ${places.length}`, t('كوبونات'), t('فعاليات'), t('أدلة')].map((x, i) => <Chip key={x} label={x} on={tab === i} onPress={() => setTab(i)} />)}
      </ScrollView>
      {tab > 0 ? <Empty title={t('قريباً')} sub={t('حفظ الكوبونات والفعاليات والأدلة يتفعل مع تسجيل الدخول')} /> : !places.length ? (
        <Empty title={t('ما حفظت شي للحين')} sub={t('اضغط القلب على أي مكان يعجبك')} action={t('تصفح الدليل')} onAction={() => router.push('/guide')} />
      ) : (
        <>
          <AppText variant="section" style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 }}>{t('قوائمي')}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
            {[...byCity.entries()].map(([c, list]) => (
              <Pressable key={c} style={{ width: 150 }} onPress={() => router.push(`/city/${c}`)}>
                <View style={st.collage}>
                  {list.slice(0, 2).map((p) => <Image key={p.id} source={p.thumb} style={{ flex: 1, height: 110 }} contentFit="cover" />)}
                </View>
                <AppText style={{ fontFamily: font.bold, fontSize: 14, marginTop: 6 }}>{cityName(c)}</AppText>
                <AppText variant="tiny" muted>{t('{n} أماكن', { n: list.length })}</AppText>
              </Pressable>
            ))}
          </ScrollView>
          <AppText variant="section" style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 }}>{t('المحفوظ مؤخراً')}</AppText>
          <View style={{ gap: 10, paddingHorizontal: 16 }}>
            {[...places].reverse().map((p) => (
              <ImageRow key={p.id} img={p.thumb || undefined} cat={`${p.cat} · ${cityName(p.city)}`} catColor={kindStyle[p.kinds[0]]?.fg ?? brand.purple}
                title={p.title} sub={p.summary} right={<HeartButton id={p.id} />} onPress={() => router.push(`/place/${p.id}`)} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({ collage: { flexDirection: 'row', gap: 2, height: 110, borderRadius: 18, overflow: 'hidden', backgroundColor: brand.chip } });
