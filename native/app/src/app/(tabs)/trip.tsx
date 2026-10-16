import { useState } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui';
import { cityName, getPlacesByIds } from '@/lib/content';
import { encodeTrip, trip, tripDayDate, useTrip } from '@/lib/trip';
import { DateStrip } from '@/components/DateStrip';
import { env } from '@/config/env';
import { useAsync } from '@/lib/useAsync';
import { brand, font, kindStyle, photos } from '@/theme/tokens';
import { isEn, t, tr } from '@/lib/i18n';

type Stop = { id?: number; time: string; title: string; sub: string; img: ImageSource | string; drive?: string };
const SLOT = [t('9:00 ص · الصباح'), t('1:00 م · الظهر'), t('4:30 م · العصر'), t('7:30 م · المساء')];
const STEP = [brand.orange, brand.pink, brand.sky, brand.lilac];

/** رحلة تجريبية (نفس التصميم) تظهر لين يحفظ المستخدم أماكنه */
const DEMO: Stop[][] = [
  [
    { time: tr('4:30 م · الغروب', '4:30 PM · Sunset'), title: tr('صخرة الفيل', 'Elephant Rock'), sub: tr('معالم · ساعة ونص', 'Sights · 1.5 hours'), img: photos.rock, drive: tr('12 دقيقة بالسيارة', '12 min drive') },
    { time: tr('7:00 م · عشاء', '7:00 PM · Dinner'), title: tr('مطعم مرايا', 'Maraya Restaurant'), sub: tr('مطاعم · يحتاج حجز', 'Restaurants · Booking needed'), img: photos.sea, drive: tr('20 دقيقة بالسيارة', '20 min drive') },
    { time: tr('9:30 م · فعالية', '9:30 PM · Event'), title: tr('مشاهدة النجوم في غرابيلة', 'Stargazing at Gharameel'), sub: tr('تذكرة · 2 شخص', 'Ticket · 2 people'), img: photos.fest },
  ],
  [{ time: tr('8:00 ص · الشروق', '8:00 AM · Sunrise'), title: tr('البلدة القديمة', 'AlUla Old Town'), sub: tr('تراث · ساعتين', 'Heritage · 2 hours'), img: photos.heritage }],
  [{ time: tr('10:00 ص', '10:00 AM'), title: tr('مزرعة فيرنا', 'Verna Farm'), sub: tr('تجارب · فطور مزرعة', 'Experiences · Farm breakfast'), img: photos.land }],
];

export default function TripScreen() {
  const insets = useSafeAreaInsets();
  const { ids, days: tripDays, start } = useTrip();
  const [dateOpen, setDateOpen] = useState(false);
  const { data: places } = useAsync(() => getPlacesByIds(ids), [ids.join(',')]);
  const byId = new Map((places ?? []).map((p) => [p.id, p]));
  const [day, setDay] = useState(0);

  const real = (places ?? []).length > 0;
  // كل يوم بأماكنه مثل ما رتّبها المستخدم
  const days: Stop[][] = real
    ? tripDays.map((d) => d.map((id) => byId.get(id)).filter(Boolean).map((p, i) => ({ id: p!.id, time: SLOT[i % SLOT.length], title: p!.title, sub: p!.cat, img: p!.thumb || p!.image || photos.heritage })))
    : DEMO;
  const city = real ? cityName(places![0].city) : tr('العلا', 'AlUla');
  const total = days.reduce((n, d) => n + d.length, 0);
  const cur = days[Math.min(day, days.length - 1)] ?? [];
  const stopMenu = (id: number, title: string) => {
    const d = Math.min(day, days.length - 1);
    Alert.alert(title, undefined, [
      ...days.map((_, i) => i).filter((i) => i !== d).slice(0, 4).map((i) => ({ text: t('انقله لليوم {n}', { n: i + 1 }), onPress: () => trip.moveToDay(id, i) })),
      { text: t('قدّمه'), onPress: () => trip.move(id, -1) },
      { text: t('أخّره'), onPress: () => trip.move(id, 1) },
      { text: t('شيله من الرحلة'), style: 'destructive' as const, onPress: () => trip.remove(id) },
      { text: t('إلغاء'), style: 'cancel' as const },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 130 }}>
      <View style={st.hero}>
        <Image source={real ? places![0].image || places![0].thumb : photos.land} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(32,22,54,0.15)', 'rgba(32,22,54,0.9)']} style={StyleSheet.absoluteFill} />
        <View style={[st.heroTop, { top: insets.top + 10 }]}>
          <View style={st.glassPill}><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color="#fff">{t('رحلاتي · {n}', { n: real ? 1 : 3 })}</AppText></View>
          <Pressable style={st.glassPill} onPress={() => { const msg = t('رحلتي إلى {city} على دليل السعودية', { city }); const url = real ? `${env.siteUrl}/plan/${encodeTrip(tripDays)}${start ? '?s=' + start : ''}` : ''; Share.share(url ? { message: `${msg}\n${url}`, url } : { message: msg }).catch(() => {}); }}>
            <Icon name="share" color="#fff" size={16} /><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color="#fff">{t('شارك مع الشلة')}</AppText>
          </Pressable>
        </View>
        <View style={st.heroTx}>
          {real ? (
            <Pressable onPress={() => setDateOpen(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
              <Icon name="calendar" color="#F9A158" size={15} />
              <AppText style={{ fontFamily: font.semibold, fontSize: 13.5 }} color="#F9A158">{start ? (days.length > 1 ? `${tripDayDate(start, 0, isEn, false)} – ${tripDayDate(start, days.length - 1, isEn, false)}` : tripDayDate(start, 0, isEn)) : t('حدد تاريخ الرحلة')}</AppText>
            </Pressable>
          ) : <AppText style={{ fontFamily: font.semibold, fontSize: 13.5 }} color="#F9A158">{t('بعد 9 أيام · 22–24 أكتوبر')}</AppText>}
          <AppText variant="hero" color="#fff">{real ? t('رحلتي إلى {city}', { city }) : t('ويكند العلا')}</AppText>
          <AppText variant="small" color="#E2DAEE">{t('{n} أيام', { n: days.length })}   ·   {t('{n} مكان', { n: total })}{real ? '' : `   ·   ${t('24° نهاراً')}`}</AppText>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            {(real ? [] : [[tr('ر', 'R'), brand.lilac], [tr('ع', 'A'), brand.pink], [tr('م', 'M'), brand.sky]]).map(([t, c], i) => <View key={t} style={{ marginRight: i ? -8 : 0 }}><Avatar t={t} c={c} size={32} /></View>)}
          </View>
        </View>
      </View>

      {!real ? (
        <View style={st.demo}><Icon name="info" color={brand.purple} size={18} /><AppText variant="small" style={{ flex: 1 }} color={brand.purple}>{t('هذي رحلة تجريبية. اضغط القلب على أي مكان، أو خلّ الدليل يرتب لك رحلة من «خطط لي» تحت.')}</AppText></View>
      ) : null}

      <View style={st.days}>
        {days.map((_, i) => (
          <Pressable key={i} onPress={() => setDay(i)} onLongPress={() => real && days.length > 1 && Alert.alert(t('اليوم {n}', { n: i + 1 }), t('تشيل هاليوم؟ أماكنه تنتقل لليوم اللي قبله.'), [{ text: t('إلغاء'), style: 'cancel' }, { text: t('شيل اليوم'), style: 'destructive', onPress: () => { trip.removeDay(i); setDay(Math.max(0, i - 1)); } }])} style={[st.day, i === day && st.dayOn]}>
            <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color={i === day ? '#fff' : brand.text} center>{t('اليوم {n}', { n: i + 1 })}</AppText>
            <AppText variant="tiny" color={i === day ? '#E2DAEE' : brand.muted} center>{real ? (start ? tripDayDate(start, i, isEn) : t('{n} أماكن', { n: days[i].length })) : [t('الخميس 22'), t('الجمعة 23'), t('السبت 24')][i]}</AppText>
          </Pressable>
        ))}
      {real && days.length < 7 ? (
          <Pressable onPress={() => { const n = trip.addDay(); setDay(n); }} style={[st.day, st.dayAdd]} accessibilityLabel={t('أضف يوم')}>
            <AppText style={{ fontFamily: font.bold, fontSize: 18 }} color={brand.purple} center>+</AppText>
            <AppText variant="tiny" color={brand.purple} center>{t('يوم')}</AppText>
          </Pressable>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        {cur.map((s, i) => (
          <View key={i}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={[st.num, { backgroundColor: STEP[i % 4] }]}><AppText style={{ fontFamily: font.bold }} color="#fff">{i + 1}</AppText></View>
              <Pressable style={st.stop} onPress={() => s.id && router.push(`/place/${s.id}`)} onLongPress={() => s.id && stopMenu(s.id, s.title)}>
                <Image source={s.img} style={st.stopImg} contentFit="cover" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="tiny" color={brand.orangeDeep} style={{ fontFamily: font.semibold }}>{s.time}</AppText>
                  <AppText style={{ fontFamily: font.bold, fontSize: 16 }} numberOfLines={1}>{s.title}</AppText>
                  <AppText variant="small" muted numberOfLines={1}>{s.sub}</AppText>
                </View>
                {real && s.id ? <Pressable hitSlop={10} onPress={() => stopMenu(s.id!, s.title)} accessibilityLabel={t('خيارات')}><AppText muted style={{ fontFamily: font.bold, fontSize: 18, paddingHorizontal: 4 }}>···</AppText></Pressable> : null}
              </Pressable>
            </View>
            {i < cur.length - 1 ? (
              <View style={st.drive}><View style={st.line} /><AppText variant="tiny" muted>{s.drive ?? t('بالسيارة')}</AppText></View>
            ) : null}
          </View>
        ))}
        <Pressable style={st.add} onPress={() => router.push({ pathname: '/search', params: { add: 'trip', day: String(Math.min(day, days.length - 1)), ...(real ? { city: places![0].city } : {}) } })}>
          <AppText style={{ fontFamily: font.semibold }} color={brand.purple}>{tr(`+ أضف مكان لليوم ${['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'][day] ?? day + 1}`, `+ Add a place to day ${day + 1}`)}</AppText>
        </Pressable>
        <View style={st.tip}>
          <View style={st.tipIcon}><Icon name="spark" color="#fff" size={22} /></View>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontFamily: font.bold }} color="#fff">{t('خلّ الدليل يرتبها لك')}</AppText>
            <AppText variant="small" color="#CFC6DE">{t('اختر المدينة وكم يوم ووش تحب، ونرتب لك الأماكن يوم بيوم')}</AppText>
          </View>
          <Pressable style={st.tipBtn} onPress={() => router.push({ pathname: '/planner', params: real ? { city: places![0].city } : {} })}><AppText style={{ fontFamily: font.bold, fontSize: 13 }}>{t('خطط لي')}</AppText></Pressable>
        </View>
      </View>

      {/* تاريخ الرحلة: أول يوم، والباقي ينحسب منه */}
      <Modal visible={dateOpen} transparent animationType="slide" onRequestClose={() => setDateOpen(false)}>
        <Pressable style={st.sheetBg} onPress={() => setDateOpen(false)} />
        <View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <AppText style={{ fontFamily: font.bold, fontSize: 18, paddingHorizontal: 20 }}>{t('متى أول يوم في رحلتك؟')}</AppText>
          <AppText variant="small" muted style={{ paddingHorizontal: 20, marginTop: 2 }}>{t('نكتب تاريخ كل يوم، ونذكرك قبل الرحلة بيوم.')}</AppText>
          <DateStrip value={start} onChange={(d) => { trip.setStart(d); setDateOpen(false); }} />
          {start ? <Pressable onPress={() => { trip.setStart(''); setDateOpen(false); }} style={{ alignSelf: 'center', marginTop: 14 }}><AppText variant="small" color={brand.pinkDeep} style={{ fontFamily: font.semibold }}>{t('شيل التاريخ')}</AppText></Pressable> : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out.length ? out : [[]];
}

const st = StyleSheet.create({
  sheetBg: { flex: 1, backgroundColor: 'rgba(20,16,36,0.45)' },
  sheet: { backgroundColor: brand.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20 },
  hero: { height: 330, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden', backgroundColor: brand.ink },
  heroTop: { position: 'absolute', right: 16, left: 16, flexDirection: 'row', justifyContent: 'space-between' },
  glassPill: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  heroTx: { position: 'absolute', right: 20, left: 20, bottom: 22 },
  demo: { marginHorizontal: 16, marginTop: 14, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: brand.softPurple, borderRadius: 16, padding: 12 },
  days: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 16 },
  day: { flex: 1, backgroundColor: brand.card, borderRadius: 18, paddingVertical: 10 },
  dayAdd: { flex: 0, flexGrow: 0, flexShrink: 0, width: 64, minWidth: 64, backgroundColor: brand.softPurple, borderWidth: 1.5, borderStyle: 'dashed', borderColor: brand.lilac },
  dayOn: { backgroundColor: brand.purple },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  stop: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: brand.card, borderRadius: 22, padding: 10 },
  stopImg: { width: 74, height: 74, borderRadius: 16 },
  drive: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 15, paddingVertical: 6 },
  line: { width: 2, height: 26, backgroundColor: brand.line },
  add: { marginTop: 14, height: 54, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#CFC6DE', alignItems: 'center', justifyContent: 'center' },
  tip: { marginTop: 14, backgroundColor: brand.ink, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  tipBtn: { backgroundColor: brand.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
});
