import { useState } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui';
import { cityName, getPlacesByIds } from '@/lib/content';
import { useTrip } from '@/lib/trip';
import { useAsync } from '@/lib/useAsync';
import { brand, font, kindStyle, photos } from '@/theme/tokens';

type Stop = { id?: number; time: string; title: string; sub: string; img: ImageSource | string; drive?: string };
const SLOT = ['9:00 ص · الصباح', '1:00 م · الظهر', '4:30 م · العصر', '7:30 م · المساء'];
const STEP = [brand.orange, brand.pink, brand.sky, brand.lilac];

/** رحلة تجريبية (نفس التصميم) تظهر لين يحفظ المستخدم أماكنه */
const DEMO: Stop[][] = [
  [
    { time: '4:30 م · الغروب', title: 'صخرة الفيل', sub: 'معالم · ساعة ونص', img: photos.rock, drive: '12 دقيقة بالسيارة' },
    { time: '7:00 م · عشاء', title: 'مطعم مرايا', sub: 'مطاعم · يحتاج حجز', img: photos.sea, drive: '20 دقيقة بالسيارة' },
    { time: '9:30 م · فعالية', title: 'مشاهدة النجوم في غرابيلة', sub: 'تذكرة · 2 شخص', img: photos.fest },
  ],
  [{ time: '8:00 ص · الشروق', title: 'البلدة القديمة', sub: 'تراث · ساعتين', img: photos.heritage }],
  [{ time: '10:00 ص', title: 'مزرعة فيرنا', sub: 'تجارب · فطور مزرعة', img: photos.land }],
];

export default function TripScreen() {
  const insets = useSafeAreaInsets();
  const { ids } = useTrip();
  const { data: places } = useAsync(() => getPlacesByIds(ids), [ids.join(',')]);
  const [day, setDay] = useState(0);

  const real = (places ?? []).length > 0;
  const days: Stop[][] = real
    ? chunk(places!.map((p, i) => ({ id: p.id, time: SLOT[i % 3], title: p.title, sub: p.cat, img: p.thumb || p.image || photos.heritage })), 3)
    : DEMO;
  const city = real ? cityName(places![0].city) : 'العلا';
  const total = days.reduce((n, d) => n + d.length, 0);
  const cur = days[Math.min(day, days.length - 1)] ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 130 }}>
      <View style={st.hero}>
        <Image source={real ? places![0].image || places![0].thumb : photos.land} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(32,22,54,0.15)', 'rgba(32,22,54,0.9)']} style={StyleSheet.absoluteFill} />
        <View style={[st.heroTop, { top: insets.top + 10 }]}>
          <View style={st.glassPill}><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color="#fff">رحلاتي · {real ? 1 : 3}</AppText></View>
          <Pressable style={st.glassPill} onPress={() => Share.share({ message: `رحلتي إلى ${city} على دليل السعودية` }).catch(() => {})}>
            <Icon name="share" color="#fff" size={16} /><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color="#fff">شارك مع الشلة</AppText>
          </Pressable>
        </View>
        <View style={st.heroTx}>
          <AppText style={{ fontFamily: font.semibold, fontSize: 13.5 }} color="#F9A158">{real ? 'رحلتك الجاية' : 'بعد 9 أيام · 22–24 أكتوبر'}</AppText>
          <AppText variant="hero" color="#fff">{real ? `رحلتي إلى ${city}` : 'ويكند العلا'}</AppText>
          <AppText variant="small" color="#E2DAEE">{days.length} أيام   ·   {total} مكان{real ? '' : '   ·   24° نهاراً'}</AppText>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            {(real ? [] : [['ر', brand.lilac], ['ع', brand.pink], ['م', brand.sky]]).map(([t, c], i) => <View key={t} style={{ marginRight: i ? -8 : 0 }}><Avatar t={t} c={c} size={32} /></View>)}
          </View>
        </View>
      </View>

      {!real ? (
        <View style={st.demo}><Icon name="info" color={brand.purple} size={18} /><AppText variant="small" style={{ flex: 1 }} color={brand.purple}>هذي رحلة تجريبية. اضغط القلب على أي مكان، أو خلّ الدليل يرتب لك رحلة من «خطط لي» تحت.</AppText></View>
      ) : null}

      <View style={st.days}>
        {days.map((_, i) => (
          <Pressable key={i} onPress={() => setDay(i)} style={[st.day, i === day && st.dayOn]}>
            <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color={i === day ? '#fff' : brand.ink} center>اليوم {i + 1}</AppText>
            <AppText variant="tiny" color={i === day ? '#E2DAEE' : brand.muted} center>{real ? `${days[i].length} أماكن` : ['الخميس 22', 'الجمعة 23', 'السبت 24'][i]}</AppText>
          </Pressable>
        ))}
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        {cur.map((s, i) => (
          <View key={i}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={[st.num, { backgroundColor: STEP[i % 4] }]}><AppText style={{ fontFamily: font.bold }} color="#fff">{i + 1}</AppText></View>
              <Pressable style={st.stop} onPress={() => s.id && router.push(`/place/${s.id}`)}>
                <Image source={s.img} style={st.stopImg} contentFit="cover" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="tiny" color={brand.orangeDeep} style={{ fontFamily: font.semibold }}>{s.time}</AppText>
                  <AppText style={{ fontFamily: font.bold, fontSize: 16 }} numberOfLines={1}>{s.title}</AppText>
                  <AppText variant="small" muted numberOfLines={1}>{s.sub}</AppText>
                </View>
              </Pressable>
            </View>
            {i < cur.length - 1 ? (
              <View style={st.drive}><View style={st.line} /><AppText variant="tiny" muted>{s.drive ?? 'بالسيارة'}</AppText></View>
            ) : null}
          </View>
        ))}
        <Pressable style={st.add} onPress={() => router.push('/search')}>
          <AppText style={{ fontFamily: font.semibold }} color={brand.purple}>+ أضف مكان لليوم {['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'][day] ?? day + 1}</AppText>
        </Pressable>
        <View style={st.tip}>
          <View style={st.tipIcon}><Icon name="spark" color="#fff" size={22} /></View>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontFamily: font.bold }} color="#fff">خلّ الدليل يرتبها لك</AppText>
            <AppText variant="small" color="#CFC6DE">اختر المدينة وكم يوم ووش تحب، ونرتب لك الأماكن يوم بيوم</AppText>
          </View>
          <Pressable style={st.tipBtn} onPress={() => router.push({ pathname: '/planner', params: real ? { city: places![0].city } : {} })}><AppText style={{ fontFamily: font.bold, fontSize: 13 }}>خطط لي</AppText></Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out.length ? out : [[]];
}

const st = StyleSheet.create({
  hero: { height: 330, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden', backgroundColor: brand.ink },
  heroTop: { position: 'absolute', right: 16, left: 16, flexDirection: 'row', justifyContent: 'space-between' },
  glassPill: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  heroTx: { position: 'absolute', right: 20, left: 20, bottom: 22 },
  demo: { marginHorizontal: 16, marginTop: 14, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: brand.softPurple, borderRadius: 16, padding: 12 },
  days: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 16 },
  day: { flex: 1, backgroundColor: '#fff', borderRadius: 18, paddingVertical: 10 },
  dayOn: { backgroundColor: brand.purple },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  stop: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: 22, padding: 10 },
  stopImg: { width: 74, height: 74, borderRadius: 16 },
  drive: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 15, paddingVertical: 6 },
  line: { width: 2, height: 26, backgroundColor: brand.line },
  add: { marginTop: 14, height: 54, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#CFC6DE', alignItems: 'center', justifyContent: 'center' },
  tip: { marginTop: 14, backgroundColor: brand.ink, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  tipBtn: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
});
