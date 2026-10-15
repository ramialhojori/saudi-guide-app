import { useState } from 'react';
import { TextInput } from 'react-native';
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
import { aiErr, aiPlan, type AiPlan } from '@/lib/ai';
import { useAuth } from '@/lib/auth';
import { useFeatures } from '@/lib/features';
import { INPUT_START } from '@/theme/tokens';
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
  // الخطة الذكية (دليل+): Claude يخطط من أماكن الدليل وفعالياته ويشرح كل اختيار
  const F = useFeatures();
  const { user } = useAuth();
  const [smart, setSmart] = useState(true);
  const [when, setWhen] = useState<'' | 'today' | 'tomorrow' | 'weekend'>('');
  const [party, setParty] = useState('');
  const [budget, setBudget] = useState('متوسطة');
  const [notes, setNotes] = useState('');
  const [ai, setAi] = useState<AiPlan | null>(null);
  const useSmart = smart && F.ai_planner;

  const startDate = () => {
    const d = new Date(Date.now() + 3 * 3600e3);
    if (when === 'tomorrow') d.setUTCDate(d.getUTCDate() + 1);
    if (when === 'weekend') d.setUTCDate(d.getUTCDate() + ((4 - d.getUTCDay() + 7) % 7 || 7));
    return when ? d.toISOString().slice(0, 10) : '';
  };
  const goSmart = async () => {
    if (!user) return router.push('/login');
    setBusy(true);
    try {
      const p = await aiPlan({ city, days, start: startDate(), party, budget, pace: PACE[pace].label, interests: want, notes: notes.trim() });
      setAi(p); setDay(0);
    } catch (e) {
      const c = (e as { code?: string })?.code;
      if (c === 'plus_required' || c === 'quota') Alert.alert('خطة ذكية مع دليل+', aiErr(e), [{ text: 'لاحقاً', style: 'cancel' }, { text: 'اعرف أكثر', onPress: () => router.push('/plus') }]);
      else Alert.alert('ما قدرنا نجهز الخطة الذكية', aiErr(e));
    } finally { setBusy(false); }
  };
  const saveAi = () => {
    if (!ai) return;
    const pd = ai.days.map((d) => d.stops.filter((s) => s.type === 'place').map((s) => s.id)).filter((d) => d.length);
    const apply = (mode: 'replace' | 'add') => { trip.setDays(mode === 'replace' ? pd : [...trip.days().filter((d) => d.length), ...pd]); router.replace('/trip'); };
    if (!trip.all().length) return apply('replace');
    Alert.alert('عندك أماكن في رحلتي', 'تبي تستبدلها بالخطة الجديدة ولا تضيفها عليها؟', [
      { text: 'إلغاء', style: 'cancel' }, { text: 'أضفها', onPress: () => apply('add') }, { text: 'استبدل', style: 'destructive', onPress: () => apply('replace') },
    ]);
  };
  const go = async () => {
    if (useSmart) return goSmart();
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

  if (ai) {
    const cur = ai.days[Math.min(day, ai.days.length - 1)];
    return (
      <View style={{ flex: 1, backgroundColor: brand.bg }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 120 }}>
          <View style={st.top}><BackButton /><View style={{ flex: 1 }}><AppText variant="title" numberOfLines={2}>{ai.title || `${days} أيام في ${cityLabel}`}</AppText><AppText variant="small" muted>خطة ذكية · {ai.days.reduce((n, d) => n + d.stops.length, 0)} محطة</AppText></View>
            <Pressable onPress={() => setAi(null)} style={st.edit}><AppText variant="small" color={brand.purple} style={{ fontFamily: font.bold }}>تعديل</AppText></Pressable></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16 }}>
            {ai.days.map((_, i) => <Chip key={i} label={`اليوم ${i + 1}`} on={i === day} color={brand.ink} onPress={() => setDay(i)} />)}
          </ScrollView>
          {cur?.title ? <AppText variant="section" style={{ paddingHorizontal: 20, paddingBottom: 8 }}>{cur.title}</AppText> : null}
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {(cur?.stops || []).map((sp, i) => (
              <Pressable key={sp.type + sp.id} style={[st.stop, { alignItems: 'flex-start' }]} onPress={() => router.push(sp.type === 'event' ? `/event/${sp.id}` : `/place/${sp.id}`)}>
                <View style={[st.num, { backgroundColor: STEP[i % STEP.length] }]}><AppText style={{ fontFamily: font.bold }} color="#fff">{i + 1}</AppText></View>
                <Image source={sp.thumb || (sp.type === 'event' ? photos.fest : photos.heritage)} style={st.img} contentFit="cover" />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="tiny" color={brand.orangeDeep} style={{ fontFamily: font.bold }}>{sp.time}{sp.type === 'event' ? ' · فعالية' : ''}</AppText>
                  <AppText style={{ fontFamily: font.bold }} numberOfLines={2}>{sp.title}</AppText>
                  {sp.why ? <AppText variant="tiny" muted style={{ lineHeight: 18 }}>{sp.why}</AppText> : null}
                </View>
              </Pressable>
            ))}
          </View>
          {ai.tips.length ? (
            <View style={[st.tips]}>
              <AppText style={{ fontFamily: font.bold }}>نصايح لرحلتك</AppText>
              {ai.tips.map((t) => <AppText key={t} variant="small" style={{ lineHeight: 22 }}>• {t}</AppText>)}
            </View>
          ) : null}
          <AppText variant="tiny" muted center style={{ marginTop: 14, paddingHorizontal: 30 }}>الخطة من أماكن الدليل وفعالياته، والأوقات تقريبية. تأكد من الدوام قبل ما تروح.</AppText>
        </ScrollView>
        <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={[st.cta, { flex: 1.4 }]} onPress={saveAi}><AppText color="#fff" style={{ fontFamily: font.bold }}>احفظها في رحلتي</AppText></Pressable>
          <Pressable style={[st.cta, { flex: 1, backgroundColor: brand.ink }]} onPress={goSmart} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <AppText color="#fff" style={{ fontFamily: font.bold }}>خطة ثانية</AppText>}</Pressable>
        </View>
      </View>
    );
  }

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
        {F.ai_planner ? (
          <View style={st.seg}>
            {([[true, 'خطة ذكية', 'تراعي تواريخك والفعاليات ومين معك'], [false, 'خطة سريعة', 'ترتيب تلقائي مجاني']] as const).map(([v, t, d]) => (
              <Pressable key={t} onPress={() => setSmart(v)} style={[st.segItem, smart === v && { backgroundColor: v ? brand.purple : brand.ink }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>{v ? <Icon name="spark" size={14} color={smart === v ? '#fff' : brand.purple} /> : null}<AppText style={{ fontFamily: font.bold, fontSize: 14 }} color={smart === v ? '#fff' : brand.text}>{t}</AppText>{v ? <View style={st.plusTag}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>دليل+</AppText></View> : null}</View>
                <AppText variant="tiny" color={smart === v ? '#E2DAEE' : brand.muted} center>{d}</AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        <AppText variant="section" style={st.h}>وين؟</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {CITIES.map(([id, n]) => <Chip key={id} label={n} on={city === id} color={brand.ink} onPress={() => setCity(id)} />)}
        </ScrollView>

        <AppText variant="section" style={st.h}>كم يوم؟</AppText>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
          {[1, 2, 3, 4].map((n) => (
            <Pressable key={n} onPress={() => setDays(n)} style={[st.box, days === n && { backgroundColor: brand.purple }]}>
              <AppText style={{ fontFamily: font.bold, fontSize: 20 }} color={days === n ? '#fff' : brand.text}>{n}</AppText>
              <AppText variant="tiny" color={days === n ? '#E2DAEE' : brand.muted}>{n === 1 ? 'يوم' : n === 2 ? 'يومين' : 'أيام'}</AppText>
            </Pressable>
          ))}
        </View>

        <AppText variant="section" style={st.h}>وش تحب؟</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 }}>
          {kinds.map((k) => {
            const on = want.includes(k.id), ks = kindStyle[k.id] ?? kindStyle.sights;
            return (
              <Pressable key={k.id} onPress={() => setWant(on ? want.filter((x) => x !== k.id) : [...want, k.id])} style={[st.kind, { backgroundColor: on ? ks.fg : brand.card }]}>
                <Icon name={ks.icon as IconName} size={16} color={on ? '#fff' : ks.fg} />
                <AppText variant="small" style={{ fontFamily: font.bold }} color={on ? '#fff' : brand.text}>{k.name}</AppText>
              </Pressable>
            );
          })}
        </View>

        <AppText variant="section" style={st.h}>الرتم</AppText>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
          {(Object.keys(PACE) as Pace[]).map((k) => (
            <Pressable key={k} onPress={() => setPace(k)} style={[st.box, { flex: 1 }, pace === k && { backgroundColor: brand.purple }]}>
              <AppText style={{ fontFamily: font.bold }} color={pace === k ? '#fff' : brand.text}>{PACE[k].label}</AppText>
              <AppText variant="tiny" color={pace === k ? '#E2DAEE' : brand.muted}>{PACE[k].n} أماكن باليوم</AppText>
            </Pressable>
          ))}
        </View>

        {useSmart ? (
          <>
            <AppText variant="section" style={st.h}>متى؟</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              {([['', 'ما حددت'], ['today', 'من اليوم'], ['tomorrow', 'من بكرة'], ['weekend', 'الويكند الجاي']] as const).map(([k, t]) => <Chip key={k} label={t} on={when === k} color={brand.purple} onPress={() => setWhen(k)} />)}
            </ScrollView>
            <AppText variant="section" style={st.h}>مين معك؟</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              {['عائلة مع أطفال', 'عائلة', 'زوجين', 'شباب', 'بنات', 'لحالي'].map((t) => <Chip key={t} label={t} on={party === t} color={brand.purple} onPress={() => setParty(party === t ? '' : t)} />)}
            </ScrollView>
            <AppText variant="section" style={st.h}>الميزانية</AppText>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
              {['اقتصادية', 'متوسطة', 'فاخرة'].map((t) => <Chip key={t} label={t} on={budget === t} color={brand.purple} onPress={() => setBudget(t)} />)}
            </View>
            <AppText variant="section" style={st.h}>شي تبي نراعيه؟</AppText>
            <TextInput value={notes} onChangeText={setNotes} placeholder="مثلاً: نبي نصلي في المسجد النبوي كل فرض، وما نحب المشي الكثير" placeholderTextColor={brand.faint} style={st.notes} multiline maxLength={300} />
          </>
        ) : null}
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={[st.cta, { flex: 1, backgroundColor: brand.orange }]} onPress={go} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <><Icon name="spark" color="#fff" size={18} /><AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 16 }}>{useSmart ? 'خطط لي بذكاء' : 'رتّب لي الرحلة'}</AppText></>}
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  seg: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 14 },
  segItem: { flex: 1, backgroundColor: brand.card, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  plusTag: { backgroundColor: brand.orange, borderRadius: 999, paddingHorizontal: 6 },
  notes: { marginHorizontal: 16, minHeight: 80, backgroundColor: brand.card, borderRadius: 16, borderWidth: 1.5, borderColor: brand.line, padding: 12, fontFamily: font.regular, fontSize: 14, color: brand.text, textAlign: INPUT_START },
  tips: { marginHorizontal: 16, marginTop: 16, backgroundColor: brand.softOrange, borderRadius: 18, padding: 14, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  h: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 },
  box: { minWidth: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.card, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, height: 40 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: brand.bg },
  cta: { height: 54, borderRadius: 18, backgroundColor: brand.purple, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  edit: { backgroundColor: brand.chip, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: brand.card, borderRadius: 20, padding: 10 },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  img: { width: 62, height: 62, borderRadius: 14, backgroundColor: brand.chip },
  drive: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 24 },
});
