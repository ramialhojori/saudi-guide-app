import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Field, Input } from '@/components/Form';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Chip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { allCities } from '@/lib/content';
import { BIZ_KINDS, couponErr, getPlans, sendInterest, type Plan } from '@/lib/coupons';
import { isEn, t } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';

const PLAN_COLOR: Record<string, string> = { free: brand.green, plus: brand.orange, pro: brand.pink };
const WHY: [IconName, string, string][] = [
  ['pin', 'زوار يدورون على مكان مثلك', 'الدليل يستخدمه سياح وزوار وأهل المدن يدورون وين ياكلون ويتسوقون ويطلعون.'],
  ['ticket', 'عرضك يوصل وقت ما يقررون', 'كوبونك يطلع في صفحة مدينتك وصفحة محلك، ويوصل إشعار للي طلبوا ينبَّهون بالعروض الجديدة.'],
  ['spark', 'تشوف النتيجة بالأرقام', 'كم واحد شاف عرضك وحفظه واستخدمه، وتقرير أسبوعي يوصلك.'],
];

/** دليل السعودية للأعمال: تعريف للتجار + الباقات (المدفوعة «قريباً») + «سجّل اهتمامك» */
export default function Business() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 900;
  const side = wide ? Math.max(24, (width - 1100) / 2) : 16;
  const { user } = useAuth();
  const scroll = useRef<ScrollView>(null);
  const formY = useRef(0);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [plan, setPlan] = useState<'plus' | 'pro'>('plus');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [city, setCity] = useState(user?.city || '');
  const [kind, setKind] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  const load = () => { setFailed(false); getPlans().then((r) => setPlans(r.plans)).catch(() => setFailed(true)); };
  useEffect(load, []);

  const toForm = (p?: 'plus' | 'pro') => { if (p) setPlan(p); scroll.current?.scrollTo({ y: formY.current - 20, animated: true }); };
  const ok = name.trim().length >= 2 && contact.trim().length >= 5;
  const send = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr('');
    try { await sendInterest({ name: name.trim(), contact: contact.trim(), city: city || undefined, kind: kind || undefined, plan, note: note.trim() || undefined }); setSent(true); }
    catch (e) { setErr(couponErr(e)); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        {/* الغلاف */}
        <View style={[st.hero, { paddingTop: insets.top + 10, paddingHorizontal: side }]}>
          {!wide ? <Pressable style={st.glass} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel={t('رجوع')}><Icon name="back" color="#fff" size={20} /></Pressable> : null}
          <AppText variant="small" color="#F9A158" style={{ fontFamily: font.semibold, marginTop: wide ? 30 : 16 }}>{t('دليل السعودية للأعمال')}</AppText>
          <AppText color="#fff" style={{ fontFamily: font.bold, fontSize: wide ? 40 : 28, lineHeight: wide ? 60 : 42, marginTop: 4 }}>{t('خلّ زوار مدينتك يلقونك')}</AppText>
          <AppText color="#E2DAEE" style={{ fontSize: wide ? 18 : 15, lineHeight: wide ? 32 : 26, marginTop: 8, maxWidth: 640 }}>{t('سجّل مطعمك أو مقهاك أو متجرك في دليل السعودية، وأضف عرض يوصل للناس اللي يخططون وين يروحون في مدينتك.')}</AppText>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <Button label={t('سجّل نشاطك مجاناً')} h={50} style={{ paddingHorizontal: 22 }} onPress={() => router.push('/merchant')} />
            <Button label={t('سجّل اهتمامك بالباقات')} h={50} bg="rgba(255,255,255,0.14)" style={{ paddingHorizontal: 22 }} onPress={() => toForm()} />
          </View>
        </View>

        <View style={{ paddingHorizontal: side }}>
          {/* ليش الدليل */}
          <View style={[st.why, wide && { flexDirection: 'row' }]}>
            {WHY.map(([i, a, b]) => (
              <View key={a} style={[st.whyItem, wide && { flex: 1 }]}>
                <View style={st.whyIcon}><Icon name={i} color={brand.orangeDeep} size={22} /></View>
                <AppText style={{ fontFamily: font.bold, fontSize: 15, marginTop: 10 }}>{t(a)}</AppText>
                <AppText variant="small" muted style={{ lineHeight: 22, marginTop: 4 }}>{t(b)}</AppText>
              </View>
            ))}
          </View>

          {/* الباقات */}
          <AppText variant="section" style={{ marginTop: 28 }}>{t('الباقات')}</AppText>
          {!plans ? (
            failed ? <Pressable onPress={load} style={{ padding: 30, alignItems: 'center' }}><AppText muted>{t('ما قدرنا نجيب الباقات. اضغط للمحاولة مرة ثانية')}</AppText></Pressable>
              : <ActivityIndicator style={{ margin: 30 }} color={brand.purple} />
          ) : (
            <View style={[{ gap: 12, marginTop: 10 }, wide && { flexDirection: 'row', alignItems: 'stretch' }]}>
              {plans.map((p) => (
                <View key={p.id} style={[st.plan, wide && { flex: 1 }, p.id === 'plus' && { borderColor: brand.orange, borderWidth: 2 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[st.dot, { backgroundColor: PLAN_COLOR[p.id] }]} />
                    <AppText style={{ fontFamily: font.bold, fontSize: 18, flex: 1 }}>{p.name}</AppText>
                    <View style={[st.tag, { backgroundColor: p.available ? brand.softGreen : brand.softOrange }]}>
                      <AppText variant="tiny" color={p.available ? brand.green : brand.orangeDeep} style={{ fontFamily: font.semibold }}>{p.available ? t('متاحة الحين') : t('قريباً')}</AppText>
                    </View>
                  </View>
                  <AppText style={{ fontFamily: font.bold, fontSize: 22, marginTop: 10 }}>{p.id === 'free' ? t('مجاناً') : t('السعر يُعلن قريباً')}</AppText>
                  <View style={{ marginTop: 10, gap: 8, flex: 1 }}>
                    {p.features.map((f) => (
                      <View key={f} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                        <Icon name="check" color={PLAN_COLOR[p.id]} size={18} />
                        <AppText variant="small" style={{ flex: 1, lineHeight: 22 }}>{f}</AppText>
                      </View>
                    ))}
                  </View>
                  {p.available
                    ? <Button label={t('ابدأ مجاناً')} h={46} bg={brand.purple} style={{ marginTop: 16 }} onPress={() => router.push('/merchant')} />
                    : <Button label={t('سجّل اهتمامك')} h={46} bg={brand.orange} style={{ marginTop: 16 }} onPress={() => toForm(p.id as 'plus' | 'pro')} />}
                </View>
              ))}
            </View>
          )}

          {/* سجّل اهتمامك */}
          <View style={[st.form, wide && { maxWidth: 760, alignSelf: 'center', width: '100%' }]} onLayout={(e) => { formY.current = e.nativeEvent.layout.y; }}>
            {sent ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <View style={[st.whyIcon, { backgroundColor: brand.softGreen, width: 60, height: 60, borderRadius: 20 }]}><Icon name="check" color={brand.green} size={30} /></View>
                <AppText style={{ fontFamily: font.bold, fontSize: 18, marginTop: 12 }} center>{t('وصلنا اهتمامك')}</AppText>
                <AppText variant="small" muted center style={{ lineHeight: 22, marginTop: 4 }}>{t('أول ما تفتح الباقات بنتواصل معك قبل غيرك. وتقدر تبدأ الحين بالباقة المجانية.')}</AppText>
                <Button label={t('سجّل نشاطك مجاناً')} h={46} style={{ marginTop: 16, paddingHorizontal: 22 }} onPress={() => router.push('/merchant')} />
              </View>
            ) : (
              <>
                <AppText style={{ fontFamily: font.bold, fontSize: 18 }}>{t('سجّل اهتمامك')}</AppText>
                <AppText variant="small" muted style={{ lineHeight: 22, marginTop: 4 }}>{t('الباقات المدفوعة نجهزها الحين. سجّل بياناتك ونتواصل معك أول ما تفتح.')}</AppText>
                <Field label={t('الباقة اللي تهمك')}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Chip label={t('الباقة المميزة')} on={plan === 'plus'} color={brand.orangeDeep} onPress={() => setPlan('plus')} />
                    <Chip label={t('باقة الشريك')} on={plan === 'pro'} color={brand.orangeDeep} onPress={() => setPlan('pro')} />
                  </View>
                </Field>
                <Field label={t('اسم النشاط')}><Input value={name} onChangeText={setName} placeholder={t('مثلاً: مقهى الركن')} maxLength={80} /></Field>
                <Field label={t('جوال أو إيميل للتواصل')}><Input value={contact} onChangeText={setContact} placeholder="05xxxxxxxx" maxLength={120} autoCapitalize="none" style={{ textAlign: isEn ? 'left' : 'right' }} /></Field>
                <Field label={t('المدينة')}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {allCities.map((c) => <Chip key={c.id} label={c.name} on={city === c.id} color={brand.purple} onPress={() => setCity(c.id)} />)}
                  </ScrollView>
                </Field>
                <Field label={t('نوع النشاط')} hint={t('اختياري')}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {BIZ_KINDS.map(([k, x]) => <Chip key={k} label={x} on={kind === k} color={brand.orangeDeep} onPress={() => setKind(kind === k ? '' : k)} />)}
                  </ScrollView>
                </Field>
                <Field label={t('ملاحظة')} hint={t('اختياري')}><Input value={note} onChangeText={setNote} placeholder={t('مثلاً: عندنا 3 فروع')} maxLength={500} multiline /></Field>
                {err ? <AppText variant="small" color={brand.pinkDeep} style={{ marginTop: 10 }}>{err}</AppText> : null}
                <Pressable style={[st.send, !ok && { opacity: 0.5 }]} onPress={send} disabled={!ok || busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <AppText style={{ fontFamily: font.bold, fontSize: 15 }} color="#fff">{t('أرسل')}</AppText>}
                </Pressable>
              </>
            )}
          </View>
        </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  hero: { backgroundColor: '#2B2745', paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  glass: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  why: { gap: 12, marginTop: 18 },
  whyItem: { backgroundColor: brand.card, borderRadius: 22, padding: 16 },
  whyIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: brand.softOrange, alignItems: 'center', justifyContent: 'center' },
  plan: { backgroundColor: brand.card, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: brand.line },
  dot: { width: 12, height: 12, borderRadius: 6 },
  tag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  form: { marginTop: 28, backgroundColor: brand.card, borderRadius: 24, padding: 18 },
  send: { height: 52, marginTop: 18, borderRadius: 16, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
});
