import { useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { HeartButton } from '@/components/HeartButton';
import { Icon, type IconName } from '@/components/Icon';
import { SectionTitle } from '@/components/SectionTitle';
import { Loading } from '@/components/State';
import { getHome, cityName, weekLabel } from '@/lib/content';
import { eventWhen, riyadhDate } from '@/lib/text';
import { useAsync } from '@/lib/useAsync';
import type { City, Place } from '@/lib/types';
import { brand, colors, font, radius, space } from '@/theme/tokens';
import { strings } from '@/i18n/ar';

const W = Dimensions.get('window').width;
const SLIDE_W = W - space.lg * 2;

function greeting() {
  const h = (new Date().getUTCHours() + 3) % 24;
  return h < 12 ? strings.home.greetMorning : strings.home.greetEvening;
}

const QUICK: { label: string; icon: IconName; bg: string; fg: string; go: () => void }[] = [
  { label: strings.home.near, icon: 'nav', bg: '#FDE7D3', fg: brand.orange, go: () => router.push('/search?near=1') },
  { label: strings.tabs.trip, icon: 'heart', bg: '#FBE3EA', fg: brand.pink, go: () => router.push('/trip') },
  { label: strings.tabs.events, icon: 'calendar', bg: '#ECE6F3', fg: brand.purpleDeep, go: () => router.push('/events') },
  { label: 'الأخبار', icon: 'news', bg: '#E2F1FA', fg: '#2E86B8', go: () => router.push('/more') },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading } = useAsync(getHome, []);
  const [slide, setSlide] = useState(0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 120 }}>
      {/* الترويسة: التحية + البحث */}
      <View style={[styles.hero, { paddingTop: insets.top + space.md }]}>
        <View style={styles.logoWrap}><Image source={require('../../../assets/brand/logo-white.png')} style={styles.logo} contentFit="contain" /></View>
        <AppText variant="heading" color={brand.peach}>{greeting()}</AppText>
        <AppText variant="hero" color="#fff">{strings.home.where}</AppText>
        <Pressable style={styles.search} onPress={() => router.push('/search')} accessibilityRole="search">
          <Icon name="search" color={brand.purpleDeep} />
          <AppText muted style={styles.flex}>{strings.home.search}</AppText>
          <View style={styles.badge}><AppText variant="small" color={brand.purpleDeep} style={{ fontFamily: font.semibold }}>+1500 مكان</AppText></View>
        </Pressable>
      </View>

      <View style={styles.body}>
        {/* اختصارات */}
        <View style={styles.quick}>
          {QUICK.map((q) => (
            <Pressable key={q.label} onPress={q.go} style={styles.qItem} accessibilityRole="button">
              <View style={[styles.qIcon, { backgroundColor: q.bg }]}><Icon name={q.icon} color={q.fg} size={24} /></View>
              <AppText variant="small" center>{q.label}</AppText>
            </Pressable>
          ))}
        </View>

        {loading && !data ? <Loading /> : null}

        {/* المدن: 8 + باقي الوجهات */}
        {data ? (
          <>
            <SectionTitle title={strings.home.cities} color={brand.pink} action={strings.common.seeAll} onAction={() => router.push('/guide')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cities}>
              {data.cities.slice(0, 8).map((c) => <CityCircle key={c.id} city={c} />)}
              <Pressable onPress={() => router.push('/guide')} style={styles.city}>
                <View style={[styles.ring, styles.moreRing]}><AppText variant="title" color={brand.purpleDeep}>+{data.cities.length - 8}</AppText></View>
                <AppText variant="small" center>{strings.home.more}</AppText>
              </Pressable>
            </ScrollView>

            {/* مختارات الأسبوع */}
            {data.picks.length ? (
              <View>
                <FlatList
                  data={data.picks}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(p) => String(p.id)}
                  onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / SLIDE_W))}
                  renderItem={({ item }) => <PickSlide place={item} />}
                  style={styles.slides}
                />
                <View style={styles.dots}>
                  {data.picks.map((p, i) => <View key={p.id} style={[styles.dot, i === slide && styles.dotOn]} />)}
                </View>
              </View>
            ) : null}

            {/* فعاليات */}
            {data.events.length ? (
              <>
                <SectionTitle title={strings.home.events} color={brand.purple} action={strings.common.seeAll} onAction={() => router.push('/events')} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                  {data.events.map((e) => (
                    <Pressable key={e.id} style={styles.ev} onPress={() => router.push(`/event/${e.id}`)}>
                      <Image source={e.thumb} style={styles.evImg} contentFit="cover" />
                      <View style={styles.evTx}>
                        <AppText variant="small" color={brand.orange}>{eventWhen(e.start, e.end)}{e.city ? ' · ' + cityName(e.city) : ''}</AppText>
                        <AppText variant="heading" numberOfLines={2}>{e.title}</AppText>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            {/* أخبار */}
            {data.articles.length ? (
              <>
                <SectionTitle title={strings.home.news} color={brand.sky} />
                {data.articles.slice(0, 5).map((a) => (
                  <Pressable key={a.id} style={styles.news} onPress={() => router.push(`/article/${a.id}`)}>
                    <Image source={a.thumb} style={styles.newsImg} contentFit="cover" />
                    <View style={styles.flex}>
                      <AppText variant="heading" numberOfLines={2}>{a.title}</AppText>
                      <AppText variant="small" muted>{riyadhDate(a.date, false)} · {a.author || a.section}</AppText>
                    </View>
                  </Pressable>
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function CityCircle({ city }: { city: City }) {
  return (
    <Pressable onPress={() => router.push(`/city/${city.id}`)} style={styles.city} accessibilityRole="link">
      <View style={[styles.ring, { borderColor: city.color }]}>
        {city.cover ? <Image source={city.cover} style={styles.cityImg} contentFit="cover" /> : <View style={[styles.cityImg, { backgroundColor: city.color }]} />}
      </View>
      <AppText variant="small" center numberOfLines={1}>{city.name}</AppText>
    </Pressable>
  );
}

function PickSlide({ place }: { place: Place }) {
  return (
    <Pressable onPress={() => router.push(`/place/${place.id}`)} style={styles.slide}>
      <Image source={place.image || place.thumb} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      <View style={styles.shade} />
      <View style={styles.slideTop}>
        <View style={styles.label}><AppText variant="small" color="#fff" style={{ fontFamily: font.semibold }}>{strings.home.picks} · {weekLabel()}</AppText></View>
        <HeartButton id={place.id} light />
      </View>
      <View style={styles.cap}>
        <AppText variant="small" color={brand.peach}>{cityName(place.city)} · {place.cat}</AppText>
        <AppText variant="title" color="#fff" numberOfLines={2}>{place.title}</AppText>
        <AppText variant="small" color="#EDE8F3" numberOfLines={2}>{place.summary}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  hero: { backgroundColor: colors.header, paddingHorizontal: space.lg, paddingBottom: space.xl, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, gap: 2 },
  logoWrap: { alignItems: 'center', marginBottom: space.md },
  logo: { height: 32, width: 140 },
  search: { marginTop: space.md, backgroundColor: '#fff', borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 54 },
  badge: { backgroundColor: '#F1ECF6', borderRadius: radius.md, paddingHorizontal: space.sm, paddingVertical: 4 },
  body: { padding: space.lg, gap: space.md },
  quick: { flexDirection: 'row', justifyContent: 'space-between' },
  qItem: { alignItems: 'center', gap: 6, width: (W - space.lg * 2) / 4 },
  qIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cities: { gap: space.md, paddingVertical: space.sm },
  city: { width: 76, alignItems: 'center', gap: 6 },
  ring: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, padding: 3, alignItems: 'center', justifyContent: 'center' },
  moreRing: { borderColor: brand.lilac, backgroundColor: '#F1ECF6' },
  cityImg: { width: '100%', height: '100%', borderRadius: 36 },
  slides: { marginTop: space.sm },
  slide: { width: SLIDE_W, height: 330, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: brand.purpleDeep },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(30,20,50,0.35)' },
  slideTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md },
  label: { backgroundColor: brand.orange, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5 },
  cap: { position: 'absolute', right: 0, left: 0, bottom: 0, padding: space.lg, gap: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: brand.lilacSoft },
  dotOn: { width: 20, backgroundColor: brand.purpleDeep },
  ev: { width: 230, backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden' },
  evImg: { width: '100%', height: 120, backgroundColor: '#E8E3EE' },
  evTx: { padding: space.md, gap: 2 },
  news: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.lg, padding: space.sm },
  newsImg: { width: 86, height: 70, borderRadius: radius.md, backgroundColor: '#E8E3EE' },
});
