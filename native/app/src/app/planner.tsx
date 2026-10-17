import { useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { BackButton, Chip } from '@/components/ui';
import { DateStrip, nextDays } from '@/components/DateStrip';
import { kinds } from '@/lib/content';
import { makePlan, PACE, type Pace, type PlanStop } from '@/lib/planner';
import { trip, tripDayDate } from '@/lib/trip';
import { aiErr, aiPlan, type AiPlan } from '@/lib/ai';
import { useAuth } from '@/lib/auth';
import { useFeatures } from '@/lib/features';
import { INPUT_START } from '@/theme/tokens';
import { brand, font, kindStyle, photos } from '@/theme/tokens';
import { t, isEn } from '@/lib/i18n';
import { happyMoment } from '@/lib/review';

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
  const [when, setWhen] = useState<'' | 'today' | 'tomorrow' | 'weekend' | 'date'>('');
  const [pick, setPick] = useState(''); // «تاريخ معيّن»: اليوم المختار من الشريط
  const formScroll = useRef<ScrollView>(null);
  const [party, setParty] = useState('');
  const [budget, setBudget] = useState('متوسطة');
  const [notes, setNotes] = useState('');
  const [ai, setAi] = useState<AiPlan | null>(null);
  const useSmart = smart && F.ai_planner;

  const startDate = () => {
    const d = new Date(Date.now() + 3 * 3600e3);
    if (when === 'tomorrow') d.setUTCDate(d.getUTCDate() + 1);
    if (when === 'weekend') d.setUTCDate(d.getUTCDate() + ((4 - d.getUTCDay() + 7) % 7 || 7));
    if (when === 'date') return pick;
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
      if (c === 'plus_required' || c === 'quota' || c === 'plan_quota') Alert.alert(t('خطة ذكية مع دليل+'), aiErr(e), [{ text: t('لاحقاً'), style: 'cancel' }, { text: t('جرّب دليل+'), onPress: () => router.push('/plus') }]);
      else Alert.alert(t('ما قدرنا نجهز الخطة الذكية'), aiErr(e));
    } finally { setBusy(false); }
  };
  const saveAi = () => {
    if (!ai) return;
    const pd = ai.days.map((d) => d.stops.filter((s) => s.type === 'place').map((s) => s.id)).filter((d) => d.length);
    const apply = (mode: 'replace' | 'add') => { trip.setDays(mode === 'replace' ? pd : [...trip.days().filter((d) => d.length), ...pd]); if (mode === 'replace' || !trip.start()) trip.setStart(startDate()); router.replace('/trip'); };
    if (!trip.all().length) return apply('replace');
    Alert.alert(t('عندك أماكن في رحلتي'), t('تبي تستبدلها بالخطة الجديدة ولا تضيفها عليها؟'), [
      { text: t('إلغاء'), style: 'cancel' }, { text: t('أضفها'), onPress: () => apply('add') }, { text: t('استبدل'), style: 'destructive', onPress: () => apply('replace') },
    ]);
  };
  const go = async () => {
    if (useSmart) return goSmart();
    setBusy(true);
    try { const p = await makePlan(city, days, want, pace); setPlan(p); setDay(0); happyMoment('plan'); } catch { Alert.alert(t('ما قدرنا نجهز الخطة'), t('تأكد من النت وجرّب مرة ثانية.')); } finally { setBusy(false); }
  };
  const save = () => {
    if (!plan) return;
    const pd = plan.map((d) => d.map((p) => p.id));
    const apply = (mode: 'replace' | 'add') => { trip.setDays(mode === 'replace' ? pd : [...trip.days().filter((d) => d.length), ...pd]); if (mode === 'replace' || !trip.start()) trip.setStart(startDate()); router.replace('/trip'); };
    if (!trip.all().length) return apply('replace');
    Alert.alert(t('عندك أماكن في رحلتي'), t('تبي تستبدلها بالخطة الجديدة ولا تضيفها عليها؟'), [
      { text: t('إلغاء'), style: 'cancel' }, { text: t('أضفها'), onPress: () => apply('add') }, { text: t('استبدل'), style: 'destructive', onPress: () => apply('replace') },
    ]);
  };
  const cityLabel = t(CITIES.find((c) => c[0] === city)?.[1] ?? '');

  if (ai) {
    const cur = ai.days[Math.min(day, ai.days.length - 1)];
    return (
      <View style={{ flex: 1, backgroundColor: brand.bg }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 120 }}>
          <View style={st.top}><BackButton /><View style={{ flex: 1 }}><AppText variant="title" numberOfLines={2}>{ai.title || t('{n} أيام في {city}', { n: days, city: cityLabel })}</AppText><AppText variant="small" muted>{t('خطة ذكية · {n} محطة', { n: ai.days.reduce((n, d) => n + d.stops.length, 0) })}</AppText></View>
            <Pressable onPress={() => setAi(null)} style={st.edit}><AppText variant="small" color={brand.purple} style={{ fontFamily: font.bold }}>{t('تعديل')}</AppText></Pressable></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16 }}>
            {ai.days.map((_, i) => <Chip key={i} label={t('اليوم {n}', { n: i + 1 })} on={i === day} color={brand.ink} onPress={() => setDay(i)} />)}
          </ScrollView>
          {cur?.title ? <AppText variant="section" style={{ paddingHorizontal: 20, paddingBottom: 8 }}>{cur.title}</AppText> : null}
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {(cur?.stops || []).map((sp, i) => (
              <Pressable key={sp.type + sp.id} style={[st.stop, { alignItems: 'flex-start' }]} onPress={() => router.push(sp.type === 'event' ? `/event/${sp.id}` : `/place/${sp.id}`)}>
                <View style={[st.num, { backgroundColor: STEP[i % STEP.length] }]}><AppText style={{ fontFamily: font.bold }} color="#fff">{i + 1}</AppText></View>
                <Image source={sp.thumb || (sp.type === 'event' ? photos.fest : photos.heritage)} style={st.img} contentFit="cover" />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="tiny" color={brand.orangeDeep} style={{ fontFamily: font.bold }}>{sp.time}{sp.type === 'event' ? ' · ' + t('فعالية') : ''}</AppText>
                  <AppText style={{ fontFamily: font.bold }} numberOfLines={2}>{sp.title}</AppText>
                  {sp.why ? <AppText variant="tiny" muted style={{ lineHeight: 18 }}>{sp.why}</AppText> : null}
                </View>
              </Pressable>
            ))}
          </View>
          {ai.tips.length ? (
            <View style={[st.tips]}>
              <AppText style={{ fontFamily: font.bold }}>{t('نصايح لرحلتك')}</AppText>
              {ai.tips.map((tip) => <AppText key={tip} variant="small" style={{ lineHeight: 22 }}>• {tip}</AppText>)}
            </View>
          ) : null}
          {!ai.quota?.plus ? (
            <Pressable onPress={() => router.push('/plus')} style={st.upsell}>
              <Icon name="spark" color="#fff" size={20} />
              <View style={{ flex: 1 }}>
                <AppText color="#fff" style={{ fontFamily: font.bold }}>{t('عجبتك؟')}</AppText>
                <AppText variant="small" color="#E9E0FF" style={{ lineHeight: 20 }}>{t('هذي خطتك المجانية لهالشهر. مع دليل+ تخطط كل رحلاتك بدون حد، وجرّبه 3 أيام مجاناً.')}</AppText>
              </View>
              <Icon name="chevron" color="#fff" size={18} />
            </Pressable>
          ) : null}
          <AppText variant="tiny" muted center style={{ marginTop: 14, paddingHorizontal: 30 }}>{t('الخطة من أماكن الدليل وفعالياته، والأوقات تقريبية. تأكد من الدوام قبل ما تروح.')}</AppText>
        </ScrollView>
        <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={[st.cta, { flex: 1.4 }]} onPress={saveAi}><AppText color="#fff" style={{ fontFamily: font.bold }}>{t('احفظها في رحلتي')}</AppText></Pressable>
          <Pressable style={[st.cta, { flex: 1, backgroundColor: brand.ink }]} onPress={goSmart} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <AppText color="#fff" style={{ fontFamily: font.bold }}>{t('خطة ثانية')}</AppText>}</Pressable>
        </View>
      </View>
    );
  }

  if (plan) {
    const cur = plan[Math.min(day, plan.length - 1)] ?? [];
    return (
      <View style={{ flex: 1, backgroundColor: brand.bg }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 120 }}>
          <View style={st.top}><BackButton /><View style={{ flex: 1 }}><AppText variant="title">{days === 1 ? t('يوم في {city}', { city: cityLabel }) : t('{n} أيام في {city}', { n: days, city: cityLabel })}</AppText><AppText variant="small" muted>{t('{n} مكان · رحلة {pace}', { n: plan.flat().length, pace: t(PACE[pace].label) })}</AppText></View>
            <Pressable onPress={() => setPlan(null)} style={st.edit}><AppText variant="small" color={brand.purple} style={{ fontFamily: font.bold }}>{t('تعديل')}</AppText></Pressable></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16 }}>
            {plan.map((_, i) => <Chip key={i} label={t('اليوم {n}', { n: i + 1 })} on={i === day} color={brand.ink} onPress={() => setDay(i)} />)}
          </ScrollView>
          <View style={{ paddingHorizontal: 16 }}>
            {cur.map((p, i) => {
              const ks = kindStyle[p.kinds[0]] ?? kindStyle.sights;
              return (
                <View key={p.id}>
                  {p.driveMin ? <View style={st.drive}><Icon name="route" size={14} color={brand.faint} /><AppText variant="tiny" muted>{t('تقريباً {n} دقيقة بالسيارة', { n: p.driveMin })}</AppText></View> : null}
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
          <AppText variant="tiny" muted center style={{ marginTop: 14, paddingHorizontal: 30 }}>{t('الأوقات تقريبية، وتأكد من أوقات الدوام قبل ما تروح.')}</AppText>
        </ScrollView>
        <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={[st.cta, { flex: 1.4 }]} onPress={save}><AppText color="#fff" style={{ fontFamily: font.bold }}>{t('احفظها في رحلتي')}</AppText></Pressable>
          <Pressable style={[st.cta, { flex: 1, backgroundColor: brand.ink }]} onPress={go}><AppText color="#fff" style={{ fontFamily: font.bold }}>{t('خطة ثانية')}</AppText></Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={formScroll} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={st.top}><BackButton /><AppText variant="title">{t('خطط لي رحلة')}</AppText></View>
        <AppText muted style={{ paddingHorizontal: 20, marginTop: 6 }}>{t('قل لنا وين وكم يوم ووش تحب، ونرتبها لك يوم بيوم.')}</AppText>
        {F.ai_planner ? (
          <View style={st.seg}>
            {([[true, 'خطة ذكية', 'تراعي تواريخك ومين معك، ووحدة مجانية كل شهر'], [false, 'خطة سريعة', 'ترتيب تلقائي مجاني']] as const).map(([v, lb, d]) => (
              <Pressable key={lb} onPress={() => setSmart(v)} style={[st.segItem, smart === v && { backgroundColor: v ? brand.purple : brand.ink }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>{v ? <Icon name="spark" size={14} color={smart === v ? '#fff' : brand.purple} /> : null}<AppText style={{ fontFamily: font.bold, fontSize: 14 }} color={smart === v ? '#fff' : brand.text}>{t(lb)}</AppText>{v ? <View style={st.plusTag}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{t('دليل+')}</AppText></View> : null}</View>
                <AppText variant="tiny" color={smart === v ? '#E2DAEE' : brand.muted} center>{t(d)}</AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        <AppText variant="section" style={st.h}>{t('وين؟')}</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {CITIES.map(([id, n]) => <Chip key={id} label={t(n)} on={city === id} color={brand.ink} onPress={() => setCity(id)} />)}
        </ScrollView>

        <AppText variant="section" style={st.h}>{t('كم يوم؟')}</AppText>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
          {[1, 2, 3, 4].map((n) => (
            <Pressable key={n} onPress={() => setDays(n)} style={[st.box, days === n && { backgroundColor: brand.purple }]}>
              <AppText style={{ fontFamily: font.bold, fontSize: 20 }} color={days === n ? '#fff' : brand.text}>{n}</AppText>
              <AppText variant="tiny" color={days === n ? '#E2DAEE' : brand.muted}>{isEn ? (n === 1 ? 'day' : 'days') : n === 1 ? 'يوم' : n === 2 ? 'يومين' : 'أيام'}</AppText>
            </Pressable>
          ))}
        </View>

        <AppText variant="section" style={st.h}>{t('متى؟')}</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {([['', 'ما حددت'], ['today', 'من اليوم'], ['tomorrow', 'من بكرة'], ['weekend', 'الويكند الجاي'], ['date', 'تاريخ معيّن']] as const).map(([k, lb]) => <Chip key={k} label={k === 'date' && pick && when === 'date' ? tripDayDate(pick, 0, isEn) : t(lb)} on={when === k} color={brand.purple} onPress={() => { setWhen(k); if (k === 'date' && !pick) setPick(nextDays(1)[0]); }} />)}
        </ScrollView>
        {when === 'date' ? <DateStrip value={pick} onChange={setPick} /> : null}
        {startDate() ? <AppText variant="small" muted style={{ paddingHorizontal: 20, marginTop: 8 }}>{days === 1 ? tripDayDate(startDate(), 0, isEn) : t('من {a} إلى {b}', { a: tripDayDate(startDate(), 0, isEn), b: tripDayDate(startDate(), days - 1, isEn) })}</AppText> : null}

        <AppText variant="section" style={st.h}>{t('وش تحب؟')}</AppText>
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

        <AppText variant="section" style={st.h}>{t('الرتم')}</AppText>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
          {(Object.keys(PACE) as Pace[]).map((k) => (
            <Pressable key={k} onPress={() => setPace(k)} style={[st.box, { flex: 1 }, pace === k && { backgroundColor: brand.purple }]}>
              <AppText style={{ fontFamily: font.bold }} color={pace === k ? '#fff' : brand.text}>{t(PACE[k].label)}</AppText>
              <AppText variant="tiny" color={pace === k ? '#E2DAEE' : brand.muted}>{t('{n} أماكن باليوم', { n: PACE[k].n })}</AppText>
            </Pressable>
          ))}
        </View>


        {useSmart ? (
          <>
            <AppText variant="section" style={st.h}>{t('مين معك؟')}</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              {['عائلة مع أطفال', 'عائلة', 'زوجين', 'شباب', 'بنات', 'لحالي'].map((p) => <Chip key={p} label={t(p)} on={party === p} color={brand.purple} onPress={() => setParty(party === p ? '' : p)} />)}
            </ScrollView>
            <AppText variant="section" style={st.h}>{t('الميزانية')}</AppText>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
              {['اقتصادية', 'متوسطة', 'فاخرة'].map((b) => <Chip key={b} label={t(b)} on={budget === b} color={brand.purple} onPress={() => setBudget(b)} />)}
            </View>
            <AppText variant="section" style={st.h}>{t('شي تبي نراعيه؟')}</AppText>
            <TextInput value={notes} onChangeText={setNotes} placeholder={t('مثلاً: نبي نصلي في المسجد النبوي كل فرض، وما نحب المشي الكثير')} placeholderTextColor={brand.faint} style={st.notes} multiline maxLength={300} onFocus={() => setTimeout(() => formScroll.current?.scrollToEnd({ animated: true }), 300)} />
          </>
        ) : null}
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={[st.cta, { flex: 1, backgroundColor: brand.orange }]} onPress={go} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <><Icon name="spark" color="#fff" size={18} /><AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 16 }}>{useSmart ? t('خطط لي بذكاء') : t('رتّب لي الرحلة')}</AppText></>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  upsell: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.purple, borderRadius: 20, padding: 14, marginHorizontal: 16, marginTop: 14 },
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
