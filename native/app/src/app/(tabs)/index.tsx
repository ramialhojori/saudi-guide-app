import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { HeartButton } from '@/components/HeartButton';
import { Icon, type IconName } from '@/components/Icon';
import { BellButton } from '@/components/BellButton';
import { Avatar, Section } from '@/components/ui';
import { getHome, nearby, cityName, weekLabel } from '@/lib/content';
import { useWeather } from '@/lib/weather';
import { useAuth } from '@/lib/auth';
import { initial, tint } from '@/lib/community';
import { riyadhDate } from '@/lib/text';
import { useAsync } from '@/lib/useAsync';
import { CouponCard } from '@/components/CouponCard';
import { cityCoupons } from '@/lib/coupons';
import { useFeatures } from '@/lib/features';
import type { EventItem, Place } from '@/lib/types';
import { t, tr } from '@/lib/i18n';
import { brand, font, kindStyle, photos } from '@/theme/tokens';

const W = Dimensions.get('window').width;
const CARD_W = Math.min(300, W - 90);
const MADINAH = { lat: 24.4672, lng: 39.6112 };

const KINDS: { id: string; label: string; icon: IconName }[] = [
  { id: 'sights', label: t('معالم'), icon: 'sights' },
  { id: 'heritage', label: t('تراث'), icon: 'heritage' },
  { id: 'nature', label: t('طبيعة'), icon: 'nature' },
  { id: 'food', label: t('مطاعم'), icon: 'food' },
  { id: 'cafe', label: t('مقاهي'), icon: 'cafe' },
];

const greeting = () => ((new Date().getUTCHours() + 3) % 24 < 12 ? t('صباح الخير') : t('مساء الخير'));

export default function Home() {
  const insets = useSafeAreaInsets();
  const { data } = useAsync(getHome, []);
  const { user } = useAuth();
  const first = (user?.name || '').trim().split(/\s+/)[0];
  const near = useNearby();
  const weather = useWeather(user?.city);
  const feat = useFeatures();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
      {/* الترويسة بالصورة */}
      <View style={st.hero}>
        <Image source={photos.rock} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(43,31,69,0.2)', 'rgba(43,31,69,0.35)', 'rgba(43,31,69,0.92)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <View style={[st.top, { top: insets.top + 10 }]}>
          <Image source={require('../../../assets/brand/logo-white.png')} style={{ width: 150, height: 44 }} contentFit="contain" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <BellButton style={st.glass} />
            <Pressable accessibilityLabel={t('ملفي')} onPress={() => router.push('/profile')} style={st.avRing}><Avatar t={user ? initial(user.name || tr('؟', '?')) : tr('د', 'S')} c={user ? tint(user.id) : brand.lilac} size={44} /></Pressable>
          </View>
        </View>
        <View style={st.heroTx}>
          {weather ? <View style={st.weather}><AppText variant="small" color="#fff">{weather.city} · {weather.temp}°{weather.text ? ` · ${weather.text}` : ''}</AppText></View> : null}
          <AppText style={{ fontFamily: font.semibold, fontSize: 17 }} color="#F9A158">{greeting()}{first ? tr(` يا ${first}`, `, ${first}`) : ''}</AppText>
          <AppText variant="hero" color="#fff" style={{ fontSize: 34, lineHeight: 46 }}>{t('وين تبي تروح\nهالويكند؟')}</AppText>
          <Pressable onPress={() => router.push('/search')} style={st.search} accessibilityRole="search">
            <Icon name="search" color={brand.purple} size={22} strokeWidth={2.2} />
            <AppText muted style={{ flex: 1 }}>{t('مكان، مدينة، مطعم، فعالية...')}</AppText>
            <View style={st.count}><AppText style={{ fontFamily: font.bold, fontSize: 12.5 }} color={brand.purple}>1500+</AppText></View>
          </Pressable>
        </View>
      </View>

      {/* أنواع الأماكن */}
      <View style={st.kinds}>
        {KINDS.map((k) => {
          const ks = kindStyle[k.id];
          return (
            <Pressable key={k.id} onPress={() => router.push({ pathname: '/search', params: { kind: k.id } })} style={{ alignItems: 'center', gap: 8 }}>
              <View style={[st.kind, { backgroundColor: ks.bg }]}><Icon name={k.icon} color={ks.fg} size={26} /></View>
              <AppText variant="small" center>{k.label}</AppText>
            </Pressable>
          );
        })}
      </View>

      {/* دليل+ الذكي */}
      {feat.ai_chat || feat.ai_planner ? (
        <View style={st.aiRow}>
          {feat.ai_chat ? (
            <Pressable style={[st.aiCard, { backgroundColor: brand.purple }]} onPress={() => router.push('/ask-ai')}>
              <Icon name="spark" color="#fff" size={22} />
              <AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 15 }}>{t('اسأل الدليل')}</AppText>
              <AppText variant="tiny" color="#E9E0FF">{t('مساعدك الذكي يجاوبك فوراً')}</AppText>
            </Pressable>
          ) : null}
          {feat.ai_planner ? (
            <Pressable style={[st.aiCard, { backgroundColor: brand.orange }]} onPress={() => router.push('/planner')}>
              <Icon name="route" color="#fff" size={22} />
              <AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 15 }}>{t('خطط لي رحلتي')}</AppText>
              <AppText variant="tiny" color="#FFF1E4">{t('خطة يوم بيوم بذكاء')}</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* مختارات الأسبوع */}
      <View style={st.secHead}>
        <View>
          <AppText variant="title">{t('مختارات الأسبوع')}</AppText>
          <AppText variant="small" muted>{weekLabel()} · {t('تتجدد كل أحد')}</AppText>
        </View>
        <Pressable onPress={() => router.push('/guide')}><AppText style={{ fontFamily: font.semibold, fontSize: 13.5 }} color={brand.purple}>{t('الكل')}</AppText></Pressable>
      </View>
      <FlatList
        data={data?.picks ?? []}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
        snapToInterval={CARD_W + 14}
        decelerationRate="fast"
        renderItem={({ item, index }) => <PickCard place={item} star={index === 0} />}
        ListEmptyComponent={<View style={[st.pick, { backgroundColor: '#EEE9F2' }]} />}
      />

      {/* قريب منك */}
      <Section title={t('قريب منك الحين')} action={t('على الخريطة')} onAction={() => router.push('/map')} />
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {near.slice(0, 3).map((p) => <NearRow key={p.id} p={p} />)}
      </View>

      {/* فعالية قادمة */}
      {data?.events?.[0] ? <EventBanner e={data.events[0]} /> : null}

      {/* عروض المدينة من التجار */}
      <CityDeals city={user?.city || 'medina'} />

      {/* وجهات المملكة */}
      {data?.cities?.length ? (
        <>
          <Section title={t('وجهات المملكة')} action={t('الدليل')} onAction={() => router.push('/guide')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }}>
            {data.cities.slice(0, 10).map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/city/${c.id}`)} style={{ alignItems: 'center', width: 76 }}>
                <View style={[st.cityRing, { borderColor: c.color }]}><Image source={c.cover} style={st.cityImg} contentFit="cover" /></View>
                <AppText variant="tiny" center numberOfLines={1} style={{ fontFamily: font.semibold, marginTop: 6 }}>{c.name}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {/* فعاليات أكثر */}
      {(data?.events?.length ?? 0) > 1 ? (
        <>
          <Section title={t('فعاليات قادمة')} action={t('الكل')} onAction={() => router.push('/events')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
            {data!.events.slice(1, 8).map((e) => (
              <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)} style={st.evCard}>
                <Image source={e.thumb || e.image || photos.fest} style={{ width: '100%', height: 120 }} contentFit="cover" />
                <View style={{ padding: 10 }}>
                  <AppText variant="tiny" color={brand.pinkDeep} style={{ fontFamily: font.semibold }}>{riyadhDate(e.start, false)}</AppText>
                  <AppText style={{ fontFamily: font.bold, fontSize: 14, lineHeight: 21 }} numberOfLines={2}>{e.title}</AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {/* آخر الأخبار */}
      {data?.articles?.length ? (
        <>
          <Section title={t('آخر الأخبار')} action={t('كل الأخبار')} onAction={() => router.push('/news')} />
          <View style={{ gap: 10, paddingHorizontal: 16 }}>
            {data.articles.slice(0, 3).map((a) => (
              <Pressable key={a.id} onPress={() => router.push(`/article/${a.id}`)} style={st.near}>
                <Image source={a.thumb} style={st.nearImg} contentFit="cover" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText style={{ fontFamily: font.bold, fontSize: 15, lineHeight: 23 }} numberOfLines={2}>{a.title}</AppText>
                  <AppText variant="small" muted>{riyadhDate(a.date, false)}</AppText>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function useNearby() {
  const [list, setList] = useState<Place[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      let at = MADINAH;
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted) {
          const pos = await Location.getLastKnownPositionAsync();
          if (pos) at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        }
      } catch {}
      const r = await nearby(at.lat, at.lng, 25).catch(() => []);
      if (alive) setList(r.filter((p) => p.thumb));
    })();
    return () => { alive = false; };
  }, []);
  return list;
}

function PickCard({ place, star }: { place: Place; star?: boolean }) {
  return (
    <Pressable onPress={() => router.push(`/place/${place.id}`)} style={st.pick}>
      <Image source={place.image || place.thumb || photos.heritage} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      <LinearGradient colors={['transparent', 'rgba(32,22,54,0.92)']} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={st.pickTop}>
        {star ? <View style={st.starTag}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#fff">{t('معلم الأسبوع')}</AppText></View> : <View />}
        <HeartButton id={place.id} size={46} light />
      </View>
      <View style={st.pickTx}>
        <AppText style={{ fontFamily: font.semibold, fontSize: 13.5 }} color="#F9A158">{cityName(place.city)} · {place.cat}</AppText>
        <AppText style={{ fontFamily: font.bold, fontSize: 26, lineHeight: 36 }} color="#fff" numberOfLines={1}>{place.title}</AppText>
        {place.summary ? <AppText variant="small" color="#E2DAEE" numberOfLines={1}>{place.summary}</AppText> : null}
      </View>
    </Pressable>
  );
}

function NearRow({ p }: { p: Place }) {
  return (
    <Pressable onPress={() => router.push(`/place/${p.id}`)} style={st.near}>
      <Image source={p.thumb} style={st.nearImg} contentFit="cover" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText style={{ fontFamily: font.bold, fontSize: 17 }} numberOfLines={1}>{p.title}</AppText>
        <AppText variant="small" muted numberOfLines={1}>{p.cat}</AppText>
      </View>
      {p.km != null ? <View style={st.km}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={brand.purple}>{p.km < 0.05 ? t('هنا') : p.km < 1 ? t('{n} م', { n: Math.round(p.km * 1000) }) : t('{n} كم', { n: p.km })}</AppText></View> : null}
    </Pressable>
  );
}

function EventBanner({ e }: { e: EventItem }) {
  const days = Math.max(0, Math.ceil((new Date(e.start).getTime() - Date.now()) / 86400e3));
  return (
    <Pressable onPress={() => router.push(`/event/${e.id}`)} style={st.ev}>
      <Image source={e.image || e.thumb || photos.fest} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['rgba(43,39,69,0.95)', 'rgba(43,39,69,0.2)']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={{ padding: 18, gap: 4, width: '70%' }}>
        <View style={st.evTag}><AppText style={{ fontFamily: font.bold, fontSize: 12 }} color={brand.pinkDeep}>{days > 0 ? t('بعد {n} أيام', { n: days }) : t('الحين')}</AppText></View>
        <AppText style={{ fontFamily: font.bold, fontSize: 20, lineHeight: 30 }} color="#fff" numberOfLines={2}>{e.title}</AppText>
        <AppText variant="small" color="#E2DAEE" numberOfLines={1}>{e.address || (e.city ? cityName(e.city) : '')}</AppText>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  hero: { height: 470, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden', backgroundColor: brand.ink },
  top: { position: 'absolute', right: 20, left: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  glass: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  avRing: { width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, borderColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  heroTx: { position: 'absolute', right: 20, left: 20, bottom: 28, gap: 4 },
  weather: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 6 },
  aiRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 18 },
  aiCard: { flex: 1, borderRadius: 20, padding: 14, gap: 4, minHeight: 96 },
  search: { marginTop: 14, height: 60, borderRadius: 22, backgroundColor: brand.card, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  count: { backgroundColor: brand.chip, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  kinds: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 24 },
  kind: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12 },
  pick: { width: CARD_W, height: 320, borderRadius: 30, overflow: 'hidden', backgroundColor: brand.ink },
  pickTop: { flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  starTag: { backgroundColor: brand.orange, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  pickTx: { position: 'absolute', right: 18, left: 18, bottom: 18 },
  near: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: brand.card, borderRadius: 24, padding: 10 },
  nearImg: { width: 72, height: 72, borderRadius: 18 },
  km: { backgroundColor: brand.chip, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  ev: { marginHorizontal: 16, marginTop: 18, height: 150, borderRadius: 26, overflow: 'hidden', backgroundColor: brand.ink, justifyContent: 'center' },
  cityRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, padding: 3 },
  cityImg: { width: '100%', height: '100%', borderRadius: 36 },
  evCard: { width: 200, backgroundColor: brand.card, borderRadius: 20, overflow: 'hidden' },
  evTag: { alignSelf: 'flex-start', backgroundColor: brand.softPink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
});

function CityDeals({ city }: { city: string }) {
  const { data } = useAsync(() => cityCoupons(city).catch(() => []), [city]);
  const F = useFeatures();
  if (!F.coupons || !data?.length) return null;
  return (
    <>
      <Section title={t('عروض {city}', { city: cityName(city) })} action={t('كل الكوبونات')} onAction={() => router.push('/coupons')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 10 }}>
        {data.slice(0, 6).map((c) => <View key={c.id} style={{ width: Math.min(320, W - 60) }}><CouponCard c={c} onPress={() => router.push(`/coupon/${c.id}`)} /></View>)}
      </ScrollView>
    </>
  );
}
