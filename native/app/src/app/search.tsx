import { useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { HeartButton } from '@/components/HeartButton';
import { Icon } from '@/components/Icon';
import { Empty, Loading } from '@/components/State';
import { Badge, Chip, ImageRow } from '@/components/ui';
import { cityName, getCityPlaces, kindPlaces, nearby, search, weeklyPicks } from '@/lib/content';
import { trip, useTrip } from '@/lib/trip';
import type { Place } from '@/lib/types';
import { brand, font, kindStyle, START, INPUT_START } from '@/theme/tokens';

const KIND_NAME: Record<string, string> = { food: 'مطاعم', cafe: 'مقاهي', sights: 'معالم', heritage: 'تراث', nature: 'طبيعة', islamic: 'معالم إسلامية', fun: 'ترفيه', shopping: 'تسوق' };
const TABS = ['الكل', 'أماكن', 'كوبونات', 'فعاليات', 'أسئلة'];

/** البحث — مثل التصميم: الحقل فوق، تبويبات النتائج، الأماكن، وكوبون ومن المجتمع */
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ near?: string; kind?: string; q?: string; city?: string; add?: string; day?: string }>();
  const addMode = params.add === 'trip';
  const { ids: tripIds } = useTrip();
  const [sugg, setSugg] = useState<Place[]>([]);
  const [q, setQ] = useState(params.q ?? '');
  const [kind, setKind] = useState(params.kind);
  const [tab, setTab] = useState(0);
  const [list, setList] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (params.near !== '1') return;
    (async () => {
      setBusy(true);
      const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
      if (!perm?.granted) { setMsg('فعّل خدمة الموقع عشان نعرض لك الأماكن القريبة'); setBusy(false); return; }
      const pos = await Location.getCurrentPositionAsync({}).catch(() => null);
      if (pos) setList(await nearby(pos.coords.latitude, pos.coords.longitude, 30));
      setBusy(false);
    })();
  }, [params.near]);

  useEffect(() => {
    if (params.near === '1' && !q) return;
    const k = q.trim();
    if (!k) { setList(kind ? kindPlaces(kind) : []); return; }
    const t = setTimeout(async () => {
      setBusy(true);
      const r = await search(k).catch(() => []);
      setList(kind ? r.filter((p) => p.kinds.includes(kind)) : r);
      setBusy(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, kind, params.near]);

  // قبل ما يكتب: اقتراحات من مدينة رحلته، أو مختارات الأسبوع
  useEffect(() => {
    if (params.city) getCityPlaces(params.city).then((r) => setSugg(r.places.filter((p) => p.thumb || p.image).slice(0, 40))).catch(() => {});
    else setSugg(weeklyPicks());
  }, [params.city]);
  const empty = !q.trim() && !kind && params.near !== '1';
  const shown = empty ? sugg.filter((p) => !addMode || !tripIds.includes(p.id)) : list;
  const showExtras = false;
  const head = useMemo(() => (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 14 }}>
        {TABS.map((t, i) => <Chip key={t} label={empty ? t : i === 0 ? `${t} · ${list.length}` : i === 1 ? `${t} ${list.length}` : t} on={tab === i} onPress={() => setTab(i)} />)}
      </ScrollView>
      {kind ? (
        <View style={st.kindRow}>
          <Badge icon={(kindStyle[kind]?.icon ?? 'pin') as never} bg={kindStyle[kind]?.bg ?? brand.chip} fg={kindStyle[kind]?.fg ?? brand.purple} size={34} r={11} />
          <AppText style={{ fontFamily: font.bold, flex: 1 }}>{KIND_NAME[kind] ?? kind} في كل المدن</AppText>
          <Pressable onPress={() => setKind(undefined)}><AppText variant="small" color={brand.purple}>إزالة</AppText></Pressable>
        </View>
      ) : null}
      {empty && shown.length ? (
        <View style={st.secRow}><AppText variant="section">{params.city ? `اقتراحات في ${cityName(params.city)}` : 'مقترحة لك'}</AppText><AppText variant="small" muted>{addMode ? 'اضغط + عشان تضيف' : 'أو اكتب فوق'}</AppText></View>
      ) : list.length ? <View style={st.secRow}><AppText variant="section">أماكن</AppText><AppText variant="small" muted>{list.length} نتيجة</AppText></View> : null}
    </View>
  ), [list.length, tab, kind, empty, shown.length, params.city, addMode]);

  const foot = showExtras ? (
    <View>
      <View style={st.secRow}><AppText variant="section">كوبونات</AppText></View>
      <View style={st.coupon}>
        <Badge icon="ticket" bg="rgba(255,255,255,0.22)" fg="#fff" size={48} r={16} />
        <View style={{ flex: 1 }}><AppText variant="tiny" color="#fff">شريك الدليل</AppText><AppText style={{ fontFamily: font.bold, fontSize: 18 }} color="#fff">خصم 15% على الطلبات</AppText></View>
        <View style={st.save}><AppText variant="small" color={brand.pinkDeep} style={{ fontFamily: font.bold }}>احفظه</AppText></View>
      </View>
      <View style={st.secRow}><AppText variant="section">من المجتمع</AppText></View>
      <Pressable style={st.qa} onPress={() => router.push('/community')}>
        <AppText style={{ fontFamily: font.semibold }}>وش أفضل {q} للعائلة؟</AppText>
        <AppText variant="small" muted>12 إجابة · أفضل إجابة من <AppText variant="small" color={brand.purple} style={{ fontFamily: font.bold }}>منيرة</AppText> (مرشدة موثّقة)</AppText>
      </Pressable>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10 }}>
      <View style={st.bar}>
        <View style={st.field}>
          <Icon name="search" color={brand.purple} size={20} strokeWidth={2.2} />
          <TextInput value={q} onChangeText={setQ} autoFocus={!params.kind && params.near !== '1' && !addMode} placeholder="مكان، مدينة، مطعم، فعالية..." placeholderTextColor={brand.faint} style={st.input} returnKeyType="search" />
          <Icon name="mic" color={brand.lilac} size={20} />
        </View>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}><AppText style={{ fontFamily: font.semibold }} color={brand.purple}>إلغاء</AppText></Pressable>
      </View>
      <FlatList
        data={tab <= 1 ? shown : []}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={head}
        ListFooterComponent={foot}
        ListEmptyComponent={busy ? <Loading /> : msg ? <Empty title={msg} /> : q.trim().length > 1 ? <Empty title="ما لقينا نتيجة" sub="جرّب كلمة ثانية أو اسم المدينة. أو تعرف المكان وما هو في الدليل؟" action="أضف المكان للدليل (+15 نقطة)" onAction={() => router.push({ pathname: '/suggest', params: { q: q.trim() } })} /> : tab > 1 ? <Empty title="قريباً" sub="البحث في الكوبونات والفعاليات والأسئلة ينفتح مع المرحلة الجاية" /> : <Empty title="اكتب اسم مكان أو نوعه" sub="مثل: مطعم بحري، مقهى، العلا" />}
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <ImageRow img={item.thumb || undefined} cat={`${item.cat} · ${cityName(item.city)}`} catColor={kindStyle[item.kinds[0]]?.fg ?? brand.purple}
              title={item.title} sub={item.km != null ? `${item.km} كم` : item.summary}
              right={addMode ? (
                <Pressable onPress={() => (tripIds.includes(item.id) ? trip.remove(item.id) : trip.addTo(item.id, Number(params.day) || 0))} style={[st.add, tripIds.includes(item.id) && { backgroundColor: brand.green }]} accessibilityLabel="أضف لرحلتي">
                  <AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>{tripIds.includes(item.id) ? '✓' : '+ أضف'}</AppText>
                </Pressable>
              ) : <HeartButton id={item.id} />} onPress={() => router.push(`/place/${item.id}`)} />
          </View>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  field: { flex: 1, height: 54, backgroundColor: brand.card, borderWidth: 2, borderColor: brand.lilac, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: brand.text, textAlign: INPUT_START, minWidth: 0 },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 14, backgroundColor: brand.card, borderRadius: 16, padding: 10 },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  coupon: { marginHorizontal: 16, height: 86, borderRadius: 20, backgroundColor: brand.pink, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  add: { backgroundColor: brand.orange, borderRadius: 12, paddingHorizontal: 12, height: 36, justifyContent: 'center', alignItems: 'center', minWidth: 56 },
  save: { backgroundColor: brand.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  qa: { marginHorizontal: 16, backgroundColor: brand.card, borderRadius: 20, padding: 14 },
});
