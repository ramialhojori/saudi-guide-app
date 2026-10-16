import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { cityName } from '@/lib/content';
import { t } from '@/lib/i18n';
import { getReadyTrips, tripTitle } from '@/lib/readyTrips';
import { useAsync } from '@/lib/useAsync';
import { brand, font } from '@/theme/tokens';

/** شريط «رحلات جاهزة» (صفحة المدينة والرئيسية ورحلتي الفاضية). يختفي لو ما فيه رحلات منشورة */
export function ReadyTripsStrip({ city, title }: { city?: string; title?: string }) {
  const { data } = useAsync(() => getReadyTrips(city).catch(() => []), [city]);
  if (!data?.length) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <View style={st.head}>
        <Icon name="route" color={brand.orange} size={18} />
        <AppText style={{ fontFamily: font.bold, fontSize: 18, flex: 1 }}>{title || t('رحلات جاهزة')}</AppText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
        {data.map((x) => (
          <Pressable key={x.id} style={st.card} onPress={() => router.push(`/trips/${x.id}`)}>
            <Image source={x.cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            <LinearGradient colors={['transparent', 'rgba(32,22,54,0.9)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
            <View style={st.badge}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{x.dayCount === 1 ? t('يوم واحد') : t('{n} أيام', { n: x.dayCount })}</AppText></View>
            <View style={{ position: 'absolute', bottom: 12, right: 12, left: 12 }}>
              {!city ? <AppText variant="tiny" color="#F9A158" style={{ fontFamily: font.bold }}>{cityName(x.city)}</AppText> : null}
              <AppText style={{ fontFamily: font.bold, fontSize: 16, lineHeight: 24 }} color="#fff" numberOfLines={2}>{tripTitle(x)}</AppText>
              <AppText variant="tiny" color="#E2DAEE">{t('{n} أماكن', { n: x.placeCount })}</AppText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  card: { width: 210, height: 230, borderRadius: 22, overflow: 'hidden', backgroundColor: brand.chip },
  badge: { position: 'absolute', top: 10, left: 10, backgroundColor: brand.orange, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
});
