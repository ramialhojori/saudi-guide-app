import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { BellButton } from '@/components/BellButton';
import { Avatar, Chip, Pill } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ago, feed, initial, nAnswers, thank, tint, topHelpers, type CPost } from '@/lib/community';
import { cityName } from '@/lib/content';
import { posts as samples, type Post } from '@/lib/mock';
import { api } from '@/lib/api';
import { brand, font, photos } from '@/theme/tokens';

const daysLeft = (end: string) => { const d = Math.ceil((new Date(end).getTime() - Date.now()) / 86400e3); return d <= 0 ? 'آخر يوم' : d === 1 ? 'باقي يوم' : d === 2 ? 'باقي يومين' : `باقي ${d} أيام`; };
const CITIES: [string | null, string][] = [[null, 'كل المدن'], ['medina', 'المدينة'], ['riyadh', 'الرياض'], ['jeddah', 'جدة'], ['makkah-region', 'مكة'], ['alula', 'العلا'], ['abha', 'أبها'], ['eastern-region', 'الشرقية']];

/** المجتمع — محتوى تجريبي لين يجهز سيرفر المجتمع (المرحلة 2) */
export default function Community() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [city, setCity] = useState<string | null>(null);
  const [list, setList] = useState<CPost[] | null>(null);
  const [top, setTop] = useState<{ id: string; name: string; answers: number; badge: string }[]>([]);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(true);
  type Ch = { title: string; prize: string; tag: string; photo: string; end: string; count: number };
  const [ch, setCh] = useState<Ch | null>(null);

  const load = useCallback(async (c: string | null) => {
    setBusy(true); setErr(false);
    try {
      const [p, t] = await Promise.all([feed({ city: c }), topHelpers(c).catch(() => [])]);
      setList(p); setTop(t); setMore(p.length >= 20);
      api<{ challenge: Ch | null }>('/v1/community/challenge').then((r) => setCh(r.challenge)).catch(() => {});
    } catch { setErr(true); setList((l) => l ?? []); } finally { setBusy(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(city); }, [city, load]));

  const loadMore = async () => {
    if (!list?.length || !more || busy) return;
    setBusy(true);
    try { const p = await feed({ city, before: list[list.length - 1].id }); setList([...list, ...p]); setMore(p.length >= 20); } catch {} finally { setBusy(false); }
  };
  const ask = () => router.push(user ? '/ask' : '/login');
  const cityLabel = CITIES.find((c) => c[0] === city)?.[1] ?? '';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 130 }}
      refreshControl={<RefreshControl refreshing={busy && !!list} onRefresh={() => load(city)} tintColor={brand.purple} />}
      onScroll={({ nativeEvent: e }) => { if (e.layoutMeasurement.height + e.contentOffset.y > e.contentSize.height - 400) loadMore(); }} scrollEventThrottle={400}>
      <View style={[st.head, { paddingTop: insets.top + 14 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <AppText variant="title" color="#fff" style={{ fontSize: 26, lineHeight: 36 }}>مجتمع الدليل</AppText>
            <AppText variant="small" color="#E2DAEE">اسأل أهل الديرة، وشارك اللي تعرفه</AppText>
          </View>
          <BellButton style={st.glass} />
        </View>
        <Pressable style={st.ask} onPress={ask}>
          <Avatar t={initial(user?.name || '؟')} c={brand.lilac} size={36} />
          <AppText muted style={{ flex: 1 }}>وش تبي تعرف عن السعودية؟</AppText>
          <View style={st.camBtn}><Icon name="cam" color={brand.pinkDeep} size={18} /></View>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16 }}>
        {CITIES.map(([id, n]) => <Chip key={n} label={n} on={id === city} color={brand.ink} onPress={() => { setCity(id); setList(null); }} />)}
      </ScrollView>

      {/* تحدي الأسبوع: يديره رامي من اللوحة */}
      {ch ? (
        <Pressable style={st.challenge} onPress={() => router.push(user ? { pathname: '/ask', params: { kind: 'photo', text: ch.tag ? `#${ch.tag} ` : '' } } : '/login')}>
          <View style={{ flex: 1, padding: 16, gap: 4 }}>
            <View style={st.chTag}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>تحدي الأسبوع</AppText></View>
            <AppText style={{ fontFamily: font.bold, fontSize: 18, lineHeight: 28 }} color="#fff">{ch.title}</AppText>
            {ch.prize ? <AppText variant="small" color="#FFF1E4">الجائزة: {ch.prize}</AppText> : null}
            <AppText variant="tiny" color="#FFE2C8">{[ch.end ? daysLeft(ch.end) : '', ch.count ? `${ch.count} مشاركة` : 'كن أول مشارك'].filter(Boolean).join(' · ')}</AppText>
          </View>
          {ch.photo ? <Image source={{ uri: ch.photo }} style={{ width: 130 }} contentFit="cover" /> : <Image source={photos.water} style={{ width: 130 }} contentFit="cover" />}
        </Pressable>
      ) : null}

      {list === null ? <ActivityIndicator color={brand.purple} style={{ marginTop: 40 }} /> : null}
      {err ? <AppText center muted style={{ marginTop: 20 }}>ما قدرنا نجيب المشاركات. اسحب لتحت وجرّب مرة ثانية.</AppText> : null}

      {list && list.length ? (
        <View style={{ gap: 14, paddingHorizontal: 16, paddingTop: 16 }}>
          {list.map((p) => <LivePost key={p.id} p={p} onChange={(x) => setList((l) => l!.map((y) => (y.id === x.id ? x : y)))} />)}
          {busy && more ? <ActivityIndicator color={brand.purple} /> : null}
        </View>
      ) : null}

      {list && !list.length && !err ? (
        <>
          <Pressable style={st.empty} onPress={ask}>
            <View style={st.emptyIcon}><Icon name="chat" color={brand.purple} size={28} /></View>
            <AppText style={{ fontFamily: font.bold, fontSize: 17 }} center>{city ? `ما أحد سأل عن ${cityLabel} للحين` : 'المجتمع ينتظر أول سؤال'}</AppText>
            <AppText variant="small" muted center>كن أول واحد يسأل أو يشارك نصيحة، وأهل الديرة يردّون عليك.</AppText>
            <View style={st.emptyBtn}><AppText color="#fff" style={{ fontFamily: font.bold }}>{user ? 'اكتب سؤالك' : 'سجّل واسأل'}</AppText></View>
          </Pressable>
          <AppText variant="small" muted style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 4, fontFamily: font.bold }}>أمثلة لشكل المجتمع لما يمتلي</AppText>
          <View style={{ gap: 14, paddingHorizontal: 16, paddingTop: 8, opacity: 0.75 }}>
            {samples.slice(0, 2).map((p) => <PostCard key={p.id} p={p} />)}
          </View>
        </>
      ) : null}

      {/* أبطال المدينة: أكثر ناس جاوبوا هالشهر */}
      {top.length ? (
        <View style={st.champs}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText style={{ fontFamily: font.bold, fontSize: 17 }} color="#fff">أبطال {city ? cityLabel : 'المجتمع'} هالشهر</AppText>
            <AppText variant="small" color="#F9A158">آخر 30 يوم</AppText>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', marginTop: 16 }}>
            {[top[1], top[0], top[2]].filter(Boolean).map((c) => {
              const first = c === top[0];
              return (
                <View key={c.id} style={{ alignItems: 'center', gap: 6 }}>
                  <View style={first ? st.ring1 : null}><Avatar t={initial(c.name)} c={tint(c.id)} size={first ? 64 : 50} /></View>
                  <AppText style={{ fontFamily: font.bold }} color="#fff">{c.name}</AppText>
                  <AppText variant="tiny" color={first ? '#F9A158' : '#CFC6DE'}>{c.answers} إجابة</AppText>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

/** مشاركة حقيقية من السيرفر */
export function LivePost({ p, onChange }: { p: CPost; onChange: (p: CPost) => void }) {
  const { user } = useAuth();
  const toggle = async () => {
    if (!user) return router.push('/login');
    if (p.mine) return;
    onChange({ ...p, thanked: !p.thanked, thanks: p.thanks + (p.thanked ? -1 : 1) });
    try { const r = await thank('p', p.id); onChange({ ...p, thanked: r.thanked, thanks: r.thanks }); } catch { onChange(p); }
  };
  const where = [p.author.city ? 'من ' + cityName(p.author.city) : '', ago(p.created)].filter(Boolean).join(' · ');
  return (
    <Pressable style={st.post} onPress={() => router.push(`/question/${p.id}`)}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, paddingBottom: 8 }}>
        <Avatar t={initial(p.author.name)} c={tint(p.author.id)} size={40} />
        <View style={{ flex: 1 }}>
          <AppText style={{ fontFamily: font.bold, fontSize: 14.5 }}>{p.author.name} <AppText variant="small" muted>· {where}</AppText></AppText>
          <AppText variant="tiny" color={p.kind === 'question' ? brand.skyDeep : brand.orangeDeep}>
            {p.kind === 'question' ? 'سؤال' : p.kind === 'tip' ? 'نصيحة' : 'صورة'}{p.city ? ' عن ' + cityName(p.city) : ''}
          </AppText>
        </View>
        {p.author.badge ? <Pill label={p.author.badge} bg={brand.softPink} fg={brand.pinkDeep} /> : null}
      </View>
      {p.photo ? <Image source={{ uri: p.photo }} style={{ height: 240, backgroundColor: brand.chip }} contentFit="cover" /> : null}
      <AppText style={{ fontFamily: p.kind === 'question' ? font.bold : font.regular, fontSize: p.kind === 'question' ? 16.5 : 14.5, lineHeight: 28, paddingHorizontal: 14, paddingTop: 10 }} numberOfLines={6}>{p.text}</AppText>
      {p.bestAnswer ? (
        <View style={st.best}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <AppText style={{ fontFamily: font.bold, fontSize: 13.5 }}>{p.bestAnswer.name}</AppText>
            {p.bestAnswer.badge ? <Pill label={p.bestAnswer.badge} bg={brand.purple} fg="#fff" /> : null}
            <AppText variant="tiny" color={brand.green} style={{ fontFamily: font.bold }}>· أفضل إجابة</AppText>
          </View>
          <AppText variant="small" style={{ lineHeight: 22, marginTop: 4 }} numberOfLines={3}>{p.bestAnswer.text}</AppText>
        </View>
      ) : null}
      <View style={st.actions}>
        <Pressable onPress={toggle} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name={p.thanked ? 'heartFill' : 'heart'} color={brand.pinkDeep} size={18} />
          <AppText variant="small" color={brand.pinkDeep} style={{ fontFamily: font.bold }}>شكراً{p.thanks ? ' · ' + p.thanks : ''}</AppText>
        </Pressable>
        <AppText variant="small" muted>{p.answers ? nAnswers(p.answers) : p.kind === 'question' ? 'كن أول من يجاوب' : 'علّق'}</AppText>
      </View>
    </Pressable>
  );
}

function PostCard({ p }: { p: Post }) {
  return (
    <View style={st.post}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, paddingBottom: 8 }}>
        <Avatar t={p.av} c={p.c} size={40} />
        <View style={{ flex: 1 }}>
          <AppText style={{ fontFamily: font.bold, fontSize: 14.5 }}>{p.who} <AppText variant="small" muted>· {p.where}</AppText></AppText>
          <AppText variant="tiny" color={brand.skyDeep}>{p.kind === 'question' ? 'سؤال عن المدينة المنورة' : p.when}</AppText>
        </View>
        {p.badge ? <Pill label={p.badge} bg={brand.softPink} fg={brand.pinkDeep} /> : null}
      </View>
      {p.photo ? <Image source={photos[p.photo]} style={{ height: 220 }} contentFit="cover" /> : null}
      <AppText style={{ fontFamily: p.kind === 'question' ? font.bold : font.regular, fontSize: p.kind === 'question' ? 16.5 : 14.5, lineHeight: 28, paddingHorizontal: 14, paddingTop: 10 }}>{p.text}</AppText>
      {p.best ? (
        <View style={st.best}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <AppText style={{ fontFamily: font.bold, fontSize: 13.5 }}>{p.best.who}</AppText>
            <Pill label={p.best.badge} bg={brand.purple} fg="#fff" />
            <AppText variant="tiny" color={brand.green} style={{ fontFamily: font.bold }}>· أفضل إجابة</AppText>
          </View>
          <AppText variant="small" style={{ lineHeight: 22, marginTop: 4 }}>{p.best.text}</AppText>
        </View>
      ) : null}
      <View style={st.actions}>
        {p.thanks ? <AppText variant="small" color={brand.pinkDeep} style={{ fontFamily: font.bold }}>شكراً · {p.thanks}</AppText> : null}
        {p.answers ? <AppText variant="small" muted>{p.answers} إجابات</AppText> : null}
        <AppText variant="small" muted>حفظ</AppText>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: brand.purple, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  glass: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  ask: { marginTop: 16, height: 60, backgroundColor: '#fff', borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  camBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: brand.softPink, alignItems: 'center', justifyContent: 'center' },
  challenge: { marginHorizontal: 16, height: 150, borderRadius: 24, overflow: 'hidden', backgroundColor: brand.orange, flexDirection: 'row' },
  chTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  post: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden' },
  best: { margin: 14, marginTop: 10, backgroundColor: brand.bg, borderRadius: 16, padding: 12, borderRightWidth: 3, borderRightColor: brand.purple },
  actions: { flexDirection: 'row', gap: 18, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  champs: { margin: 16, marginTop: 18, backgroundColor: brand.ink, borderRadius: 26, padding: 18 },
  empty: { margin: 16, marginBottom: 0, backgroundColor: '#fff', borderRadius: 24, padding: 22, alignItems: 'center', gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: brand.softPurple, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyBtn: { marginTop: 8, backgroundColor: brand.purple, borderRadius: 16, paddingHorizontal: 22, height: 46, justifyContent: 'center' },
  ring1: { borderWidth: 3, borderColor: brand.orange, borderRadius: 40, padding: 2 },
});

