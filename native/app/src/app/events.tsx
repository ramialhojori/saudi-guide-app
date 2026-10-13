import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Empty, Loading } from '@/components/State';
import { BackButton, Chip, Pill } from '@/components/ui';
import { cityName, getEvents } from '@/lib/content';
import { riyadhDate } from '@/lib/text';
import { useAsync } from '@/lib/useAsync';
import type { EventItem } from '@/lib/types';
import { brand, font, photos } from '@/theme/tokens';

const DAY = 86400e3;
const ksa = (d: Date | number) => new Date((typeof d === 'number' ? d : d.getTime()) + 3 * 3600e3);
const dayKey = (iso: string) => ksa(new Date(iso)).toISOString().slice(0, 10);
const WD = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const CATS = ['الكل', 'حفلات', 'عائلية', 'رياضة', 'معارض', 'مجانية'];

/** الفعاليات — مثل التصميم: أيام سريعة، أنواع، الأكثر طلباً، ومجموعة حسب اليوم */
export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading } = useAsync(getEvents, []);
  const [when, setWhen] = useState(0);
  const [cat, setCat] = useState(0);
  const now = Date.now();
  const today = ksa(now).toISOString().slice(0, 10), tomorrow = ksa(now + DAY).toISOString().slice(0, 10);
  const wd = ksa(now).getUTCDay(), toFri = (5 - wd + 7) % 7;
  const wk = [ksa(now + (toFri - 1) * DAY), ksa(now + toFri * DAY), ksa(now + (toFri + 1) * DAY)].map((d) => d.toISOString().slice(0, 10));

  const events = data ?? [];
  const on = (e: EventItem, k: string) => dayKey(e.start) <= k && dayKey(e.end || e.start) >= k;
  const counts = [events.length, events.filter((e) => on(e, today)).length, events.filter((e) => on(e, tomorrow)).length, events.filter((e) => wk.some((k) => on(e, k))).length];
  const shown = useMemo(() => {
    let l = events;
    if (when === 1) l = l.filter((e) => on(e, today));
    if (when === 2) l = l.filter((e) => on(e, tomorrow));
    if (when === 3) l = l.filter((e) => wk.some((k) => on(e, k)));
    if (cat > 0) l = l.filter((e) => (e.cats || []).join(' ').includes(CATS[cat].replace('ية', '')) || (cat === 5 && /مجان/.test(e.tickets || e.summary)));
    return l;
  }, [events, when, cat]);
  const top = shown[0];
  const groups = new Map<string, EventItem[]>();
  for (const e of shown.slice(1)) {
    const k = dayKey(e.start) < today ? today : dayKey(e.start);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 60 }}>
      <View style={st.head}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <AppText variant="title">الفعاليات</AppText>
          <AppText variant="small" muted>{events.length} فعالية قادمة في المملكة</AppText>
        </View>
      </View>

      <View style={st.whenRow}>
        {[['الكل', String(counts[0])], ['اليوم', String(counts[1])], ['بكرة', String(counts[2])], ['الويكند', String(counts[3])]].map(([l, n], i) => (
          <Pressable key={l} onPress={() => setWhen(i)} style={[st.when, when === i && { backgroundColor: brand.purple }]}>
            <AppText style={{ fontFamily: font.bold, fontSize: 15 }} color={when === i ? '#fff' : brand.ink} center>{l}</AppText>
            <AppText variant="tiny" color={when === i ? '#E2DAEE' : brand.muted} center>{n}</AppText>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
        {CATS.map((c, i) => <Chip key={c} label={c} on={cat === i} color={brand.ink} onPress={() => setCat(i)} />)}
      </ScrollView>

      {loading && !data ? <Loading /> : null}
      {!loading && !shown.length ? <Empty title="ما فيه فعاليات هنا" sub="جرّب يوم ثاني أو نوع ثاني" /> : null}

      {top ? (
        <Pressable style={st.top} onPress={() => router.push(`/event/${top.id}`)}>
          <Image source={top.image || top.thumb || photos.fest} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(32,22,54,0.05)', 'rgba(32,22,54,0.92)']} style={StyleSheet.absoluteFill} />
          <View style={st.dateBox}>
            <AppText style={{ fontFamily: font.bold, fontSize: 22, lineHeight: 26 }} center>{ksa(new Date(top.start)).getUTCDate()}</AppText>
            <AppText variant="tiny" center color={brand.pinkDeep}>{riyadhDate(top.start, false).split(' ')[1]}</AppText>
          </View>
          <View style={{ position: 'absolute', right: 16, left: 16, bottom: 14, gap: 2 }}>
            <Pill label="الأكثر طلباً" bg={brand.orange} fg="#fff" />
            <AppText style={{ fontFamily: font.bold, fontSize: 22, lineHeight: 32 }} color="#fff" numberOfLines={2}>{top.title}</AppText>
            <AppText variant="small" color="#E2DAEE" numberOfLines={1}>{top.address || (top.city ? cityName(top.city) : '')}{top.tickets ? ' · ' + top.tickets : ''}</AppText>
          </View>
        </Pressable>
      ) : null}

      {[...groups.entries()].map(([k, list]) => {
        const d = new Date(k + 'T00:00:00Z');
        const label = k === today ? 'اليوم' : k === tomorrow ? 'بكرة' : '';
        return (
          <View key={k}>
            <AppText style={{ fontFamily: font.bold, fontSize: 14, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }} color={brand.muted}>
              {label ? label + ' · ' : ''}{WD[d.getUTCDay()]} {riyadhDate(k + 'T00:00:00+03:00', false)}
            </AppText>
            <View style={{ gap: 10, paddingHorizontal: 16 }}>
              {list.map((e) => (
                <Pressable key={e.id} style={st.row} onPress={() => router.push(`/event/${e.id}`)}>
                  <Image source={e.thumb || e.image || photos.fest} style={st.rowImg} contentFit="cover" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="tiny" color={brand.pinkDeep} style={{ fontFamily: font.semibold }}>{(e.cats?.[0] ?? 'فعالية')} · {riyadhDate(e.start).split('·')[1]?.trim()}</AppText>
                    <AppText style={{ fontFamily: font.bold, fontSize: 15 }} numberOfLines={1}>{e.title}</AppText>
                    <AppText variant="small" muted numberOfLines={1}>{e.address || (e.city ? cityName(e.city) : '')}</AppText>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  whenRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  when: { flex: 1, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 8 },
  top: { marginHorizontal: 16, marginTop: 16, height: 260, borderRadius: 28, overflow: 'hidden', backgroundColor: brand.ink },
  dateBox: { position: 'absolute', top: 14, left: 14, width: 56, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 6 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 10 },
  rowImg: { width: 76, height: 76, borderRadius: 16 },
});
