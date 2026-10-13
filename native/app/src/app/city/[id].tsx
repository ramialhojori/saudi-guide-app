import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { HeartButton } from '@/components/HeartButton';
import { Icon } from '@/components/Icon';
import { Loading } from '@/components/State';
import { BackButton, Chip, ImageRow } from '@/components/ui';
import { cityKinds, getCities, getCityPlaces } from '@/lib/content';
import { useAsync } from '@/lib/useAsync';
import type { Place } from '@/lib/types';
import { brand, font, kindStyle, photos, START } from '@/theme/tokens';

const SHORT: Record<string, string> = { food: 'مطاعم', cafe: 'مقاهي', sights: 'معالم', heritage: 'تراث', nature: 'طبيعة', islamic: 'إسلامية', fun: 'ترفيه', shopping: 'تسوق' };
const TAGLINE: Record<string, string> = {
  riyadh: 'قلب المملكة، من الدرعية التاريخية إلى بوليفارد الحديث',
  jeddah: 'عروس البحر الأحمر، من البلد التاريخية إلى الكورنيش',
  medina: 'طيبة الطيبة، المسجد النبوي ومعالم السيرة',
  alula: 'متحف مفتوح بين الصخور والواحات',
};

/** دليل المدينة — مثل التصميم: صورة المدينة، أرقام سريعة، أنواع، «لا تفوّتها»، وكل الأماكن */
export default function CityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const { data: cities } = useAsync(getCities, []);
  const city = cities?.find((c) => c.id === id);
  const kinds = useMemo(() => cityKinds(id), [id]);
  const { data, loading } = useAsync(() => getCityPlaces(id, kind, q.trim() || undefined), [id, kind, q]);
  const all = data?.places ?? [];
  const featured = all.filter((p) => p.thumb).slice(0, 4);

  const header = (
    <View>
      <View style={st.hero}>
        <Image source={city?.cover || photos.riyadh} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(32,22,54,0.1)', 'rgba(32,22,54,0.92)']} style={StyleSheet.absoluteFill} />
        <View style={[st.top, { top: insets.top + 10 }]}>
          <BackButton light />
          <Pressable style={st.mapBtn} onPress={() => router.push('/map')}><Icon name="map" color={brand.ink} size={18} /><AppText style={{ fontFamily: font.semibold, fontSize: 13 }}>الخريطة</AppText></Pressable>
        </View>
        <View style={st.heroTx}>
          <AppText variant="tiny" color="#F9A158" style={{ fontFamily: font.bold }}>دليل</AppText>
          <AppText variant="hero" color="#fff" style={{ fontSize: 40, lineHeight: 52 }}>{city?.name ?? ''}</AppText>
          <AppText variant="small" color="#E2DAEE">{TAGLINE[id] ?? 'اكتشف أماكنها ومطاعمها ومعالمها'}</AppText>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {[`${city?.count ?? all.length} مكان`, '31° الحين', 'أفضل وقت: أكتوبر – مارس'].map((t) => (
              <View key={t} style={st.glassPill}><AppText variant="tiny" color="#fff">{t}</AppText></View>
            ))}
          </View>
        </View>
      </View>

      <View style={st.search}>
        <Icon name="search" color={brand.purple} size={20} />
        <TextInput value={q} onChangeText={setQ} placeholder={`ابحث في ${city?.name ?? ''}`} placeholderTextColor={brand.faint} style={st.input} />
        <AppText variant="small" style={{ fontFamily: font.semibold }}>الأقرب</AppText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 14 }}>
        <Chip label={`الكل ${city?.count ?? ''}`} on={!kind} color={brand.ink} onPress={() => setKind(undefined)} />
        {kinds.map((k) => (
          <Pressable key={k.id} onPress={() => setKind(k.id)} style={[st.kchip, { backgroundColor: kind === k.id ? kindStyle[k.id]?.fg : kindStyle[k.id]?.bg }]}>
            <AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={kind === k.id ? '#fff' : kindStyle[k.id]?.fg}>{SHORT[k.id] ?? k.name} {k.n}</AppText>
          </Pressable>
        ))}
      </ScrollView>

      {!kind && !q && featured.length >= 2 ? (
        <>
          <View style={st.secRow}><AppText variant="section">لا تفوّتها في {city?.name}</AppText><AppText variant="tiny" muted>اختيار المحررين</AppText></View>
          <View style={st.grid}>
            <Feature p={featured[0]} tall />
            <View style={{ flex: 1, gap: 10 }}>
              {featured.slice(1, 3).map((p) => <Feature key={p.id} p={p} />)}
            </View>
          </View>
        </>
      ) : null}
      <View style={st.secRow}><AppText variant="section">كل الأماكن</AppText></View>
      {loading && !data ? <Loading /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <FlatList
        data={all}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 120 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <ImageRow img={item.thumb || undefined} cat={item.cat} catColor={kindStyle[item.kinds[0]]?.fg ?? brand.purple} title={item.title}
              sub={item.summary || ''} right={<HeartButton id={item.id} />} onPress={() => router.push(`/place/${item.id}`)} />
          </View>
        )}
      />
      <Pressable style={[st.float, { bottom: Math.max(insets.bottom, 12) + 10 }]} onPress={() => router.push('/map')}>
        <Icon name="map" color="#fff" size={18} /><AppText style={{ fontFamily: font.bold, fontSize: 14 }} color="#fff">اعرضها على الخريطة</AppText>
      </Pressable>
    </View>
  );
}

function Feature({ p, tall }: { p: Place; tall?: boolean }) {
  return (
    <Pressable onPress={() => router.push(`/place/${p.id}`)} style={[st.feat, tall ? { flex: 1, height: 330 } : { height: 160 }]}>
      <Image source={p.thumb} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['transparent', 'rgba(32,22,54,0.85)']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', right: 12, left: 12, bottom: 10 }}>
        <AppText variant="tiny" color="#F9A158">{p.cat}</AppText>
        <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color="#fff" numberOfLines={1}>{p.title}</AppText>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  hero: { height: 380, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden', backgroundColor: brand.ink },
  top: { position: 'absolute', right: 16, left: 16, flexDirection: 'row', justifyContent: 'space-between' },
  mapBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 14 },
  heroTx: { position: 'absolute', right: 20, left: 20, bottom: 20 },
  glassPill: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  search: { marginHorizontal: 16, marginTop: 16, height: 54, backgroundColor: '#fff', borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, fontFamily: font.regular, fontSize: 15, color: brand.ink, textAlign: START },
  kchip: { height: 38, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  grid: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  feat: { borderRadius: 22, overflow: 'hidden', backgroundColor: brand.ink },
  float: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: brand.ink, borderRadius: 999, paddingHorizontal: 20, height: 50 },
});
