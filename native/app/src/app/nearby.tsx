import { useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { HeartButton } from '@/components/HeartButton';
import { Icon } from '@/components/Icon';
import { NativeAdCard } from '@/components/Ads';
import { kinds, nearby } from '@/lib/content';
import { setList } from '@/lib/browse';
import { t } from '@/lib/i18n';
import type { Place } from '@/lib/types';
import { brand, font, kindStyle } from '@/theme/tokens';

const RADII = [2, 5, 15, 40];
/** وش يناسب الحين حسب الوقت بتوقيت مكة (ما عندنا ساعات دوام دقيقة لكل مكان، فنقترح حسب وقت اليوم) */
function nowHint(): { label: string; kinds: string[] } {
  const h = new Date(Date.now() + 3 * 3600e3).getUTCHours();
  if (h >= 5 && h < 11) return { label: t('الصبح: فطور وقهوة ومشي'), kinds: ['cafe', 'food', 'nature'] };
  if (h >= 11 && h < 15) return { label: t('الظهر: غداء وأماكن مكيفة'), kinds: ['food', 'shopping', 'heritage'] };
  if (h >= 15 && h < 19) return { label: t('العصر: مماشي ومعالم وقهوة'), kinds: ['nature', 'sights', 'cafe'] };
  if (h >= 19 && h < 24) return { label: t('الليل: عشاء وترفيه وتسوق'), kinds: ['food', 'fun', 'shopping'] };
  return { label: t('آخر الليل: قهاوي ومطاعم'), kinds: ['cafe', 'food'] };
}
const km = (n: number) => (n < 0.05 ? t('هنا') : n < 1 ? t('{n} م', { n: Math.round(n * 1000) }) : t('{n} كم', { n: Math.round(n * 10) / 10 }));

/** «قريب مني الحين»: الأماكن حولك مرتبة بالمسافة، مع اقتراح يناسب وقت اليوم وفلتر النوع والمسافة */
export default function Nearby() {
  const insets = useSafeAreaInsets();
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [denied, setDenied] = useState(false);
  const [radius, setRadius] = useState(5);
  const [kind, setKind] = useState<string | 'now' | ''>('now');
  const [list, setListState] = useState<Place[] | null>(null);
  const hint = useMemo(nowHint, []);

  useEffect(() => {
    (async () => {
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) { setDenied(true); return; }
        const last = await Location.getLastKnownPositionAsync().catch(() => null);
        if (last) setPos({ lat: last.coords.latitude, lng: last.coords.longitude });
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
        if (cur) setPos({ lat: cur.coords.latitude, lng: cur.coords.longitude });
        else if (!last) setDenied(true);
      } catch { setDenied(true); }
    })();
  }, []);

  useEffect(() => {
    if (!pos) return;
    let alive = true;
    setListState(null);
    nearby(pos.lat, pos.lng, radius).then((r) => { if (alive) setListState(r); }).catch(() => alive && setListState([]));
    return () => { alive = false; };
  }, [pos?.lat, pos?.lng, radius]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const all = list ?? [];
    if (kind === 'now') {
      const m = all.filter((p) => p.kinds.some((k) => hint.kinds.includes(k)));
      return m.length >= 4 ? m : all;
    }
    return kind ? all.filter((p) => p.kinds.includes(kind)) : all;
  }, [list, kind, hint]);
  const counts = useMemo(() => Object.fromEntries(kinds.map((k) => [k.id, (list ?? []).filter((p) => p.kinds.includes(k.id)).length])), [list]);

  const head = (
    <View>
      <View style={[st.band, { paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable style={st.glass} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel={t('رجوع')}><Icon name="back" color="#fff" /></Pressable>
          <View style={{ flex: 1 }}>
            <AppText variant="small" color="#FFE6EC">{t('حولك على بعد {r} كم', { r: radius })}</AppText>
            <AppText variant="title" color="#fff" style={{ fontSize: 24 }}>{t('قريب مني الحين')}</AppText>
          </View>
          <Pressable style={st.mapBtn} onPress={() => router.push('/map')}><Icon name="map" color={brand.pinkDeep} size={20} /></Pressable>
        </View>
        <View style={st.radii}>
          {RADII.map((r) => (
            <Pressable key={r} style={[st.radius, radius === r && st.radiusOn]} onPress={() => setRadius(r)}>
              <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={radius === r ? brand.pinkDeep : '#fff'}>{t('{n} كم', { n: r })}</AppText>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable style={[st.chip, kind === 'now' && { backgroundColor: brand.orange }]} onPress={() => setKind('now')}>
          <Icon name="spark" size={15} color={kind === 'now' ? '#fff' : brand.orange} />
          <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={kind === 'now' ? '#fff' : brand.text}>{t('يناسب الحين')}</AppText>
        </Pressable>
        <Pressable style={[st.chip, kind === '' && { backgroundColor: brand.ink }]} onPress={() => setKind('')}>
          <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={kind === '' ? '#fff' : brand.text}>{t('الكل')}</AppText>
        </Pressable>
        {kinds.filter((k) => counts[k.id]).map((k) => {
          const s = kindStyle[k.id] || kindStyle.sights, on = kind === k.id;
          return (
            <Pressable key={k.id} style={[st.chip, on && { backgroundColor: s.fg }]} onPress={() => setKind(on ? '' : k.id)}>
              <Icon name={s.icon as never} size={15} color={on ? '#fff' : s.fg} />
              <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={on ? '#fff' : brand.text}>{k.name}</AppText>
              <AppText variant="tiny" color={on ? '#fff' : brand.muted}>{counts[k.id]}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>
      {kind === 'now' && list?.length ? <AppText variant="small" muted style={{ paddingHorizontal: 18, marginBottom: 6 }}>{hint.label}</AppText> : null}
      {denied ? (
        <View style={st.empty}>
          <Icon name="pin" color={brand.pinkDeep} size={32} />
          <AppText style={{ fontFamily: font.bold, fontSize: 16 }} center>{t('نحتاج نعرف موقعك')}</AppText>
          <AppText variant="small" muted center>{t('فعّل الموقع لدليل السعودية من الإعدادات عشان نطلع لك الأماكن اللي حولك.')}</AppText>
          <Pressable style={st.btn} onPress={() => Linking.openSettings().catch(() => {})}><AppText color="#fff" style={{ fontFamily: font.bold }}>{t('افتح الإعدادات')}</AppText></Pressable>
        </View>
      ) : !pos || list === null ? <ActivityIndicator color={brand.pinkDeep} style={{ marginTop: 40 }} />
        : !shown.length ? (
          <View style={st.empty}>
            <AppText style={{ fontFamily: font.bold, fontSize: 16 }} center>{t('ما لقينا أماكن قريبة')}</AppText>
            <AppText variant="small" muted center>{t('وسّع المسافة أو اختر نوع ثاني.')}</AppText>
          </View>
        ) : null}
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: brand.bg }}
      data={shown}
      keyExtractor={(p) => String(p.id)}
      ListHeaderComponent={head}
      contentContainerStyle={{ paddingBottom: insets.bottom + 30, gap: 10 }}
      renderItem={({ item: p, index }) => {
        const s = kindStyle[p.kinds[0]] || kindStyle.sights;
        return (
          <>
            {index > 0 && index % 8 === 0 ? <NativeAdCard style={{ marginHorizontal: 16, marginBottom: 10 }} /> : null}
            <Pressable style={st.row} onPress={() => { setList('place', shown.map((x) => x.id)); router.push(`/place/${p.id}`); }}>
              <Image source={p.thumb || p.image} style={st.img} contentFit="cover" />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <AppText variant="tiny" color={s.fg} style={{ fontFamily: font.bold }}>{p.cat}</AppText>
                <AppText style={{ fontFamily: font.bold, fontSize: 16 }} numberOfLines={1}>{p.title}</AppText>
                {p.summary ? <AppText variant="small" muted numberOfLines={1}>{p.summary}</AppText> : null}
              </View>
              <View style={{ alignItems: 'center', gap: 6 }}>
                {p.km != null ? <View style={st.km}><AppText style={{ fontFamily: font.bold, fontSize: 12.5 }} color={brand.pinkDeep}>{km(p.km)}</AppText></View> : null}
                <HeartButton id={p.id} />
              </View>
            </Pressable>
          </>
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  band: { backgroundColor: brand.pink, paddingHorizontal: 16, paddingBottom: 16, gap: 14, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  glass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  mapBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  radii: { flexDirection: 'row', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, padding: 4 },
  radius: { flex: 1, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  radiusOn: { backgroundColor: '#fff' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: brand.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, backgroundColor: brand.card, borderRadius: 20, padding: 10 },
  img: { width: 78, height: 78, borderRadius: 14, backgroundColor: brand.chip },
  km: { backgroundColor: brand.softPink, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  empty: { alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 20, backgroundColor: brand.card, borderRadius: 22, padding: 22 },
  btn: { backgroundColor: brand.pinkDeep, borderRadius: 14, paddingHorizontal: 20, height: 44, justifyContent: 'center', marginTop: 4 },
});
