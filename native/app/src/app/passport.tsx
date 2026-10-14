import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { BackButton } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ago } from '@/lib/community';
import { getPassport, type Passport as PassportData } from '@/lib/passport';
import { brand, font } from '@/theme/tokens';

const STAMPS = [
  ['المدينة المنورة', 'مارس 2024'], ['الرياض', 'يناير 2025'], ['جدة', 'يونيو 2025'], ['العلا', 'ديسمبر 2025'], ['مكة المكرمة', 'مارس 2026'],
  ['الطائف', 'يوليو 2026'], ['أبها', 'أغسطس 2026'], ['ينبع', 'سبتمبر 2026'], ['الدرعية', 'أكتوبر 2026'],
];
const LOCKED = ['تبوك', 'حائل', 'الباحة'];
const COLORS = [brand.orange, brand.lilac, brand.sky, brand.pink, brand.green, brand.purple, brand.orangeDeep, brand.skyDeep, brand.pinkDeep];

/** جواز السعودية — كل مدينة تزورها وتختم فيها مكان تنضاف هنا (الختم من صفحة المكان وأنت فيه) */
export default function Passport() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [pp, setPp] = useState<PassportData | null>(null);
  useFocusEffect(useCallback(() => { if (user) getPassport().then(setPp).catch(() => {}); }, [user?.id]));

  const demo = !user;
  const all = pp?.all ?? [];
  const visited = demo ? STAMPS.map(([c, d]) => ({ name: c, date: d })) : (pp?.cities ?? []).map((c) => ({ name: all.find((a) => a.id === c.id)?.name ?? c.id, date: monthYear(c.first) }));
  const locked = demo ? LOCKED : all.filter((a) => !(pp?.cities ?? []).some((c) => c.id === a.id)).map((a) => a.name);
  const n = visited.length, total = demo ? 21 : all.length || 21;
  const nextCity = demo ? 'تبوك ونيوم' : locked[0];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={[st.head, { paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><BackButton light /><AppText variant="title" color="#fff">جواز السعودية</AppText></View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 18 }}>
          <AppText style={{ fontFamily: font.bold, fontSize: 56, lineHeight: 66 }} color="#F9A158">{n}</AppText>
          <AppText style={{ fontFamily: font.bold, fontSize: 22 }} color="#CFC6DE">/ {total}</AppText>
        </View>
        <AppText color="#E2DAEE">{demo ? 'هذا مثال. سجّل دخولك وابدأ تختم جوازك.' : n ? `وجهة ختمتها. باقي ${total - n} وتكمل جوازك.` : 'للحين ما ختمت ولا وجهة. أول ما تزور مكان، افتح صفحته واضغط «اختم».'}</AppText>
        <View style={{ flexDirection: 'row', marginTop: 18 }}>
          {(demo ? [['4', 'مناطق'], ['63', 'مكان زرته'], ['9', 'أختام']] : [[String(n), 'مدن'], [String(pp?.places ?? 0), 'مكان زرته'], [String((pp?.places ?? 0) * 10 + n * 25), 'نقطة منها']]).map(([v, l]) => (
            <View key={l} style={{ flex: 1 }}><AppText style={{ fontFamily: font.bold, fontSize: 20 }} color="#fff" center>{v}</AppText><AppText variant="tiny" color="#CFC6DE" center>{l}</AppText></View>
          ))}
        </View>
      </View>
      {demo ? (
        <Pressable style={st.login} onPress={() => router.push('/login')}>
          <AppText style={{ fontFamily: font.bold, flex: 1 }} color="#fff">سجّل دخولك عشان يصير هذا جوازك</AppText>
          <View style={[st.btn, { backgroundColor: 'rgba(255,255,255,0.25)' }]}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#fff">دخول</AppText></View>
        </Pressable>
      ) : null}
      <View style={st.grid}>
        {visited.map(({ name, date }, i) => (
          <View key={name} style={st.cell}>
            <View style={[st.stamp, { borderColor: COLORS[i % COLORS.length], transform: [{ rotate: `${(i % 3 - 1) * 6}deg` }] }]}>
              <AppText style={{ fontFamily: font.bold, fontSize: 13, lineHeight: 18 }} color={COLORS[i % COLORS.length]} center>{name}</AppText>
              <AppText variant="tiny" color={COLORS[i % COLORS.length]} center>{date}</AppText>
            </View>
          </View>
        ))}
        {locked.map((c) => (
          <View key={c} style={st.cell}>
            <View style={[st.stamp, { borderColor: '#CFC6DE', borderStyle: 'dashed' }]}>
              <Icon name="lock" color="#B9B1CC" size={18} />
              <AppText variant="tiny" color={brand.faint} center>{c}</AppText>
            </View>
          </View>
        ))}
      </View>
      {!demo && pp?.recent.length ? (
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <AppText variant="section" style={{ paddingHorizontal: 4, paddingBottom: 4 }}>آخر زياراتك</AppText>
          {pp.recent.map((r) => (
            <Pressable key={r.id} style={st.visit} onPress={() => router.push(`/place/${r.id}`)}>
              <Icon name="pin" color={brand.pinkDeep} size={18} />
              <AppText style={{ flex: 1, fontFamily: font.semibold }} numberOfLines={1}>{r.title}</AppText>
              <AppText variant="tiny" muted>{ago(r.created)}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {nextCity ? (
        <View style={st.next}>
          <View style={{ flex: 1 }}>
            <AppText variant="tiny" color="#F9A158" style={{ fontFamily: font.bold }}>الختم الجاي؟</AppText>
            <AppText style={{ fontFamily: font.bold, fontSize: 18 }} color="#fff">{nextCity}</AppText>
            <AppText variant="small" color="#CFC6DE">خطط لها رحلة من الدليل</AppText>
          </View>
          <Pressable style={st.btn} onPress={() => router.push('/planner')}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#fff">خطط لها</AppText></Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthYear = (sec: number) => { const d = new Date(sec * 1000 + 3 * 3600e3); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

const st = StyleSheet.create({
  head: { backgroundColor: brand.ink, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, paddingTop: 18 },
  cell: { width: '33.33%', alignItems: 'center', paddingVertical: 8 },
  stamp: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, alignItems: 'center', justifyContent: 'center', padding: 8, backgroundColor: brand.card },
  next: { margin: 16, backgroundColor: brand.purple, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  login: { margin: 16, marginBottom: 0, backgroundColor: brand.orange, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  visit: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: brand.card, borderRadius: 16, padding: 12 },
  btn: { backgroundColor: brand.orange, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
});
