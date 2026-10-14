import { useState } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { BackButton, Chip } from '@/components/ui';
import { kinds } from '@/lib/content';
import { makePlan, PACE, type Pace, type PlanStop } from '@/lib/planner';
import { trip } from '@/lib/trip';
import { brand, font, kindStyle, photos } from '@/theme/tokens';

const CITIES: [string, string][] = [['medina', 'المدينة المنورة'], ['riyadh', 'الرياض'], ['jeddah', 'جدة'], ['makkah-region', 'مكة المكرمة'], ['alula', 'العلا'], ['abha', 'أبها'], ['taif', 'الطائف'], ['diriyah', 'الدرعية'], ['yanbu', 'ينبع'], ['eastern-region', 'الشرقية'], ['tabuk-region', 'تبوك'], ['hail', 'حائل'], ['albaha', 'الباحة'], ['qassim-region', 'القصيم']];
const STEP = [brand.orange, brand.pink, brand.sky, brand.lilac, brand.green];

/** خطط لي رحلة: تختار المدينة والأيام واهتماماتك، والدليل يرتبها لك يوم بيوم */
export default function Planner() {
  const insets = useSafeAreaInsets();
  const prm = useLocalSearchParams<{ city?: string }>();
  const [city, setCity] = useState(prm.city && CITIES.some((c) => c[0] === prm.city) ? prm.city : 'medina');
  const [days, setDays] = useState(2);
  const [want, setWant] = useState<string[]>(['sights', 'heritage', 'food']);
  const [pace, setPace] = useState<Pace>('normal');
  const [plan, setPlan] = useState<PlanStop[][] | null>(null);
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState(0);

  const go = async () => {
    setBusy(true);
    try { const p = await makePlan(city, days, want, pace); setPlan(p); setDay(0); } catch { Alert.alert('ما قدرنا نجهز الخطة', 'تأكد من النت وجرّب مرة ثانية.'); } finally { setBusy(false); }
  };
  const save = () => {
    if (!plan) return;
    const pd = plan.map((d) => d.map((p) => p.id));
    const apply = (mode: 'replace' | 'add') => { trip.setDays(mode === 'replace' ? pd : [...trip.days().filter((d) => d.length), ...pd]); router.replace('/trip'); };
    if (!trip.all().length) return apply('replace');
    Alert.alert('عندك أماكن في رحلتي', 'تبي تستبدلها بالخطة الجديدة ولا تضيفها عليها؟', [
      { text: 'إلغاء', style: 'cancel' }, { text: 'أضفها', onPress: () => apply('add') }, { text: 'استبدل', style: 'destructive', onPress: () => apply('replace') },
    ]);
  };
  const cityLabel = CITIES.find((c) => c[0] === city)?.[1] ?? '';

  if (plan) {
    const cur = plan[Math.min(day, plan.length - 1)] ?? [];
    return (
      <View style={{ flex: 1, backgroundColor: brand.bg }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 120 }}>
          <View style={st.top}><BackButton /><View style={{ flex: 1 }}><AppText variant="title">{days === 1 ? 'يوم' : `${days} أيام`} في {cityLabel}</AppText><AppText variant="small" muted>{plan.flat().length} مكان · رحلة {PACE[pace].label}</AppText></View>
            <Pressable onPress={() => setPlan(null)} style={st.edit}><AppText variant="small" color={brand.purple} style={{ fontFamily: font.bold }}>تعديل</AppText></Pressable></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16 }}>
            {plan.map((_, i) => <Chip key={i} label={`اليوم ${i + 1}`} on={i === day} color={brand.ink} onPress={() => setDay(i)} />)}
          </ScrollView>
          <View style={{ paddingHorizontal: 16 }}>
            {cur.map((p, i) => {
              const ks = kindStyle[p.kinds[0]] ?? kindStyle.sights;
              return (
                <View key={p.id}>
                  {p.driveMin ? <View style={st.drive}><Icon name="route" size={14} color={brand.faint} /><AppText variant="tiny" muted>تقريباً {p.driveMin} دقيقة بالسيارة</AppText></View> : null}
                  <Pressable style={st.stop} onPress={() => router.push(`/place/${p.id}`)}>
                    <View style={[st.num, { backgroundColor: STEP[i % STEP.length] }]}><AppText style={{ fontFamily: font.bold }} color="#fff">{i + 1}</AppText></View>
                    <Image source={p.thumb || p.image || photos.heritage} style={st.img} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <AppText variant="tiny" color={brand.orangeDeep} style={{ fontFamily: font.bold }}>{p.slot}</AppText>
                      <AppText style={{ fontFamily: font.bold }} numberOfLines={1}>{p.title}</AppText>
                      <AppText variant="tiny" color={ks.fg}>{p.cat}</AppText>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <AppText variant="tiny" muted center style={{ marginTop: 14, paddingHorizontal: 30 }}>الأوقات تقريبية، وتأكد من أوقات الدوام قبل ما تروح.</AppText>
        </ScrollView>
        <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={[st.cta, { flex: 1.4 }]} onPress={save}><AppText color="#fff" style={{ fontFamily: font.bold }}>احفظها في رحلتي</AppText></Pressable>
          <Pressable style={[st.cta, { flex: 1, backgroundColor: brand.ink }]} onPress={go}><AppText color="#fff" style={{ fontFamily: font.bold }}>خطة ثانية</AppText></Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 120 }}>
        <View style={st.top}><BackButton /><AppText variant="title">خطط لي رحلة</AppText></View>
        <AppText muted style={{ paddingHorizontal: 20, marginTop: 6 }}>قل لنا وين وكم يوم ووش تحب، ونرتبها لك يوم بيوم.</AppText>

        <AppText variant="section" style={st.h}>وين؟</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {CITIES.map(([id, n]) => <Chip key={id} label={n} on={city === id} color={brand.ink} onPress={() => setCity(id)} />)}
        </ScrollView>

        <AppText variant="section" style={st.h}>كم يوم؟</AppText>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
          {[1, 2, 3, 4].map((n) => (
            <Pressable key={n} onPress={() => setDays(n)} style={[st.box, days === n && { backgroundColor: brand.purple }]}>
              <AppText style={{ fontFamily: font.bold, fontSize: 20 }} color={days === n ? '#fff' : brand.ink}>{n}</AppText>
              <AppText variant="tiny" color={days === n ? '#E2DAEE' : brand.muted}>{n === 1 ? 'يوم' : n === 2 ? 'يومين' : 'أيام'}</AppText>
            </Pressable>
          ))}
        </View>

        <AppText variant="section" style={st.h}>وش تحب؟</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 }}>
          {kinds.map((k) => {
            const on = want.includes(k.id), ks = kindStyle[k.id] ?? kindStyle.sights;
            return (
              <Pressable key={k.id} onPress={() => setWant(on ? want.filter((x) => x !== k.id) : [...want, k.id])} style={[st.kind, { backgroundColor: on ? ks.fg : '#fff' }]}>
                <Icon name={ks.icon as IconName} size={16} color={on ? '#fff' : ks.fg} />
                <AppText variant="small" style={{ fontFamily: font.bold }} color={on ? '#fff' : brand.ink}>{k.name}</AppText>
              </Pressable>
            );
          })}
        </View>

        <AppText variant="section" style={st.h}>الرتم</AppText>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
          {(Object.keys(PACE) as Pace[]).map((k) => (
            <Pressable key={k} onPress={() => setPace(k)} style={[st.box, { flex: 1 }, pace === k && { backgroundColor: brand.purple }]}>
              <AppText style={{ fontFamily: font.bold }} color={pace === k ? '#fff' : brand.ink}>{PACE[k].label}</AppText>
              <AppText variant="tiny" color={pace === k ? '#E2DAEE' : brand.muted}>{PACE[k].n} أماكن باليوم</AppText>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={[st.cta, { flex: 1, backgroundColor: brand.orange }]} onPress={go} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <><Icon name="spark" color="#fff" size={18} /><AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 16 }}>رتّب لي الرحلة</AppText></>}
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  h: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 },
  box: { minWidth: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, height: 40 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: brand.bg },
  cta: { height: 54, borderRadius: 18, backgroundColor: brand.purple, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  edit: { backgroundColor: brand.chip, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 20, padding: 10 },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  img: { width: 62, height: 62, borderRadius: 14, backgroundColor: brand.chip },
  drive: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 24 },
});
