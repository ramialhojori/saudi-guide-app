import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alert } from '@/lib/alert';
import { AppText } from '@/components/AppText';
import { Field, formSt, Input, Row, Toggle } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { Chip } from '@/components/ui';
import { cityName } from '@/lib/content';
import { couponColor, couponErr, createCoupon, dayLabel, editCoupon, myMerchant, type Coupon, type Merchant } from '@/lib/coupons';
import { t } from '@/lib/i18n';
import { brand, font, webCol } from '@/theme/tokens';

type K = Coupon['kind'];
const KINDS: [K, string, string][] = [['percent', '%', t('خصم بالنسبة')], ['amount', t('ر.س'), t('خصم بمبلغ')], ['bogo', '1+1', t('اشتر واحد والثاني مجاناً')], ['gift', t('هدية'), t('صنف مجاني مع الطلب')]];
const PCTS = ['10', '15', '20', '25', '30'];
const DUR: [string, number][] = [[t('أسبوع'), 7], [t('أسبوعين'), 14], [t('شهر'), 30], [t('3 شهور'), 90], [t('بدون نهاية'), 0]];
const PTS: [string, number][] = [[t('مجاني للكل'), 0], [t('{n} نقطة', { n: 100 }), 100], [t('{n} نقطة', { n: 200 }), 200], [t('{n} نقطة', { n: 500 }), 500]];
const LVLS: [string, number][] = [[t('الكل'), 0], [t('مستوى {n}+', { n: 3 }), 3], [t('مستوى {n}+', { n: 5 }), 5], [t('مستوى {n}+', { n: 7 }), 7]];
const todayISO = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400e3).toISOString().slice(0, 10);

function offOf(kind: K, value: string) {
  if (kind === 'percent') return t('خصم {v}%', { v: value || '…' });
  if (kind === 'amount') return t('خصم {v} ر.س', { v: value || '…' });
  if (kind === 'bogo') return t('1+1 مجاناً');
  return value ? t('هدية: {v}', { v: value }) : t('هدية مع طلبك');
}

/** إضافة أو تعديل كوبون — يروح للمراجعة، وبعد الموافقة يطلع في كوبونات المدينة وصفحة المحل */
export default function MerchantCoupon() {
  const insets = useSafeAreaInsets();
  const prm = useLocalSearchParams<{ id?: string; first?: string }>();
  const editId = prm.id ? Number(prm.id) : 0;
  const [m, setM] = useState<Merchant | null>(null);
  const [kind, setKind] = useState<K>('percent');
  const [value, setValue] = useState('20');
  const [custom, setCustom] = useState(false);
  const [title, setTitle] = useState('');
  const [touched, setTouched] = useState(false);
  const [minOrder, setMinOrder] = useState('');
  const [perUser, setPerUser] = useState(true);
  const [qty, setQty] = useState('100');
  const [hours, setHours] = useState('');
  const [start, setStart] = useState(todayISO());
  const [dur, setDur] = useState(30);
  const [terms, setTerms] = useState('');
  const [points, setPoints] = useState(0);
  const [license, setLicense] = useState('');
  const [declare, setDeclare] = useState(false);
  const [minLevel, setMinLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    myMerchant().then((r) => {
      setM(r.merchant);
      const c = editId ? r.coupons.find((x) => x.id === editId) : null;
      if (c) {
        setKind(c.kind); setValue(c.value); setCustom(c.kind !== 'percent' || !PCTS.includes(c.value)); setTitle(c.title); setTouched(true);
        setMinOrder(c.minOrder ? String(c.minOrder) : ''); setPerUser(c.perUser); setQty(c.qty ? String(c.qty) : ''); setHours(c.hours);
        setStart(c.start || todayISO()); setTerms(c.terms); setPoints(c.points || 0); setMinLevel(c.minLevel || 0); setLicense(c.license || '');
        setDur(c.end ? Math.max(1, Math.round((new Date(c.end).getTime() - new Date(c.start || todayISO()).getTime()) / 86400e3)) : 0);
      }
    }).catch(() => {});
  }, [editId]);

  // العنوان يتكتب تلقائياً لين التاجر يعدّله بنفسه
  const auto = useMemo(() => (kind === 'bogo' ? t('اشتر واحد والثاني علينا') : kind === 'gift' ? (value ? t('{v} مجاناً مع طلبك', { v: value }) : '') : t('{off} على كل الطلبات', { off: offOf(kind, value) })), [kind, value]);
  useEffect(() => { if (!touched) setTitle(auto); }, [auto, touched]);
  const end = dur ? addDays(start, dur) : '';
  const bg = couponColor(m?.kind);

  const ready = title.trim().length >= 4 && (kind === 'bogo' || kind === 'gift' || +value > 0) && license.trim().length >= 4 && declare && !busy;
  const submit = async () => {
    if (!ready) { setErr(title.trim().length < 4 ? t('اكتب عنوان الكوبون.') : license.trim().length < 4 ? t('اكتب رقم ترخيص التخفيضات من وزارة التجارة.') : !declare ? t('لازم توافق على الإقرار.') : t('حدد قيمة الخصم.')); return; }
    setBusy(true); setErr('');
    const body = { kind, value, title: title.trim(), terms: terms.trim(), minOrder: minOrder ? +minOrder : null, perUser, qty: qty ? +qty : null, hours: hours.trim(), start, end, points, minLevel, license: license.trim(), declare };
    try {
      if (editId) await editCoupon(editId, body); else await createCoupon(body);
      alert(t('انرسل للمراجعة'), t('نراجعه خلال 24 ساعة، ويوصلك إشعار أول ما ينتشر.'), [{ text: t('تمام'), onPress: () => router.replace('/merchant') }]);
    } catch (e) {
      if ((e as { code?: string })?.code === 'terms_required') { router.push('/merchant/terms?accept=1'); setErr(t('حدّثنا الشروط والأحكام. وافق عليها وارجع أرسل الكوبون.')); }
      else setErr(couponErr(e));
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[{ paddingBottom: 150 }, webCol]} keyboardShouldPersistTaps="handled">
        <View style={[st.head, { paddingTop: insets.top + 10 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable style={st.glass} onPress={() => (prm.first ? router.replace('/merchant') : router.back())} accessibilityLabel={t('رجوع')}><Icon name="back" color="#fff" size={20} /></Pressable>
            <View style={{ flex: 1 }}>
              <AppText variant="small" color="#F9A158" style={{ fontFamily: font.semibold }}>{t('دليل السعودية للأعمال')}</AppText>
              <AppText variant="title" color="#fff">{editId ? t('تعديل الكوبون') : t('أضف كوبون')}</AppText>
            </View>
          </View>
          <AppText variant="small" color="#E2DAEE" style={{ marginTop: 10, lineHeight: 22 }}>
            {t('الكوبون ينضاف لقسم كوبونات {city} بعد الموافقة، ويطلع في صفحة محلك.', { city: m ? cityName(m.city) : t('مدينتك') })}
          </AppText>
          {prm.first ? <View style={st.steps}>{[1, 2, 3, 4].map((i) => <View key={i} style={[st.step, i <= 3 && { backgroundColor: brand.orange }]} />)}</View> : null}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <Field label={t('نوع العرض')}>
            <View style={st.grid}>
              {KINDS.map(([k, sym, t]) => (
                <Pressable key={k} style={[st.kind, kind === k && st.kindOn]} onPress={() => { setKind(k); if (k === 'percent') { setValue('20'); setCustom(false); } else if (k === 'amount') { setValue('25'); setCustom(true); } else setValue(''); }}>
                  <AppText style={{ fontFamily: font.bold, fontSize: 17 }} color={kind === k ? brand.orangeDeep : brand.text} center>{sym}</AppText>
                  <AppText style={{ fontFamily: font.semibold, fontSize: 12 }} center>{t}</AppText>
                </Pressable>
              ))}
            </View>
          </Field>

          {kind === 'percent' ? (
            <Field label={t('قيمة الخصم')}>
              <View style={st.wrap}>
                {PCTS.map((p) => <Chip key={p} label={p + '%'} on={!custom && value === p} color={brand.orangeDeep} onPress={() => { setValue(p); setCustom(false); }} />)}
                <Chip label={t('أخرى')} on={custom} color={brand.orangeDeep} onPress={() => setCustom(true)} />
              </View>
              {custom ? <Input style={{ marginTop: 8 }} value={value} onChangeText={(t) => setValue(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder={t('النسبة (5 – 90)')} /> : null}
            </Field>
          ) : kind === 'amount' ? (
            <Field label={t('قيمة الخصم')} hint={t('بالريال')}>
              <Input value={value} onChangeText={(t) => setValue(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder={t('مثلاً 25')} />
            </Field>
          ) : kind === 'gift' ? (
            <Field label={t('وش الهدية؟')}>
              <Input value={value} onChangeText={setValue} placeholder={t('مثلاً: قهوة سعودية، حلى اليوم')} maxLength={40} />
            </Field>
          ) : null}

          <Field label={t('عنوان الكوبون')} hint={t('يظهر للمستخدم')}>
            <Input value={title} onChangeText={(t) => { setTitle(t); setTouched(true); }} placeholder={t('خصم 20% على وجبات الفطور')} maxLength={90} />
          </Field>

          <Field label={t('الشروط')}>
            <View style={formSt.box}>
              <Row label={t('الحد الأدنى للطلب')}><View style={st.inline}><Input value={minOrder} onChangeText={(t) => setMinOrder(t.replace(/\D/g, '').slice(0, 5))} keyboardType="number-pad" placeholder={t('بدون')} style={st.small} /><AppText variant="small" muted>{t('ر.س')}</AppText></View></Row>
              <Toggle label={t('مرة وحدة لكل مستخدم')} on={perUser} onChange={setPerUser} />
              <Row label={t('عدد الكوبونات المتاحة')}><Input value={qty} onChangeText={(t) => setQty(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder={t('بدون حد')} style={st.small} /></Row>
              <Row label={t('الأوقات')} last><Input value={hours} onChangeText={setHours} placeholder={t('كل الأوقات')} style={[st.small, { width: 150 }]} maxLength={80} /></Row>
            </View>
          </Field>

          <Field label={t('المدة')} hint={end ? `${dayLabel(start)} – ${dayLabel(end)}` : t('من {d}', { d: dayLabel(start) })}>
            <View style={st.wrap}>{DUR.map(([t, n]) => <Chip key={t} label={t} on={dur === n} color={brand.purple} onPress={() => setDur(n)} />)}</View>
            <View style={[st.wrap, { marginTop: 8 }]}>
              <Chip label={t('يبدأ اليوم')} on={start === todayISO()} color={brand.purple} onPress={() => setStart(todayISO())} />
              <Chip label={t('يبدأ بكرة')} on={start === addDays(todayISO(), 1)} color={brand.purple} onPress={() => setStart(addDays(todayISO(), 1))} />
            </View>
          </Field>

          <Field label={t('مكافأة لأهل النقاط')} hint={t('اختياري')}>
            <AppText variant="small" muted style={{ marginBottom: 8, lineHeight: 21 }}>{t('مستخدمين الدليل يجمعون نقاط من المشاركة. خل عرضك يتبادل بالنقاط أو حصري للمستويات العالية، ويوصلك أنشط الناس.')}</AppText>
            <View style={st.wrap}>{PTS.map(([t, n]) => <Chip key={t} label={t} on={points === n} color={brand.purple} onPress={() => setPoints(n)} />)}</View>
            <View style={[st.wrap, { marginTop: 8 }]}>{LVLS.map(([t, n]) => <Chip key={t} label={t} on={minLevel === n} color={brand.lilac} onPress={() => setMinLevel(n)} />)}</View>
          </Field>

          <Field label={t('تفاصيل إضافية')} hint={t('اختياري')}>
            <Input value={terms} onChangeText={setTerms} multiline maxLength={600} placeholder={t('مثلاً: ما يشمل المشروبات، للجلسات الداخلية فقط')} />
          </Field>

          <AppText style={{ fontFamily: font.semibold, fontSize: 13, marginTop: 18 }} muted>{t('معاينة: كذا يشوفه المستخدم')}</AppText>
          <View style={[st.prev, { backgroundColor: bg, shadowColor: bg }]}>
            {m?.photos[0] ? <Image source={m.photos[0]} style={{ width: 96, height: 120 }} contentFit="cover" /> : <View style={st.prevNo}><Icon name="shop" color="#fff" size={28} /></View>}
            <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
              <View>
                <AppText variant="tiny" color="#fff" numberOfLines={1}>{m?.name}{m?.area ? ` · ${m.area}` : ''}</AppText>
                <AppText style={{ fontFamily: font.bold, fontSize: 21, lineHeight: 30 }} color="#fff" numberOfLines={1}>{offOf(kind, value)}</AppText>
                <AppText variant="small" color="#fff" numberOfLines={1}>{title}</AppText>
              </View>
              <AppText variant="tiny" color="#fff">{[points ? t('بـ {n} نقطة', { n: points }) : '', minLevel ? t('مستوى {n}+', { n: minLevel }) : '', end ? t('حتى {d}', { d: dayLabel(end) }) : '', qty ? t('باقي {n}', { n: qty }) : ''].filter(Boolean).join(' · ') || t('عرض مستمر')}</AppText>
            </View>
            <View style={st.prevStub}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#fff">{t('استخدمه')}</AppText></View>
          </View>

          <Field label={t('وين يظهر')}>
            <View style={formSt.box}>
              <Row label={t('كوبونات {city}', { city: m ? cityName(m.city) : t('المدينة') })}><AppText variant="tiny" color={brand.green} style={{ fontFamily: font.semibold }}>{t('تلقائي')}</AppText></Row>
              <Row label={t('صفحة محلك في الدليل')} last><AppText variant="tiny" color={m?.placeId ? brand.green : brand.muted} style={{ fontFamily: font.semibold }}>{m?.placeId ? t('تلقائي') : t('بعد ما نربطها')}</AppText></Row>
            </View>
          </Field>
          <Field label={t('رقم ترخيص التخفيضات')} hint={t('من وزارة التجارة · إجباري')}>
            <Input value={license} onChangeText={setLicense} placeholder={t('رقم الترخيص')} maxLength={40} autoCapitalize="characters" style={{ textAlign: 'left' }} />
            <AppText variant="tiny" muted style={{ marginTop: 6, lineHeight: 18 }}>{t('نظام التخفيضات يلزم كل محل يقدم خصم أو عرض ترويجي يطلع ترخيص من وزارة التجارة (من موقعها أو تطبيقها). الرقم يطلع للعملاء في صفحة الكوبون.')}</AppText>
          </Field>
          <Pressable style={st.agree} onPress={() => setDeclare(!declare)}>
            <View style={[st.box, declare && { backgroundColor: brand.purple, borderColor: brand.purple }]}>{declare ? <Icon name="check" color="#fff" size={14} strokeWidth={3} /> : null}</View>
            <AppText variant="small" style={{ flex: 1, lineHeight: 22 }}>{t('أقر بأني حاصل على ترخيص التخفيضات من وزارة التجارة لهذا العرض وأن الرقم صحيح، وأتحمل مسؤولية العرض كاملة، وألتزم بتطبيقه كما هو مكتوب حسب')} <AppText variant="small" color={brand.link} style={{ fontFamily: font.bold }} onPress={() => router.push('/merchant/terms')}>{t('الشروط والأحكام')}</AppText>.</AppText>
          </Pressable>
          {err ? <AppText center color={brand.pinkDeep} style={{ marginTop: 14, fontFamily: font.semibold }}>{err}</AppText> : null}
        </View>
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable style={[st.cta, !ready && { opacity: 0.5 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color="#fff">{t('أرسل للمراجعة')}</AppText>}
        </Pressable>
        <AppText variant="tiny" muted center style={{ marginTop: 6 }}>{t('بعد الموافقة ينضاف لـ{city} تلقائياً', { city: m ? cityName(m.city) : t('مدينتك') })}</AppText>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: brand.purple, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  glass: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  steps: { flexDirection: 'row', gap: 6, marginTop: 14 },
  step: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { width: '48.5%', height: 66, borderRadius: 16, borderWidth: 1.5, borderColor: brand.line, backgroundColor: brand.card, alignItems: 'center', justifyContent: 'center' },
  kindOn: { borderWidth: 2, borderColor: brand.orange, backgroundColor: brand.softOrange },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  agree: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16, backgroundColor: brand.card, borderRadius: 16, padding: 12 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: brand.faint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  small: { height: 38, width: 90, paddingHorizontal: 10, fontSize: 14 },
  prev: { marginTop: 8, height: 120, borderRadius: 22, flexDirection: 'row', overflow: 'hidden', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  prevNo: { width: 96, height: 120, backgroundColor: 'rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  prevStub: { width: 78, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.06)' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: brand.card, paddingHorizontal: 16, paddingTop: 14, borderTopLeftRadius: 26, borderTopRightRadius: 26, shadowColor: '#2B1F45', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 8 },
  cta: { height: 56, borderRadius: 18, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
});
