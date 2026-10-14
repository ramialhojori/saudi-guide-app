import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { Empty, Loading } from '@/components/State';
import { Pill } from '@/components/ui';
import { cityName, getEvents } from '@/lib/content';
import { riyadhDate } from '@/lib/text';
import { useAsync } from '@/lib/useAsync';
import { countEvents, seasonsFrom, seasonStatus, slug } from '@/lib/seasons';
import type { EventItem } from '@/lib/types';
import { brand, font, photos } from '@/theme/tokens';

const DAY = 86400e3;
const ksaKey = (t: number) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10);
const WD = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** أنواع الفعاليات — كل نوع يطابق تصنيفات قودبابر بالكلمات، بلون من الهوية */
const TYPES: { id: string; t: string; icon: IconName; fg: string; bg: string; match: RegExp }[] = [
  { id: 'concert', t: 'حفلات', icon: 'mic', fg: brand.pinkDeep, bg: brand.softPink, match: /غنائ|حفل|موسيق/ },
  { id: 'theater', t: 'مسرح', icon: 'star', fg: brand.purple, bg: brand.softPurple, match: /مسرح/ },
  { id: 'sport', t: 'رياضة', icon: 'fun', fg: brand.skyDeep, bg: brand.softSky, match: /^رياضي|رياضة/ },
  { id: 'festival', t: 'مهرجانات', icon: 'spark', fg: brand.orangeDeep, bg: brand.softOrange, match: /مهرجان/ },
  { id: 'expo', t: 'معارض ومؤتمرات', icon: 'book', fg: brand.lilac, bg: brand.softPurple, match: /معارض|مؤتمر|معرض/ },
  { id: 'heritage', t: 'تراث وثقافة', icon: 'heritage', fg: brand.orangeInk, bg: brand.softBrown, match: /تراث|ثقاف/ },
  { id: 'fun', t: 'ترفيه', icon: 'fun', fg: brand.green, bg: brand.softGreen, match: /ترفيه|استجمام/ },
  { id: 'adventure', t: 'تجارب ومغامرات', icon: 'nature', fg: brand.green, bg: brand.softGreen, match: /تجارب|مغامر/ },
  { id: 'family', t: 'عائلية', icon: 'family', fg: brand.orangeDeep, bg: brand.softOrange, match: /عائل|أطفال|طفل/ },
  { id: 'food', t: 'طعام', icon: 'food', fg: brand.orangeDeep, bg: brand.softOrange, match: /طعام|مطاعم|أكل/ },
];
const SEASON = /^(موسم|لحظات)/;
const typeOf = (e: EventItem) => TYPES.find((t) => (e.cats || []).some((c) => !SEASON.test(c) && t.match.test(c)));
const isLong = (e: EventItem) => !!e.end && new Date(e.end).getTime() - new Date(e.start).getTime() > 14 * DAY;
const isUrl = (s: string) => /^https?:\/\//.test(s);

/** الفعاليات — بألوان الهوية: ترويسة ملونة، أنواع كثيرة، المواسم، والمستمرة لحالها */
export function EventsScreen({ asTab }: { asTab?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const { data, loading } = useAsync(getEvents, []);
  const [when, setWhen] = useState(0);
  const [type, setType] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [pickCity, setPickCity] = useState(false);
  const now = Date.now();
  const today = ksaKey(now), tomorrow = ksaKey(now + DAY);
  const wd = new Date(now + 3 * 3600e3).getUTCDay(), toFri = (5 - wd + 7) % 7;
  const weekend = [ksaKey(now + (toFri - 1) * DAY), ksaKey(now + toFri * DAY), ksaKey(now + (toFri + 1) * DAY)];

  const events = data ?? [];
  const types = TYPES.filter((t) => events.some((e) => typeOf(e)?.id === t.id));
  const on = (e: EventItem, k: string) => ksaKey(new Date(e.start).getTime()) <= k && ksaKey(new Date(e.end || e.start).getTime()) >= k;

  const seasonList = useMemo(() => seasonsFrom(events, now), [events]);
  const cities = useMemo(() => [...new Set(events.map((e) => e.city).filter(Boolean))] as string[], [events]);
  const filtered = events.filter((e) => (!type || typeOf(e)?.id === type) && (!season || (e.cats || []).includes(season)) && (!city || e.city === city));
  const dated = filtered.filter((e) => !isLong(e));
  const ongoing = filtered.filter(isLong);
  const counts = [dated.length, dated.filter((e) => on(e, today)).length, dated.filter((e) => on(e, tomorrow)).length, dated.filter((e) => weekend.some((k) => on(e, k))).length];
  const shown = when === 1 ? dated.filter((e) => on(e, today)) : when === 2 ? dated.filter((e) => on(e, tomorrow)) : when === 3 ? dated.filter((e) => weekend.some((k) => on(e, k))) : dated;
  const top = shown[0];
  const groups = new Map<string, EventItem[]>();
  for (const e of shown.slice(1)) {
    const k = ksaKey(Math.max(new Date(e.start).getTime(), now));
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: asTab ? 130 : 60 }}>
      {/* ترويسة بلون الهوية */}
      <View style={[st.head, { paddingTop: insets.top + 10 }]}>
        <View style={st.blob1} /><View style={st.blob2} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {asTab ? null : <Pressable style={st.glass} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="رجوع"><Icon name="back" color="#fff" /></Pressable>}
          <View style={{ flex: 1 }}>
            <AppText variant="title" color="#fff" style={{ fontSize: 26, lineHeight: 36 }}>الفعاليات</AppText>
            <AppText variant="small" color="#E2DAEE">{dated.length} فعالية قادمة · {ongoing.length} مستمرة</AppText>
          </View>
        </View>
        <View style={st.whenRow}>
          {(['الكل', 'اليوم', 'بكرة', 'الويكند'] as const).map((l, i) => (
            <Pressable key={l} onPress={() => setWhen(i)} style={[st.when, when === i && st.whenOn]}>
              <AppText style={{ fontFamily: font.bold, fontSize: 15 }} color={when === i ? brand.purple : '#fff'} center>{l}</AppText>
              <AppText variant="tiny" color={when === i ? brand.orangeDeep : '#E2DAEE'} center>{counts[i]}</AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* الأنواع */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 16 }}>
        <TypeChip t="الكل" icon="cal" fg={brand.ink} bg="#fff" on={!type} onPress={() => setType(null)} />
        {types.map((t) => <TypeChip key={t.id} t={t.t} icon={t.icon} fg={t.fg} bg={t.bg} on={type === t.id} onPress={() => setType(type === t.id ? null : t.id)} />)}
      </ScrollView>

      {/* المواسم: بطاقة لكل موسم شغّال أو قريب — تفتح صفحة الموسم */}
      {seasonList.length ? (
        <>
          <View style={st.secRow}><AppText variant="section">المواسم</AppText><AppText variant="tiny" muted>اضغط الموسم وشوف كل فعالياته</AppText></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
            {seasonList.map((x) => (
              <Pressable key={x.name} onPress={() => router.push(`/season/${slug(x.name)}`)} style={[st.seasonCard, { backgroundColor: x.color }]}>
                <Image source={photos[x.photo]} style={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient colors={['rgba(0,0,0,0)', x.color + 'F0']} locations={[0.15, 0.9]} style={StyleSheet.absoluteFill} />
                <View style={st.seasonLive}><View style={[st.liveDot, { backgroundColor: x.live ? '#7CFC9A' : brand.orange }]} /><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{seasonStatus(x, now)}</AppText></View>
                <View style={{ position: 'absolute', right: 14, left: 14, bottom: 12 }}>
                  <AppText style={{ fontFamily: font.bold, fontSize: 22, lineHeight: 30 }} color="#fff">{x.name}</AppText>
                  <AppText variant="tiny" color="#F2ECF8">{countEvents(x.events.length)} · {x.line}</AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {/* المدينة */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Pressable onPress={() => setPickCity((v) => !v)} style={st.cityBtn}>
          <Icon name="pin" color={brand.pinkDeep} size={18} />
          <AppText style={{ fontFamily: font.bold, flex: 1 }}>{city ? cityName(city) : 'كل المدن'} ▾</AppText>
          <AppText variant="tiny" muted>{cities.length} مدن فيها فعاليات</AppText>
        </Pressable>
        {pickCity ? (
          <View style={st.cityList}>
            {[null, ...cities].map((c) => (
              <Pressable key={c ?? 'all'} onPress={() => { setCity(c); setPickCity(false); }} style={st.cityRow}>
                <AppText style={{ flex: 1, fontFamily: c === city ? font.bold : font.regular }} color={c === city ? brand.purple : brand.ink}>{c ? cityName(c) : 'كل المدن'}</AppText>
                <AppText variant="tiny" muted>{events.filter((e) => !c || e.city === c).length}</AppText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {loading && !data ? <Loading /> : null}
      {!loading && !shown.length && !ongoing.length ? <Empty title="ما فيه فعاليات هنا" sub="جرّب يوم ثاني أو نوع ثاني" /> : null}

      {top ? (
        <Pressable style={st.top} onPress={() => router.push(`/event/${top.id}`)}>
          <Image source={top.image || top.thumb || photos.fest} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(32,22,54,0)', 'rgba(32,22,54,0.94)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
          <View style={st.dateBox}>
            <AppText style={{ fontFamily: font.bold, fontSize: 22, lineHeight: 26 }} center>{new Date(new Date(top.start).getTime() + 3 * 3600e3).getUTCDate()}</AppText>
            <AppText variant="tiny" center color={brand.pinkDeep}>{riyadhDate(top.start, false).split(' ')[1]}</AppText>
          </View>
          <View style={{ position: 'absolute', right: 16, left: 16, bottom: 14, gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pill label="الأقرب موعداً" bg={brand.orange} fg="#fff" />
              {typeOf(top) ? <Pill label={typeOf(top)!.t} bg="rgba(255,255,255,0.2)" fg="#fff" /> : null}
            </View>
            <AppText style={{ fontFamily: font.bold, fontSize: 22, lineHeight: 32 }} color="#fff" numberOfLines={2}>{top.title}</AppText>
            <AppText variant="small" color="#E2DAEE" numberOfLines={1}>{place(top)}{top.tickets ? ' · التذاكر متوفرة' : ''}</AppText>
          </View>
        </Pressable>
      ) : null}

      {[...groups.entries()].map(([k, list]) => {
        const d = new Date(k + 'T00:00:00Z');
        const label = k === today ? 'اليوم · ' : k === tomorrow ? 'بكرة · ' : '';
        return (
          <View key={k}>
            <View style={st.dayHead}>
              <View style={st.dayDot} />
              <AppText style={{ fontFamily: font.bold, fontSize: 14 }} color={brand.purple}>{label}{WD[d.getUTCDay()]} {riyadhDate(k + 'T12:00:00+03:00', false)}</AppText>
            </View>
            <View style={{ gap: 10, paddingHorizontal: 16 }}>{list.map((e) => <Row key={e.id} e={e} />)}</View>
          </View>
        );
      })}

      {ongoing.length ? (
        <>
          <View style={[st.dayHead, { marginTop: 10 }]}>
            <View style={[st.dayDot, { backgroundColor: brand.green }]} />
            <AppText style={{ fontFamily: font.bold, fontSize: 14 }} color={brand.green}>مستمرة الحين · تقدر تزورها أي يوم</AppText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
            {ongoing.map((e) => (
              <Pressable key={e.id} style={st.card} onPress={() => router.push(`/event/${e.id}`)}>
                <Image source={e.thumb || e.image || photos.fest} style={{ width: '100%', height: 120 }} contentFit="cover" />
                <View style={{ padding: 10 }}>
                  <AppText variant="tiny" color={brand.green} style={{ fontFamily: font.semibold }}>حتى {riyadhDate(e.end, false)}</AppText>
                  <AppText style={{ fontFamily: font.bold, fontSize: 14, lineHeight: 21 }} numberOfLines={2}>{e.title}</AppText>
                  <AppText variant="tiny" muted numberOfLines={1}>{e.city ? cityName(e.city) : ''}</AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </ScrollView>
  );
}

const place = (e: EventItem) => (e.address && !isUrl(e.address) ? e.address : e.city ? cityName(e.city) : '');

function Row({ e }: { e: EventItem }) {
  const t = typeOf(e);
  const time = riyadhDate(e.start).split('·')[1]?.trim();
  return (
    <Pressable style={st.row} onPress={() => router.push(`/event/${e.id}`)}>
      <Image source={e.thumb || e.image || photos.fest} style={st.rowImg} contentFit="cover" />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {t ? <Pill label={t.t} bg={t.bg} fg={t.fg} /> : null}
          {time ? <AppText variant="tiny" color={brand.muted}>{time}</AppText> : null}
        </View>
        <AppText style={{ fontFamily: font.bold, fontSize: 15 }} numberOfLines={2}>{e.title}</AppText>
        <AppText variant="small" muted numberOfLines={1}>{place(e)}</AppText>
      </View>
    </Pressable>
  );
}

function TypeChip({ t, icon, fg, bg, on, onPress }: { t: string; icon: IconName; fg: string; bg: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[st.type, { backgroundColor: on ? fg : bg }]}>
      <Icon name={icon} color={on ? '#fff' : fg} size={18} />
      <AppText variant="small" style={{ fontFamily: font.bold }} color={on ? '#fff' : fg}>{t}</AppText>
    </Pressable>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: brand.purple, paddingHorizontal: 16, paddingBottom: 18, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  blob1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(235,131,155,0.25)', top: -70, left: -60 },
  blob2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(248,151,67,0.25)', bottom: -50, right: 30 },
  glass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  whenRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  when: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, paddingVertical: 8 },
  whenOn: { backgroundColor: '#fff' },
  type: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, borderRadius: 14, paddingHorizontal: 14 },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  seasonCard: { width: 270, height: 170, borderRadius: 24, overflow: 'hidden' },
  seasonLive: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  cityBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 16, height: 48, paddingHorizontal: 14 },
  cityList: { marginTop: 6, backgroundColor: '#fff', borderRadius: 16, padding: 6 },
  cityRow: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  top: { marginHorizontal: 16, marginTop: 16, height: 280, borderRadius: 28, overflow: 'hidden', backgroundColor: brand.ink },
  dateBox: { position: 'absolute', top: 14, left: 14, width: 56, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 6 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  dayDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: brand.orange },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 10 },
  rowImg: { width: 80, height: 80, borderRadius: 16 },
  card: { width: 200, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
});
