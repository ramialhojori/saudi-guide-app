import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { BackButton } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ago } from '@/lib/community';
import { checkIn, getPassport, type Passport as PassportData } from '@/lib/passport';
import { nearby } from '@/lib/content';
import { isEn, t, tr } from '@/lib/i18n';
import type { Place } from '@/lib/types';
import { brand, font } from '@/theme/tokens';

const STAMPS = [
  [t('المدينة المنورة'), t('مارس 2024')], [t('الرياض'), t('يناير 2025')], [t('جدة'), t('يونيو 2025')], [t('العلا'), t('ديسمبر 2025')], [t('مكة المكرمة'), t('مارس 2026')],
  [t('الطائف'), t('يوليو 2026')], [t('أبها'), t('أغسطس 2026')], [t('ينبع'), t('سبتمبر 2026')], [t('الدرعية'), t('أكتوبر 2026')],
];
const LOCKED = [t('تبوك'), t('حائل'), t('الباحة')];
const COLORS = [brand.orange, brand.lilac, brand.sky, brand.pink, brand.green, brand.purple, brand.orangeDeep, brand.skyDeep, brand.pinkDeep];

/** جواز السعودية — كل مدينة تزورها وتختم فيها مكان تنضاف هنا (الختم من صفحة المكان وأنت فيه) */
export default function Passport() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [pp, setPp] = useState<PassportData | null>(null);
  useFocusEffect(useCallback(() => { if (user) getPassport().then(setPp).catch(() => {}); }, [user?.id]));
  const [near, setNear] = useState<Place[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [msg, setMsg] = useState('');
  const [stamping, setStamping] = useState(0);
  // الأماكن القريبة منك اللي تقدر تختمها (أقل من 500 متر) أو قريبة تقدر تروح لها
  const findNear = async () => {
    setFinding(true); setMsg('');
    const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (!perm?.granted) { setMsg(t('نحتاج إذن الموقع عشان نعرف وش قريب منك. فعّله من الإعدادات.')); setFinding(false); return; }
    const pos = await Location.getCurrentPositionAsync({}).catch(() => null);
    if (!pos) { setMsg(t('ما قدرنا نحدد موقعك. جرّب مرة ثانية.')); setFinding(false); return; }
    const list = await nearby(pos.coords.latitude, pos.coords.longitude, 5).catch(() => []);
    setNear(list.slice(0, 8)); setFinding(false);
    if (!list.length) setMsg(t('ما فيه أماكن من الدليل قريبة منك (5 كم). خطط لرحلة وختمها هناك.'));
  };
  const stampHere = async (p: Place) => {
    setStamping(p.id);
    const r = await checkIn(p.id).catch(() => ({ ok: false as const, msg: t('صار خطأ، جرّب بعد شوي.') }));
    setStamping(0);
    if (!r.ok) return Alert.alert(t('ما انختم'), r.msg);
    if (r.already) return Alert.alert(t('مختوم من قبل'), t('هذا المكان موجود في جوازك.'));
    Alert.alert(r.newCity ? t('ختم جديد في جوازك!') : t('انضافت الزيارة'), t('+{n} نقطة\n\nكيف {place}؟ قيّمه الحين وخذ +3', { n: r.points ?? 0, place: p.title }), [
      { text: t('بعدين'), style: 'cancel' },
      { text: t('قيّم تجربتك'), onPress: () => router.push({ pathname: '/review/[id]', params: { id: String(p.id) } }) },
    ]);
    getPassport().then(setPp).catch(() => {});
  };

  const demo = !user;
  const all = pp?.all ?? [];
  const visited = demo ? STAMPS.map(([c, d]) => ({ name: c, date: d })) : (pp?.cities ?? []).map((c) => ({ name: all.find((a) => a.id === c.id)?.name ?? c.id, date: monthYear(c.first) }));
  const locked = demo ? LOCKED : all.filter((a) => !(pp?.cities ?? []).some((c) => c.id === a.id)).map((a) => a.name);
  const n = visited.length, total = demo ? 21 : all.length || 21;
  const nextCity = demo ? t('تبوك ونيوم') : locked[0];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={[st.head, { paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><BackButton light /><AppText variant="title" color="#fff">{t('جواز السعودية')}</AppText></View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 18 }}>
          <AppText style={{ fontFamily: font.bold, fontSize: 56, lineHeight: 66 }} color="#F9A158">{n}</AppText>
          <AppText style={{ fontFamily: font.bold, fontSize: 22 }} color="#CFC6DE">/ {total}</AppText>
        </View>
        <AppText color="#E2DAEE">{demo ? t('هذا مثال. سجّل دخولك وابدأ تختم جوازك.') : n ? t('وجهة ختمتها. باقي {n} وتكمل جوازك.', { n: total - n }) : t('للحين ما ختمت ولا وجهة. أول ما تزور مكان، افتح صفحته واضغط «اختم».')}</AppText>
        <View style={{ flexDirection: 'row', marginTop: 18 }}>
          {(demo ? [['4', t('مناطق')], ['63', t('مكان زرته')], ['9', t('أختام')]] : [[String(n), t('مدن')], [String(pp?.places ?? 0), t('مكان زرته')], [String((pp?.places ?? 0) * 10 + n * 25), t('نقطة منها')]]).map(([v, l]) => (
            <View key={l} style={{ flex: 1 }}><AppText style={{ fontFamily: font.bold, fontSize: 20 }} color="#fff" center>{v}</AppText><AppText variant="tiny" color="#CFC6DE" center>{l}</AppText></View>
          ))}
        </View>
      </View>
      {demo ? (
        <Pressable style={st.login} onPress={() => router.push('/login')}>
          <AppText style={{ fontFamily: font.bold, flex: 1 }} color="#fff">{t('سجّل دخولك عشان يصير هذا جوازك')}</AppText>
          <View style={[st.btn, { backgroundColor: 'rgba(255,255,255,0.25)' }]}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#fff">{t('دخول')}</AppText></View>
        </Pressable>
      ) : null}
      {!demo ? (
        <View style={st.how}>
          <AppText style={{ fontFamily: font.bold, fontSize: 16 }}>{t('كيف أختم جوازي؟')}</AppText>
          {[['pin', t('روح لأي مكان موجود في الدليل')], ['flag', t('وأنت هناك، افتح صفحته واضغط «اختم» (لازم تكون على بعد أقل من 500 متر)')], ['star', t('كل زيارة +10 نقاط، وأول ختم في مدينة جديدة +25')]].map(([i, txt]) => (
            <View key={txt} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8 }}>
              <View style={st.howIcon}><Icon name={i as 'pin'} color={brand.orangeDeep} size={16} /></View>
              <AppText variant="small" style={{ flex: 1, lineHeight: 21 }}>{txt}</AppText>
            </View>
          ))}
          {near === null ? (
            <Pressable style={st.find} onPress={findNear} disabled={finding}>
              {finding ? <ActivityIndicator color="#fff" /> : <AppText style={{ fontFamily: font.bold }} color="#fff">{t('وش أقدر أختم قريب مني؟')}</AppText>}
            </Pressable>
          ) : null}
          {msg ? <AppText variant="small" muted style={{ marginTop: 8 }}>{msg}</AppText> : null}
          {(near ?? []).map((p) => {
            const here = (p.km ?? 99) <= 0.5;
            return (
              <Pressable key={p.id} style={st.nearRow} onPress={() => router.push(`/place/${p.id}`)}>
                {p.thumb ? <Image source={p.thumb} style={st.nearImg} contentFit="cover" /> : <View style={[st.nearImg, { backgroundColor: brand.chip }]} />}
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontFamily: font.semibold, fontSize: 14 }} numberOfLines={1}>{p.title}</AppText>
                  <AppText variant="tiny" muted>{p.cat} · {p.km != null ? (p.km < 1 ? Math.round(p.km * 1000) + tr(' م', ' m') : p.km + tr(' كم', ' km')) : ''}</AppText>
                </View>
                {here ? (
                  <Pressable style={st.stampBtn} onPress={() => stampHere(p)} disabled={!!stamping}>
                    {stamping === p.id ? <ActivityIndicator color="#fff" /> : <AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>{t('اختم')}</AppText>}
                  </Pressable>
                ) : <AppText variant="tiny" color={brand.link} style={{ fontFamily: font.semibold }}>{t('قرّب منه')}</AppText>}
              </Pressable>
            );
          })}
        </View>
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
          <AppText variant="section" style={{ paddingHorizontal: 4, paddingBottom: 4 }}>{t('آخر زياراتك')}</AppText>
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
            <AppText variant="tiny" color="#F9A158" style={{ fontFamily: font.bold }}>{t('الختم الجاي؟')}</AppText>
            <AppText style={{ fontFamily: font.bold, fontSize: 18 }} color="#fff">{nextCity}</AppText>
            <AppText variant="small" color="#CFC6DE">{t('خطط لها رحلة من الدليل')}</AppText>
          </View>
          <Pressable style={st.btn} onPress={() => router.push('/planner')}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#fff">{t('خطط لها')}</AppText></Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const MONTHS = isEn ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] : ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthYear = (sec: number) => { const d = new Date(sec * 1000 + 3 * 3600e3); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

const st = StyleSheet.create({
  head: { backgroundColor: brand.ink, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, paddingTop: 18 },
  cell: { width: '33.33%', alignItems: 'center', paddingVertical: 8 },
  stamp: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, alignItems: 'center', justifyContent: 'center', padding: 8, backgroundColor: brand.card },
  how: { margin: 16, marginBottom: 0, backgroundColor: brand.card, borderRadius: 22, padding: 16 },
  howIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: brand.softOrange, alignItems: 'center', justifyContent: 'center' },
  find: { marginTop: 14, height: 48, borderRadius: 14, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  nearRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: brand.chip, marginTop: 6 },
  nearImg: { width: 46, height: 46, borderRadius: 12 },
  stampBtn: { backgroundColor: brand.orange, borderRadius: 12, paddingHorizontal: 16, height: 36, justifyContent: 'center', minWidth: 60, alignItems: 'center' },
  next: { margin: 16, backgroundColor: brand.purple, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  login: { margin: 16, marginBottom: 0, backgroundColor: brand.orange, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  visit: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: brand.card, borderRadius: 16, padding: 12 },
  btn: { backgroundColor: brand.orange, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
});
