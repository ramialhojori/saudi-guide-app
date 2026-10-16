import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { setList } from '@/lib/browse';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { HeartButton } from '@/components/HeartButton';
import { Icon } from '@/components/Icon';
import { Loading } from '@/components/State';
import { OfflineCard } from '@/components/OfflineCard';
import { BackButton, Chip, ImageRow } from '@/components/ui';
import { cityKinds, getCities, getCityPlaces, getWeather } from '@/lib/content';
import { useAsync } from '@/lib/useAsync';
import type { Place } from '@/lib/types';
import { brand, font, kindStyle, photos, START, INPUT_START } from '@/theme/tokens';
import { track } from '@/lib/track';
import { useFeatures } from '@/lib/features';
import { isEn, t, tr } from '@/lib/i18n';

const SHORT: Record<string, string> = isEn
  ? { food: 'Restaurants', cafe: 'Cafes', sights: 'Sights', heritage: 'Heritage', nature: 'Nature', islamic: 'Islamic', fun: 'Fun', shopping: 'Shopping' }
  : { food: 'مطاعم', cafe: 'مقاهي', sights: 'معالم', heritage: 'تراث', nature: 'طبيعة', islamic: 'إسلامية', fun: 'ترفيه', shopping: 'تسوق' };
const TAGLINE: Record<string, string> = {
  riyadh: 'قلب المملكة، من الدرعية التاريخية إلى بوليفارد الحديث',
  jeddah: 'عروس البحر الأحمر، من البلد التاريخية إلى الكورنيش',
  medina: 'طيبة الطيبة، المسجد النبوي ومعالم السيرة',
  alula: 'متحف مفتوح بين الصخور والواحات',
};
const TAGLINE_EN: Record<string, string> = {
  riyadh: 'Heart of the Kingdom, from historic Diriyah to the modern Boulevard',
  jeddah: 'Bride of the Red Sea, from historic Al-Balad to the Corniche',
  medina: 'Taiba the Good: the Prophet\'s Mosque and landmarks of the Seerah',
  alula: 'An open-air museum among rocks and oases',
};

/* أفضل وقت لزيارة كل مدينة (حسب الجو والمواسم): المرتفعات (أبها، عسير، الطائف، الباحة) صيفاً، والباقي من الخريف للربيع
   المصادر: زوروا السعودية، Experiences by Roam، WeatherSpark، Champion Traveler (أكتوبر 2026) */
const BEST: Record<string, [string, string]> = {
  medina: ['نوفمبر – مارس', 'Nov – Mar'], 'makkah-region': ['نوفمبر – فبراير', 'Nov – Feb'], riyadh: ['أكتوبر – مارس', 'Oct – Mar'],
  'riyadh-region': ['أكتوبر – مارس', 'Oct – Mar'], diriyah: ['أكتوبر – مارس', 'Oct – Mar'], jeddah: ['نوفمبر – مارس', 'Nov – Mar'],
  alula: ['أكتوبر – مارس', 'Oct – Mar'], 'tabuk-region': ['أكتوبر – أبريل', 'Oct – Apr'], umluj: ['أكتوبر – أبريل', 'Oct – Apr'],
  yanbu: ['أكتوبر – أبريل', 'Oct – Apr'], hail: ['نوفمبر – مارس', 'Nov – Mar'], 'qassim-region': ['نوفمبر – مارس', 'Nov – Mar'],
  'aljawf-region': ['أكتوبر – أبريل', 'Oct – Apr'], 'northern-border': ['أكتوبر – أبريل', 'Oct – Apr'], 'eastern-region': ['نوفمبر – مارس', 'Nov – Mar'],
  abha: ['يونيو – سبتمبر', 'Jun – Sep'], 'asir-region': ['يونيو – سبتمبر', 'Jun – Sep'], taif: ['أبريل – سبتمبر', 'Apr – Sep'],
  albaha: ['يونيو – سبتمبر', 'Jun – Sep'], jizan: ['ديسمبر – مارس', 'Dec – Mar'], najran: ['أكتوبر – مارس', 'Oct – Mar'],
};
/** دليل المدينة — مثل التصميم: صورة المدينة، أرقام سريعة، أنواع، «لا تفوّتها»، وكل الأماكن */
export default function CityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => { if (id) track('city', id); }, [id]);
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const { data: cities } = useAsync(getCities, []);
  const { data: temp } = useAsync(() => getWeather(id), [id]);
  const city = cities?.find((c) => c.id === id);
  const kinds = useMemo(() => cityKinds(id), [id]);
  const { data, loading } = useAsync(() => getCityPlaces(id, kind, q.trim() || undefined), [id, kind, q]);
  const all = data?.places ?? [];
  const featured = all.filter((p) => p.thumb).slice(0, 4);

  const F = useFeatures();
  const addCard = F.suggest ? (
    <Pressable style={st.addCard} onPress={() => router.push({ pathname: '/suggest', params: { city: id } })}>
      <View style={st.addIcon}><Icon name="plus" color="#fff" size={20} /></View>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontFamily: font.bold }}>{t('تعرف مكان في {city} ما هو هنا؟', { city: city?.name ?? tr('المدينة', 'the city') })}</AppText>
        <AppText variant="small" muted>{t('أضفه مع صوره، وينضاف للدليل باسمك (+15 نقطة)')}</AppText>
      </View>
    </Pressable>
  ) : null;
  const header = (
    <View>
      <View style={st.hero}>
        <Image source={city?.cover || photos.riyadh} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(32,22,54,0.1)', 'rgba(32,22,54,0.92)']} style={StyleSheet.absoluteFill} />
        <View style={[st.top, { top: insets.top + 10 }]}>
          <BackButton light />
          <Pressable style={st.mapBtn} onPress={() => router.push('/map')}><Icon name="map" color={MAP_INK} size={18} /><AppText color={MAP_INK} style={{ fontFamily: font.semibold, fontSize: 13 }}>{t('الخريطة')}</AppText></Pressable>
        </View>
        <View style={st.heroTx}>
          <AppText variant="tiny" color="#F9A158" style={{ fontFamily: font.bold }}>{t('دليل')}</AppText>
          <AppText variant="hero" color="#fff" style={{ fontSize: 40, lineHeight: 52 }}>{city?.name ?? ''}</AppText>
          <AppText variant="small" color="#E2DAEE">{(isEn ? TAGLINE_EN[id] : TAGLINE[id]) ?? t('اكتشف أماكنها ومطاعمها ومعالمها')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {[t('{n} مكان', { n: city?.count ?? all.length }), temp != null ? t('{n}° الحين', { n: temp }) : '', BEST[id] ? t('أفضل وقت: {m}', { m: BEST[id][isEn ? 1 : 0] }) : ''].filter(Boolean).map((s) => (
              <View key={s} style={st.glassPill}><AppText variant="tiny" color="#fff">{s}</AppText></View>
            ))}
          </View>
        </View>
      </View>

      <View style={st.search}>
        <Icon name="search" color={brand.purple} size={20} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('ابحث في {city}', { city: city?.name ?? '' })} placeholderTextColor={brand.faint} style={st.input} />
        <AppText variant="small" style={{ fontFamily: font.semibold }}>{t('الأقرب')}</AppText>
      </View>

      {!q ? <OfflineCard city={id} name={city?.name ?? ''} /> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 14 }}>
        <Chip label={`${t('الكل')} ${city?.count ?? ''}`} on={!kind} color={brand.ink} onPress={() => setKind(undefined)} />
        {kinds.map((k) => (
          <Pressable key={k.id} onPress={() => setKind(k.id)} style={[st.kchip, { backgroundColor: kind === k.id ? kindStyle[k.id]?.fg : kindStyle[k.id]?.bg }]}>
            <AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={kind === k.id ? '#fff' : kindStyle[k.id]?.fg}>{SHORT[k.id] ?? k.name} {k.n}</AppText>
          </Pressable>
        ))}
      </ScrollView>

      {!kind && !q && featured.length >= 2 ? (
        <>
          <View style={st.secRow}><AppText variant="section">{t('لا تفوّتها في {city}', { city: city?.name ?? '' })}</AppText><AppText variant="tiny" muted>{t('اختيار المحررين')}</AppText></View>
          <View style={st.grid}>
            <Feature p={featured[0]} tall />
            <View style={{ flex: 1, gap: 10 }}>
              {featured.slice(1, 3).map((p) => <Feature key={p.id} p={p} />)}
            </View>
          </View>
        </>
      ) : null}
      <View style={st.secRow}><AppText variant="section">{t('كل الأماكن')}</AppText></View>
      {loading && !data ? <Loading /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <FlatList
        data={all}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        ListFooterComponent={addCard}
        contentContainerStyle={{ paddingBottom: 120 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <ImageRow img={item.thumb || undefined} cat={item.cat} catColor={kindStyle[item.kinds[0]]?.fg ?? brand.purple} title={item.title}
              sub={item.summary || ''} right={<HeartButton id={item.id} />} onPress={() => { setList('place', all.map((x) => x.id)); router.push(`/place/${item.id}`); }} />
          </View>
        )}
      />
      <Pressable style={[st.float, { bottom: Math.max(insets.bottom, 12) + 10 }]} onPress={() => router.push('/map')}>
        <Icon name="map" color="#fff" size={18} /><AppText style={{ fontFamily: font.bold, fontSize: 14 }} color="#fff">{t('اعرضها على الخريطة')}</AppText>
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

/** زر الخريطة أبيض دايماً، فنصّه غامق ثابت (لون النص العام يصير فاتح في الوضع الليلي) */
const MAP_INK = '#2B2745';

/** نسبة صورة الغلاف لأصحابها: الصور الصحفية والمجانية (صور شوترستوك المشتراة ما تحتاج) */
const st = StyleSheet.create({
  addCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 16, padding: 14, borderRadius: 20, backgroundColor: brand.card, borderWidth: 1.5, borderColor: brand.orange, borderStyle: 'dashed' },
  addIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 380, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden', backgroundColor: brand.ink },
  top: { position: 'absolute', right: 16, left: 16, flexDirection: 'row', justifyContent: 'space-between' },
  mapBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 14 },
  heroTx: { position: 'absolute', right: 20, left: 20, bottom: 20 },
  glassPill: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  search: { marginHorizontal: 16, marginTop: 16, height: 54, backgroundColor: brand.card, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, minWidth: 0, fontFamily: font.regular, fontSize: 15, color: brand.text, textAlign: INPUT_START },
  kchip: { height: 38, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  grid: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  feat: { borderRadius: 22, overflow: 'hidden', backgroundColor: brand.ink },
  float: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: brand.ink, borderRadius: 999, paddingHorizontal: 20, height: 50 },
});
