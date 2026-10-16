import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { CouponCard } from '@/components/CouponCard';
import { HeartButton } from '@/components/HeartButton';
import { Icon, type IconName } from '@/components/Icon';
import { Empty, Loading } from '@/components/State';
import { Badge, Chip, ImageRow } from '@/components/ui';
import { allCities, cityName, getCityPlaces, kindPlaces, nearby, popularSearches, searchAll, weeklyPicks, type SearchAll } from '@/lib/content';
import { useAuth } from '@/lib/auth';
import { useFeatures } from '@/lib/features';
import { riyadhDate } from '@/lib/text';
import { trip, useTrip } from '@/lib/trip';
import type { Place } from '@/lib/types';
import { brand, font, kindStyle, INPUT_START } from '@/theme/tokens';
import { track } from '@/lib/track';
import { t } from '@/lib/i18n';

const KIND_NAME: Record<string, string> = { food: t('مطاعم'), cafe: t('مقاهي'), sights: t('معالم'), heritage: t('تراث'), nature: t('طبيعة'), islamic: t('معالم إسلامية'), fun: t('ترفيه'), shopping: t('تسوق') };
const KIND_ICON: Record<string, IconName> = { food: 'food', cafe: 'cafe', sights: 'sights', heritage: 'heritage', nature: 'nature', islamic: 'mosque', fun: 'fun', shopping: 'shop' };
const TOP_CITIES = ['riyadh', 'jeddah', 'medina', 'makkah-region', 'alula', 'abha', 'eastern-region', 'taif'];
const DEFAULT_POPULAR = ['مطاعم بحرية', 'مقهى هادي', 'جلسات خارجية', 'أماكن للعائلة', 'شلالات', 'متاحف', 'إفطار', 'كورنيش'];
const RECENT_KEY = 'sg_recent_search_v1';

type Tab = 'all' | 'places' | 'events' | 'coupons' | 'questions';
const EMPTY: SearchAll = { places: [], events: [], coupons: [], questions: [], cities: [] };

/** البحث 2.0: يفهم «مطعم بحري جدة»، يبحث في الأماكن والفعاليات والكوبونات والأسئلة، ويرتب حسب قربك */
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ near?: string; kind?: string; q?: string; city?: string; add?: string; day?: string }>();
  const addMode = params.add === 'trip';
  const { ids: tripIds } = useTrip();
  const { user } = useAuth();
  const F = useFeatures();
  const [q, setQ] = useState(params.q ?? '');
  const [kind, setKind] = useState(params.kind);
  const [city, setCity] = useState<string | undefined>(addMode ? params.city : undefined);
  const [near, setNear] = useState(params.near === '1');
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [res, setRes] = useState<SearchAll>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [popular, setPopular] = useState<string[]>(DEFAULT_POPULAR);
  const [sugg, setSugg] = useState<Place[]>([]);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((v) => setRecent(JSON.parse(v || '[]'))).catch(() => {});
    popularSearches().then((p) => { if (p.length >= 4) setPopular(p.slice(0, 10)); }).catch(() => {});
  }, []);
  const remember = (t: string) => {
    const k = t.trim(); if (k.length < 2) return;
    const next = [k, ...recent.filter((x) => x !== k)].slice(0, 8);
    setRecent(next); AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
  };
  const clearRecent = () => { setRecent([]); AsyncStorage.removeItem(RECENT_KEY).catch(() => {}); };

  // «الأقرب»: نطلب الموقع مرة وحدة
  const askLocation = async () => {
    if (pos) return pos;
    const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (!perm?.granted) { setMsg(t('فعّل خدمة الموقع عشان نرتب لك الأقرب')); return null; }
    const p = await Location.getCurrentPositionAsync({}).catch(() => null);
    if (!p) return null;
    const v = { lat: p.coords.latitude, lng: p.coords.longitude };
    setPos(v); return v;
  };
  const toggleNear = async () => { if (near) { setNear(false); return; } const p = await askLocation(); if (p) setNear(true); };

  const k = q.trim();
  const browsing = !k && !kind && !near;

  // قبل الكتابة مع «الأقرب» أو نوع: نعرض قائمة مباشرة
  useEffect(() => {
    if (k) return;
    if (near) {
      (async () => { setBusy(true); const p = await askLocation(); if (p) { const l = await nearby(p.lat, p.lng, 30); setRes({ ...EMPTY, places: kind ? l.filter((x) => x.kinds.includes(kind)) : l }); } setBusy(false); })();
    } else if (kind) setRes({ ...EMPTY, places: kindPlaces(kind).filter((p) => !city || p.city === city) });
    else setRes(EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, near, kind, city]);

  // البحث نفسه
  useEffect(() => {
    if (!k) return;
    const t = setTimeout(async () => {
      setBusy(true); setMsg('');
      const p = near ? await askLocation() : null;
      const r = await searchAll(k, { city, kind, lat: p?.lat, lng: p?.lng, sort: near ? 'near' : 'best', home: user?.city || undefined }).catch(() => EMPTY);
      setRes(r); setBusy(false);
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, city, kind, near]);

  // قياس: وش يدورون، ووش يدورون وما يلقون (فجوات المحتوى)
  useEffect(() => {
    if (k.length < 2 || busy) return;
    const t = setTimeout(() => { track(res.places.length ? 'search' : 'search_empty', undefined, k); if (res.places.length) remember(k); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, busy, res.places.length]);

  // اقتراحات «أضف لرحلتي» من مدينة الرحلة
  useEffect(() => {
    if (params.city) getCityPlaces(params.city).then((r) => setSugg(r.places.filter((p) => p.thumb || p.image).slice(0, 40))).catch(() => {});
    else setSugg(weeklyPicks());
  }, [params.city]);

  const counts = { places: res.places.length, events: res.events.length, coupons: res.coupons.length, questions: res.questions.length };
  const total = counts.places + counts.events + counts.coupons + counts.questions;
  const tabs = ([['all', t('الكل'), total], ['places', t('أماكن'), counts.places], ['events', t('فعاليات'), counts.events], ['coupons', t('كوبونات'), counts.coupons], ['questions', t('أسئلة'), counts.questions]] as [Tab, string, number][])
    .filter(([t, , n]) => t === 'all' || t === 'places' || n > 0);
  useEffect(() => { if (tab !== 'all' && tab !== 'places' && !counts[tab as keyof typeof counts]) setTab('all'); }, [tab, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (t: string) => { setQ(t); remember(t); };
  const parsedCity = res.parsed?.city && !city ? res.parsed.city : null;

  /* ——— قبل ما يكتب ——— */
  const browse = (
    <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      {addMode ? null : (
        <>
          {recent.length ? (
            <>
              <View style={st.secRow}><AppText variant="section">{t('بحثت عنها مؤخراً')}</AppText><Pressable onPress={clearRecent}><AppText variant="small" color={brand.purple}>{t('امسح')}</AppText></Pressable></View>
              <View style={st.wrap}>{recent.map((r) => <Pressable key={r} style={st.recent} onPress={() => go(r)}><Icon name="search" size={14} color={brand.faint} /><AppText variant="small">{r}</AppText></Pressable>)}</View>
            </>
          ) : null}
          <View style={st.secRow}><AppText variant="section">{t('الناس تدور على')}</AppText></View>
          <View style={st.wrap}>{popular.map((r) => <Pressable key={r} style={st.pop} onPress={() => go(r)}><AppText variant="small" color={brand.purple} style={{ fontFamily: font.semibold }}>{r}</AppText></Pressable>)}</View>

          <View style={st.secRow}><AppText variant="section">{t('تصفح حسب النوع')}</AppText></View>
          <View style={st.kinds}>
            {Object.keys(KIND_NAME).map((kk) => {
              const ks = kindStyle[kk] ?? kindStyle.sights;
              return (
                <Pressable key={kk} style={st.kindCell} onPress={() => setKind(kk)}>
                  <View style={[st.kindIc, { backgroundColor: ks.bg }]}><Icon name={KIND_ICON[kk]} color={ks.fg} size={22} /></View>
                  <AppText variant="tiny" center style={{ fontFamily: font.semibold }}>{KIND_NAME[kk]}</AppText>
                </Pressable>
              );
            })}
          </View>

          <View style={st.secRow}><AppText variant="section">{t('المدن')}</AppText></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {TOP_CITIES.map((c) => <Chip key={c} label={cityName(c)} onPress={() => router.push(`/city/${c}`)} />)}
          </ScrollView>

          <Pressable style={st.nearCard} onPress={toggleNear}>
            <Badge icon="nav" bg={brand.softSky} fg={brand.skyDeep} size={42} r={14} />
            <View style={{ flex: 1 }}><AppText style={{ fontFamily: font.bold }}>{t('وش قريب مني؟')}</AppText><AppText variant="small" muted>{t('أماكن حولك مرتبة بالمسافة')}</AppText></View>
            <Icon name="chevron" size={16} color={brand.faint} />
          </Pressable>
        </>
      )}
      {sugg.length ? (
        <>
          <View style={st.secRow}><AppText variant="section">{params.city ? t('اقتراحات في {city}', { city: cityName(params.city) }) : t('مختارات الأسبوع')}</AppText>{addMode ? <AppText variant="small" muted>{t('اضغط + عشان تضيف')}</AppText> : null}</View>
          <View style={{ gap: 10 }}>{sugg.filter((p) => !addMode || !tripIds.includes(p.id)).slice(0, addMode ? 40 : 6).map((p) => <View key={p.id} style={{ paddingHorizontal: 16 }}>{placeRow(p)}</View>)}</View>
        </>
      ) : null}
    </ScrollView>
  );

  function placeRow(item: Place) {
    return (
      <ImageRow img={item.thumb || item.image || undefined} cat={`${KIND_NAME[item.kinds[0]] ?? item.cat} · ${cityName(item.city)}`} catColor={kindStyle[item.kinds[0]]?.fg ?? brand.purple}
        title={item.title} sub={item.km != null ? t('على بعد {n} كم', { n: item.km }) : item.summary}
        right={addMode ? (
          <Pressable onPress={() => (tripIds.includes(item.id) ? trip.remove(item.id) : trip.addTo(item.id, Number(params.day) || 0))} style={[st.add, tripIds.includes(item.id) && { backgroundColor: brand.green }]} accessibilityLabel={t('أضف لرحلتي')}>
            <AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>{tripIds.includes(item.id) ? '✓' : '+ ' + t('أضف')}</AppText>
          </Pressable>
        ) : <HeartButton id={item.id} />} onPress={() => { remember(k); router.push(`/place/${item.id}`); }} />
    );
  }
  const eventRow = (e: SearchAll['events'][number]) => (
    <ImageRow img={e.thumb || e.image || undefined} cat={`${riyadhDate(e.start, false)}${e.city ? ' · ' + cityName(e.city) : ''}`} catColor={brand.pinkDeep} title={e.title} sub={e.summary} onPress={() => { remember(k); router.push(`/event/${e.id}`); }} />
  );
  const questionRow = (x: SearchAll['questions'][number]) => (
    <Pressable style={st.qa} onPress={() => router.push(`/question/${x.id}`)}>
      <AppText style={{ fontFamily: font.semibold, lineHeight: 22 }} numberOfLines={2}>{x.text}</AppText>
      <AppText variant="small" muted>{x.answers ? t('{n} إجابة', { n: x.answers }) : t('بدون إجابة للحين')}{x.city ? ` · ${cityName(x.city)}` : ''}</AppText>
    </Pressable>
  );
  const section = (title: string, n: number, tb: Tab) => (
    <View style={st.secRow}><AppText variant="section">{title}</AppText>{n > 3 ? <Pressable onPress={() => setTab(tb)}><AppText variant="small" color={brand.purple} style={{ fontFamily: font.semibold }}>{t('الكل ({n})', { n })}</AppText></Pressable> : <AppText variant="small" muted>{n}</AppText>}</View>
  );

  /* ——— عناصر القائمة حسب التبويب ——— */
  type Row = { key: string; el: React.ReactNode };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const push = (key: string, el: React.ReactNode) => out.push({ key, el });
    if (tab === 'all' && k) {
      res.cities.forEach((c) => push('c' + c.id, (
        <Pressable style={st.cityCard} onPress={() => router.push(`/city/${c.id}`)}>
          <Badge icon="pin" bg="rgba(255,255,255,0.2)" fg="#fff" size={40} r={13} />
          <View style={{ flex: 1 }}><AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 16 }}>{c.name}</AppText><AppText variant="small" color="#E9E0FF">{t('شوف كل أماكن المدينة وفعالياتها')}</AppText></View>
          <Icon name="chevron" color="#fff" size={18} />
        </Pressable>
      )));
      if (F.ai_chat && !addMode && k.length > 2) push('ai', (
        <Pressable style={st.aiCard} onPress={() => router.push({ pathname: '/ask-ai', params: { q: k } })}>
          <Icon name="spark" color={brand.purple} size={18} />
          <AppText variant="small" style={{ flex: 1, fontFamily: font.semibold }} numberOfLines={1}>{t('اسأل الدليل عن «{q}»', { q: k })}</AppText>
          <Icon name="chevron" color={brand.faint} size={16} />
        </Pressable>
      ));
      if (res.places.length) { push('hp', section(t('أماكن'), res.places.length, 'places')); res.places.slice(0, 5).forEach((p) => push('p' + p.id, placeRow(p))); }
      if (res.events.length) { push('he', section(t('فعاليات'), res.events.length, 'events')); res.events.slice(0, 3).forEach((e) => push('e' + e.id, eventRow(e))); }
      if (res.coupons.length) { push('hc', section(t('كوبونات'), res.coupons.length, 'coupons')); res.coupons.slice(0, 2).forEach((c) => push('k' + c.id, <CouponCard c={c} onPress={() => router.push(`/coupon/${c.id}`)} />)); }
      if (res.questions.length) { push('hq', section(t('من المجتمع'), res.questions.length, 'questions')); res.questions.slice(0, 3).forEach((x) => push('q' + x.id, questionRow(x))); }
    } else if (tab === 'events') res.events.forEach((e) => push('e' + e.id, eventRow(e)));
    else if (tab === 'coupons') res.coupons.forEach((c) => push('k' + c.id, <CouponCard c={c} onPress={() => router.push(`/coupon/${c.id}`)} />));
    else if (tab === 'questions') res.questions.forEach((x) => push('q' + x.id, questionRow(x)));
    else res.places.forEach((p) => push('p' + p.id, placeRow(p)));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res, tab, k, addMode, tripIds, F.ai_chat]);

  const filters = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
        <Pressable onPress={toggleNear} style={[st.fchip, near && st.fchipOn]}><Icon name="nav" size={14} color={near ? '#fff' : brand.skyDeep} /><AppText variant="small" color={near ? '#fff' : brand.text} style={{ fontFamily: font.semibold }}>{t('الأقرب')}</AppText></Pressable>
        {kind ? <Pressable onPress={() => setKind(undefined)} style={[st.fchip, st.fchipOn]}><AppText variant="small" color="#fff" style={{ fontFamily: font.semibold }}>{KIND_NAME[kind] ?? kind}</AppText><Icon name="x" size={12} color="#fff" /></Pressable> : null}
        <Pressable onPress={() => setCity(undefined)} style={[st.fchip, !city && !parsedCity && st.fchipOn]}><AppText variant="small" color={!city && !parsedCity ? '#fff' : brand.text} style={{ fontFamily: font.semibold }}>{t('كل المدن')}</AppText></Pressable>
        {[...new Set([city, parsedCity, user?.city, ...TOP_CITIES].filter(Boolean) as string[])].slice(0, 8).map((c) => {
          const on = city === c || (!city && parsedCity === c);
          return <Pressable key={c} onPress={() => setCity(city === c ? undefined : c)} style={[st.fchip, on && st.fchipOn]}><AppText variant="small" color={on ? '#fff' : brand.text} style={{ fontFamily: font.semibold }}>{cityName(c)}</AppText></Pressable>;
        })}
      </ScrollView>
      {k ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 10 }}>
          {tabs.map(([tb, label, n]) => <Chip key={tb} label={`${label}${n ? ' ' + n : ''}`} on={tab === tb} onPress={() => setTab(tb)} />)}
        </ScrollView>
      ) : kind ? (
        <View style={st.secRow}><AppText variant="section">{KIND_NAME[kind] ?? kind}{city ? ' ' + t('في {city}', { city: cityName(city) }) : ' ' + t('في كل المدن')}</AppText><AppText variant="small" muted>{res.places.length}</AppText></View>
      ) : near ? <View style={st.secRow}><AppText variant="section">{t('قريب منك')}</AppText><AppText variant="small" muted>{t('{n} مكان', { n: res.places.length })}</AppText></View> : null}
      {res.relaxed && k ? <View style={st.relaxed}><Icon name="info" size={16} color={brand.orangeInk} /><AppText variant="small" color={brand.orangeInk} style={{ flex: 1 }}>{t('ما لقينا تطابق كامل لـ«{q}»، هذي أقرب النتائج.', { q: k })}</AppText></View> : null}
    </View>
  );

  const foot = k.length > 1 && !busy && !addMode ? (
    <Pressable style={st.suggest} onPress={() => router.push({ pathname: '/suggest', params: { q: k, ...(city ? { city } : {}) } })}>
      <Icon name="plus" size={18} color={brand.green} />
      <View style={{ flex: 1 }}><AppText style={{ fontFamily: font.semibold }}>{t('ما لقيت المكان اللي تدوره؟')}</AppText><AppText variant="small" muted>{t('أضفه للدليل وخذ 15 نقطة')}</AppText></View>
      <Icon name="chevron" size={16} color={brand.faint} />
    </Pressable>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10 }}>
      <View style={st.bar}>
        <View style={st.field}>
          <Icon name="search" color={brand.purple} size={20} strokeWidth={2.2} />
          <TextInput ref={input} value={q} onChangeText={setQ} onSubmitEditing={() => remember(q)} autoFocus={!params.kind && params.near !== '1' && !addMode} placeholder={t('مطعم بحري في جدة، مقهى، العلا...')} placeholderTextColor={brand.faint} style={st.input} returnKeyType="search" />
          {q ? <Pressable onPress={() => { setQ(''); input.current?.focus(); }} hitSlop={10} accessibilityLabel={t('امسح')}><View style={st.clear}><Icon name="x" size={12} color="#fff" /></View></Pressable> : null}
        </View>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}><AppText style={{ fontFamily: font.semibold }} color={brand.purple}>{t('إلغاء')}</AppText></Pressable>
      </View>
      {browsing ? browse : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          ListHeaderComponent={filters}
          ListFooterComponent={foot}
          ListEmptyComponent={busy ? <Loading /> : msg ? <Empty title={msg} /> : k.length > 1 ? <Empty title={t('ما لقينا «{q}»', { q: k })} sub={city ? t('جرّب تشيل فلتر {city}، أو اكتبها بطريقة ثانية.', { city: cityName(city) }) : t('جرّب كلمة ثانية أو اسم المدينة.')} /> : <Empty title={t('ما فيه أماكن هنا للحين')} />}
          contentContainerStyle={{ paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>{item.el}</View>}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  field: { flex: 1, height: 54, backgroundColor: brand.card, borderWidth: 2, borderColor: brand.lilac, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: brand.text, textAlign: INPUT_START, minWidth: 0, outlineStyle: 'none' } as never,
  clear: { width: 22, height: 22, borderRadius: 11, backgroundColor: brand.faint, alignItems: 'center', justifyContent: 'center' },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: brand.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  pop: { backgroundColor: brand.softPurple, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingTop: 8, rowGap: 12 },
  kindCell: { width: '25%', alignItems: 'center', gap: 6 },
  kindIc: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  nearCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderRadius: 20, padding: 12, marginHorizontal: 16, marginTop: 18 },
  fchip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: brand.card, borderRadius: 999, paddingHorizontal: 14, height: 36, borderWidth: 1, borderColor: brand.line },
  fchipOn: { backgroundColor: brand.ink, borderColor: brand.ink },
  relaxed: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: brand.softOrange, borderRadius: 14, padding: 10, marginHorizontal: 16, marginTop: 12 },
  cityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.purple, borderRadius: 20, padding: 12 },
  aiCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: brand.softPurple, borderRadius: 16, paddingHorizontal: 14, height: 48 },
  add: { backgroundColor: brand.orange, borderRadius: 12, paddingHorizontal: 12, height: 36, justifyContent: 'center', alignItems: 'center', minWidth: 56 },
  qa: { backgroundColor: brand.card, borderRadius: 18, padding: 14, gap: 4 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderRadius: 20, padding: 14, marginHorizontal: 16, marginTop: 18, borderWidth: 1.5, borderColor: brand.line, borderStyle: 'dashed' },
});
