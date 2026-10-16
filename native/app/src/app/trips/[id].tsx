import { useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { alert } from '@/lib/alert';
import { cityName, getPlacesByIds } from '@/lib/content';
import { t } from '@/lib/i18n';
import { countSave, getReadyTrip, tripIntro, tripTitle } from '@/lib/readyTrips';
import { happyMoment } from '@/lib/review';
import { encodeTrip, trip } from '@/lib/trip';
import { useAsync } from '@/lib/useAsync';
import { env } from '@/config/env';
import { brand, font } from '@/theme/tokens';

const STEP = [brand.orange, brand.pink, brand.sky, brand.lilac, brand.green];

/** صفحة رحلة جاهزة: الغلاف والوصف، والأيام بأماكنها بالترتيب، وزر «احفظها في رحلتي» */
export default function ReadyTripScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: x, loading } = useAsync(() => getReadyTrip(+id), [id]);
  const ids = x ? x.days.flatMap((d) => d.places) : [];
  const { data: places } = useAsync(() => (ids.length ? getPlacesByIds(ids) : Promise.resolve([])), [x?.id]);
  const byId = new Map((places ?? []).map((p) => [p.id, p]));
  const [day, setDay] = useState(0);

  if (loading || !x) return <View style={{ flex: 1, backgroundColor: brand.bg, justifyContent: 'center' }}><ActivityIndicator color={brand.orange} /></View>;
  const cur = x.days[Math.min(day, x.days.length - 1)];

  const save = () => {
    const apply = (mode: 'replace' | 'add') => {
      const ok = x.days.map((d) => d.places.filter((p) => byId.has(p))).filter((d) => d.length);
      trip.setDays(mode === 'replace' ? ok : [...trip.days().filter((d) => d.length), ...ok]);
      countSave(x.id); happyMoment('ready_trip');
      router.replace('/trip');
    };
    if (!trip.all().length) return apply('replace');
    alert(t('عندك أماكن في رحلتي'), t('تبي تستبدلها بالرحلة الجديدة ولا تضيفها عليها؟'), [
      { text: t('إلغاء'), style: 'cancel' }, { text: t('أضفها'), onPress: () => apply('add') }, { text: t('استبدلها'), style: 'destructive', onPress: () => apply('replace') },
    ]);
  };
  const share = () => {
    const url = `${env.siteUrl}/plan/${encodeTrip(x.days.map((d) => d.places))}`;
    Share.share({ message: `${tripTitle(x)}\n${url}` }).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={{ height: 300 + insets.top }}>
          <Image source={x.cover} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(32,22,54,0.35)', 'transparent', 'rgba(32,22,54,0.9)']} style={StyleSheet.absoluteFill} />
          <View style={[st.top, { top: insets.top + 8 }]}>
            <Pressable style={st.glass} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel={t('رجوع')}><Icon name="back" color="#fff" /></Pressable>
            <Pressable style={st.glass} onPress={share} accessibilityLabel={t('مشاركة')}><Icon name="share" color="#fff" size={20} /></Pressable>
          </View>
          <View style={{ position: 'absolute', bottom: 18, right: 18, left: 18, gap: 4 }}>
            <AppText style={{ fontFamily: font.bold }} color="#F9A158">{cityName(x.city)} · {x.dayCount === 1 ? t('يوم واحد') : t('{n} أيام', { n: x.dayCount })} · {t('{n} أماكن', { n: x.placeCount })}</AppText>
            <AppText style={{ fontFamily: font.bold, fontSize: 26, lineHeight: 36 }} color="#fff">{tripTitle(x)}</AppText>
          </View>
        </View>
        {tripIntro(x) ? <AppText style={{ margin: 16, marginBottom: 4, lineHeight: 26 }}>{tripIntro(x)}</AppText> : null}

        {x.days.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
            {x.days.map((d, i) => (
              <Pressable key={i} style={[st.dayChip, day === i && { backgroundColor: STEP[i % STEP.length] }]} onPress={() => setDay(i)}>
                <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={day === i ? '#fff' : brand.text}>{t('اليوم {n}', { n: i + 1 })}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 4 }}>
          {cur.title ? <AppText style={{ fontFamily: font.bold, fontSize: 18 }}>{cur.title}</AppText> : null}
          {cur.note ? <View style={st.note}><Icon name="info" color={brand.orangeDeep} size={16} /><AppText variant="small" style={{ flex: 1, lineHeight: 21 }}>{cur.note}</AppText></View> : null}
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          {cur.places.map((pid, i) => {
            const p = byId.get(pid);
            const c = STEP[day % STEP.length];
            return (
              <View key={pid} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ alignItems: 'center', width: 28 }}>
                  <View style={[st.num, { backgroundColor: c }]}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{i + 1}</AppText></View>
                  {i < cur.places.length - 1 ? <View style={[st.line, { backgroundColor: c }]} /> : null}
                </View>
                <Pressable style={st.stop} onPress={() => p && router.push(`/place/${p.id}`)} disabled={!p}>
                  {p ? <Image source={p.thumb || p.image} style={st.img} contentFit="cover" /> : <View style={st.img} />}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText style={{ fontFamily: font.bold, fontSize: 15 }} numberOfLines={1}>{p?.title ?? '…'}</AppText>
                    <AppText variant="small" muted numberOfLines={2}>{p?.summary || p?.cat || ''}</AppText>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View style={[st.bar, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable style={st.saveBtn} onPress={save} disabled={!places}>
          <Icon name="route" color="#fff" size={18} /><AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 16 }}>{t('احفظها في رحلتي')}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  top: { position: 'absolute', right: 16, left: 16, flexDirection: 'row', justifyContent: 'space-between' },
  glass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  dayChip: { height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: brand.card, justifyContent: 'center' },
  note: { flexDirection: 'row', gap: 8, backgroundColor: brand.softOrange, borderRadius: 14, padding: 10, marginTop: 6 },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  line: { width: 2, flex: 1, opacity: 0.4, marginVertical: 2 },
  stop: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: brand.card, borderRadius: 18, padding: 10, marginBottom: 10 },
  img: { width: 64, height: 64, borderRadius: 12, backgroundColor: brand.chip },
  bar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: brand.bg },
  saveBtn: { flexDirection: 'row', gap: 8, height: 52, borderRadius: 16, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
});
