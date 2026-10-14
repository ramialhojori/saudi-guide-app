import { useCallback, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { BackButton, Button, Pill } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { cityName } from '@/lib/content';
import { bizKind, couponErr, dayLabel, editCoupon, myMerchant, redeem, type Coupon, type Merchant, type MStats } from '@/lib/coupons';
import { brand, font } from '@/theme/tokens';

const DAYS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']; // الأحد = 0
const FULL = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const CST: Record<string, [string, string, string]> = {
  pending: ['قيد المراجعة', brand.softOrange, brand.orangeDeep], active: ['فعّال', brand.softGreen, brand.green],
  paused: ['موقوف مؤقتاً', brand.chip, brand.muted], rejected: ['يحتاج تعديل', brand.softPink, brand.pinkDeep],
};

/** لوحة التاجر: حالة الطلب، الكوبونات، تأكيد الاستخدام عند الكاشير، وأرقام الأسبوع */
export default function MerchantHome() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [m, setM] = useState<Merchant | null | undefined>(undefined);
  const [cs, setCs] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<MStats | null>(null);
  const [trust, setTrust] = useState<{ n: number; ok: number; pct: number | null; open: number } | null>(null);
  const [strikes, setStrikes] = useState(0);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inp = useRef<TextInput>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try { const r = await myMerchant(); setM(r.merchant); setCs(r.coupons); setStats(r.stats ?? null); setTrust(r.trust ?? null); setStrikes(r.merchant?.strikes ?? 0); } catch { setM((x) => (x === undefined ? null : x)); }
  }, [user?.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        <BackButton />
        <Intro onGo={() => router.push('/login')} cta="سجّل دخولك أول" />
      </View>
    );
  }
  if (m === undefined) return <View style={{ flex: 1, backgroundColor: brand.bg, justifyContent: 'center' }}><ActivityIndicator color={brand.purple} /></View>;
  if (m === null) {
    return (
      <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        <BackButton />
        <Intro onGo={() => router.push('/merchant/join')} cta="سجّل نشاطك" />
      </View>
    );
  }

  const check = async () => {
    if (code.length !== 4) return;
    setChecking(true); setResult(null);
    try { const r = await redeem(code); setResult({ ok: true, text: `تم ✓ ${r.coupon.off} — ${r.coupon.title}` }); setCode(''); load(); }
    catch (e) { setResult({ ok: false, text: couponErr(e) }); } finally { setChecking(false); }
  };
  const act = (c: Coupon, action: 'pause' | 'resume' | 'remove') => {
    const go = async () => { try { await editCoupon(c.id, { action }); load(); } catch (e) { Alert.alert('ما تم', couponErr(e)); } };
    if (action === 'remove') Alert.alert('تشيل الكوبون؟', 'يختفي من التطبيق، وتقدر تضيف كوبون جديد مكانه.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'شيله', style: 'destructive', onPress: go }]);
    else go();
  };

  const approved = m.status === 'approved';
  const live = cs.filter((c) => ['pending', 'active', 'paused'].includes(c.status)).length;
  const canAdd = live < m.maxCoupons && m.status !== 'hidden';
  // أيام الأسبوع: آخر 7 أيام لين اليوم
  const week = stats?.week ?? [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(1, ...week);
  const dow = stats ? (stats.today + 4) % 7 : new Date().getDay();
  const top = week.indexOf(Math.max(...week));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <View style={[st.head, { paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable style={st.glass} onPress={() => router.back()} accessibilityLabel="رجوع"><Icon name="back" color="#fff" size={20} /></Pressable>
          {m.photos[0] ? <Image source={m.photos[0]} style={st.logo} contentFit="cover" /> : <View style={[st.logo, st.logoNo]}><Icon name="shop" color="#fff" size={24} /></View>}
          <View style={{ flex: 1 }}>
            <AppText variant="tiny" color="#F9A158" style={{ fontFamily: font.semibold }}>دليل السعودية للأعمال</AppText>
            <AppText variant="title" color="#fff" numberOfLines={1}>{m.name}</AppText>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {m.verified ? <View style={st.ver}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.semibold }}>موثّق</AppText></View> : null}
              <AppText variant="tiny" color="#CFC6DE">{cityName(m.city)} · {m.maxCoupons > 1 ? 'باقة مميزة' : 'الباقة المجانية'}</AppText>
            </View>
          </View>
          <Pressable style={st.glass} onPress={() => router.push('/merchant/join')} accessibilityLabel="تعديل بيانات النشاط"><Icon name="edit" color="#fff" size={18} /></Pressable>
        </View>
        {approved ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Stat n={stats?.views ?? 0} l="مشاهدة للكوبون" />
            <Stat n={stats?.saves ?? 0} l="حفظ في المحفظة" />
            <Stat n={stats?.used ?? 0} l="كوبون استُخدم" hot />
          </View>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        {/* الشروط تحدثت: لازم يوافق قبل أي كوبون جديد */}
        {!m.termsOk ? (
          <Pressable style={[st.card, { borderWidth: 2, borderColor: brand.orange }]} onPress={() => router.push('/merchant/terms?accept=1')}>
            <AppText style={{ fontFamily: font.bold, fontSize: 16 }}>وافق على الشروط والأحكام</AppText>
            <AppText variant="small" muted style={{ lineHeight: 21 }}>{m.termsVersion ? 'حدّثنا الشروط والأحكام للتجار. اقرأها ووافق عليها عشان تقدر تضيف أو تعدّل كوبون.' : 'لازم توافق على الشروط والأحكام قبل ما تضيف كوبون.'}</AppText>
            <AppText variant="small" color={brand.link} style={{ fontFamily: font.bold, marginTop: 6 }}>اقرأ ووافق</AppText>
          </Pressable>
        ) : null}

        {/* حالة الطلب */}
        {!approved ? (
          <View style={[st.card, { borderWidth: 2, borderColor: m.status === 'pending' ? brand.orange : brand.pinkDeep }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[st.sIcon, { backgroundColor: m.status === 'pending' ? brand.softOrange : brand.softPink }]}><Icon name={m.status === 'pending' ? 'info' : 'x'} color={m.status === 'pending' ? brand.orangeDeep : brand.pinkDeep} size={22} /></View>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontFamily: font.bold, fontSize: 16 }}>{m.status === 'pending' ? 'طلبك قيد المراجعة' : m.status === 'rejected' ? 'الطلب يحتاج تعديل' : 'النشاط موقوف'}</AppText>
                <AppText variant="small" muted>{m.status === 'pending' ? 'نراجعه خلال 24 ساعة، ويوصلك إشعار أول ما ينعتمد.' : m.note || 'عدّل البيانات وأرسلها مرة ثانية.'}</AppText>
              </View>
            </View>
            {m.status === 'rejected' ? <Button label="عدّل الطلب" h={46} style={{ marginTop: 12 }} onPress={() => router.push('/merchant/join')} /> : null}
          </View>
        ) : null}

        {/* الالتزام: رأي العملاء بعد الاستخدام + المخالفات */}
        {approved ? (
          <View style={[st.card, strikes ? { borderWidth: 2, borderColor: brand.pinkDeep } : null]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AppText style={{ fontFamily: font.bold, fontSize: 16, flex: 1 }}>التزامك بالعروض</AppText>
              <AppText style={{ fontFamily: font.bold, fontSize: 20 }} color={trust?.pct == null ? brand.muted : trust.pct >= 90 ? brand.green : trust.pct >= 70 ? brand.orangeDeep : brand.pinkDeep}>{trust?.pct == null ? '—' : trust.pct + '%'}</AppText>
            </View>
            <AppText variant="small" muted style={{ lineHeight: 21 }}>{trust?.n ? `من ${trust.n} عميل جاوب «انطبق العرض؟». النسبة تطلع للعملاء في صفحة الكوبون.` : 'بعد كل استخدام نسأل العميل: انطبق العرض مثل ما هو مكتوب؟ والنسبة تطلع للعملاء.'}</AppText>
            {strikes ? <AppText variant="small" color={brand.pinkDeep} style={{ fontFamily: font.bold, marginTop: 6 }}>عليك {strikes} مخالفة مؤكدة من 3. عند 3 يتوقف النشاط.</AppText> : null}
            {trust?.open ? <AppText variant="small" color={brand.orangeDeep} style={{ marginTop: 4 }}>فيه {trust.open} بلاغ من عملاء تحت المراجعة.</AppText> : null}
          </View>
        ) : null}

        {/* تأكيد الاستخدام */}
        {approved ? (
          <View style={st.card}>
            <AppText style={{ fontFamily: font.bold, fontSize: 16 }}>تأكيد الاستخدام عند الكاشير</AppText>
            <AppText variant="small" muted style={{ lineHeight: 21, marginTop: 2 }}>العميل يفتح الكوبون في التطبيق ويطلع له رمز يتغير كل 30 ثانية، أدخله هنا. كذا ما ينفع تصوير الشاشة.</AppText>
            <Pressable style={st.digits} onPress={() => inp.current?.focus()}>
              {[0, 1, 2, 3].map((i) => <View key={i} style={[st.digit, code.length === i && { borderColor: brand.purple }]}><AppText style={{ fontFamily: font.bold, fontSize: 24, lineHeight: 34 }} center>{code[i] ?? ''}</AppText></View>)}
            </Pressable>
            <TextInput ref={inp} value={code} onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 4)); setResult(null); }} keyboardType="number-pad" maxLength={4} style={st.hidden} onSubmitEditing={check} accessibilityLabel="رمز الكوبون" />
            {result ? <AppText center style={{ marginTop: 10, fontFamily: font.semibold }} color={result.ok ? brand.green : brand.pinkDeep}>{result.text}</AppText> : null}
            <Pressable style={[st.confirm, code.length !== 4 && { opacity: 0.5 }]} onPress={check} disabled={checking || code.length !== 4}>
              {checking ? <ActivityIndicator color="#fff" /> : <AppText style={{ fontFamily: font.semibold, fontSize: 15 }} color="#fff">تأكيد</AppText>}
            </Pressable>
          </View>
        ) : null}

        {/* الأسبوع */}
        {approved ? (
          <View style={st.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <AppText style={{ fontFamily: font.bold, fontSize: 16 }}>استخدام الكوبون آخر 7 أيام</AppText>
              {week.some(Boolean) ? <AppText variant="tiny" muted>{FULL[(dow - 6 + top + 7) % 7]} الأعلى</AppText> : null}
            </View>
            <View style={st.bars}>
              {week.map((v, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <AppText variant="tiny" muted>{v || ''}</AppText>
                  <View style={{ width: '100%', height: Math.max(6, (v / max) * 90), borderRadius: 8, backgroundColor: i === top && v ? brand.orange : brand.lilac, opacity: v ? 1 : 0.25 }} />
                  <AppText variant="tiny" muted>{DAYS[(dow - 6 + i + 7) % 7]}</AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* الكوبونات */}
        <View style={st.secRow}>
          <AppText variant="section">كوبوناتي</AppText>
          {canAdd ? <Pressable onPress={() => router.push('/merchant/coupon')}><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.link}>+ كوبون جديد</AppText></Pressable> : null}
        </View>
        {cs.map((c) => {
          const s = CST[c.status] ?? CST.paused;
          const pct = c.qty ? Math.min(1, c.used / c.qty) : 0;
          return (
            <View key={c.id} style={[st.card, { marginTop: 10 }]}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={st.off}><AppText style={{ fontFamily: font.bold, fontSize: c.off.length > 8 ? 11 : 14 }} color="#fff" center numberOfLines={2}>{c.kind === 'percent' ? c.value + '%' : c.kind === 'amount' ? c.value + ' ر.س' : c.kind === 'bogo' ? '1+1' : 'هدية'}</AppText></View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontFamily: font.semibold, fontSize: 14.5 }} numberOfLines={2}>{c.title}</AppText>
                  <AppText variant="tiny" muted>استُخدم {c.used}{c.qty ? ` من ${c.qty}` : ''}{c.end ? ` · ينتهي ${dayLabel(c.end)}` : ''}</AppText>
                  {c.qty ? <View style={st.track}><View style={[st.fill, { width: `${pct * 100}%` }]} /></View> : null}
                </View>
                <Pill label={s[0]} bg={s[1]} fg={s[2]} />
              </View>
              {c.status === 'rejected' && c.note ? <AppText variant="small" color={brand.pinkDeep} style={{ marginTop: 8 }}>ملاحظة الإدارة: {c.note}</AppText> : null}
              <View style={st.acts}>
                <Pressable style={st.act} onPress={() => router.push({ pathname: '/merchant/coupon', params: { id: String(c.id) } })}><AppText variant="small" style={{ fontFamily: font.semibold }} color={brand.link}>تعديل</AppText></Pressable>
                {c.status === 'active' ? <Pressable style={st.act} onPress={() => act(c, 'pause')}><AppText variant="small" style={{ fontFamily: font.semibold }}>إيقاف مؤقت</AppText></Pressable> : null}
                {c.status === 'paused' ? <Pressable style={st.act} onPress={() => act(c, 'resume')}><AppText variant="small" style={{ fontFamily: font.semibold }} color={brand.green}>تشغيل</AppText></Pressable> : null}
                <Pressable style={st.act} onPress={() => act(c, 'remove')}><AppText variant="small" style={{ fontFamily: font.semibold }} color={brand.pinkDeep}>شيله</AppText></Pressable>
              </View>
            </View>
          );
        })}
        {!cs.length ? (
          <Pressable style={[st.card, { marginTop: 10, alignItems: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: brand.faint }]} onPress={() => router.push('/merchant/coupon')}>
            <Icon name="ticket" color={brand.orangeDeep} size={28} />
            <AppText style={{ fontFamily: font.bold }}>أضف كوبونك الأول</AppText>
            <AppText variant="small" muted center>الكوبون هو اللي يجيب لك زوار الدليل. خله واضح ومغري.</AppText>
          </Pressable>
        ) : null}
        {!canAdd && cs.length ? <AppText variant="tiny" muted center style={{ marginTop: 10 }}>باقتك تسمح بـ{m.maxCoupons === 1 ? 'كوبون فعّال واحد' : `${m.maxCoupons} كوبونات فعّالة`}. شيل واحد عشان تضيف غيره.</AppText> : null}

        <View style={st.premium}>
          <AppText variant="tiny" color="#F9A158" style={{ fontFamily: font.semibold }}>الباقة المميزة · قريباً</AppText>
          <AppText style={{ fontFamily: font.bold, fontSize: 17, marginTop: 2 }} color="#fff">اظهر أول في {cityName(m.city)}</AppText>
          <AppText variant="small" color="#E2DAEE" style={{ lineHeight: 21, marginTop: 4 }}>ظهور في الرئيسية، 3 كوبونات فعّالة، إشعار للمهتمين بنشاطك في مدينتك، وتقرير شهري.</AppText>
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ n, l, hot }: { n: number; l: string; hot?: boolean }) {
  return (
    <View style={[st.stat, hot && { backgroundColor: brand.orange }]}>
      <AppText style={{ fontFamily: font.bold, fontSize: 20, lineHeight: 28 }} color="#fff" center>{n.toLocaleString('en')}</AppText>
      <AppText variant="tiny" color={hot ? '#fff' : '#CFC6DE'} center>{l}</AppText>
    </View>
  );
}

function Intro({ onGo, cta }: { onGo: () => void; cta: string }) {
  return (
    <View style={{ marginTop: 20 }}>
      <View style={st.intro}>
        <View style={st.introIcon}><Icon name="shop" color="#fff" size={32} /></View>
        <AppText variant="small" color="#F9A158" center style={{ fontFamily: font.semibold, marginTop: 14 }}>دليل السعودية للأعمال</AppText>
        <AppText variant="title" color="#fff" center>عندك مطعم أو مقهى أو متجر؟</AppText>
        <AppText variant="small" color="#E2DAEE" center style={{ lineHeight: 22, marginTop: 6 }}>سجّل نشاطك مجاناً، وأضف عرض يوصل لزوار مدينتك اللي يستخدمون الدليل.</AppText>
      </View>
      {[['pin', 'تظهر في كوبونات مدينتك وصفحة محلك'], ['ticket', 'رمز يتغير كل 30 ثانية يمنع التلاعب'], ['spark', 'تشوف كم واحد شاف واستخدم العرض']].map(([i, t]) => (
        <View key={t} style={st.point}>
          <View style={st.pointIcon}><Icon name={i as 'pin'} color={brand.orangeDeep} size={20} /></View>
          <AppText style={{ flex: 1, fontFamily: font.semibold, fontSize: 14 }}>{t}</AppText>
        </View>
      ))}
      <Button label={cta} style={{ marginTop: 20 }} onPress={onGo} />
      <AppText variant="tiny" muted center style={{ marginTop: 8 }}>مجاني الحين · نراجع كل طلب خلال 24 ساعة</AppText>
    </View>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: '#2B2745', paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  glass: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 54, height: 54, borderRadius: 16, borderWidth: 2, borderColor: brand.orange },
  logoNo: { backgroundColor: brand.purple, alignItems: 'center', justifyContent: 'center' },
  ver: { backgroundColor: brand.green, borderRadius: 6, paddingHorizontal: 8 },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 10 },
  card: { marginTop: 14, backgroundColor: brand.card, borderRadius: 22, padding: 16 },
  sIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  digits: { flexDirection: 'row', gap: 8, marginTop: 12, direction: 'ltr' },
  digit: { flex: 1, height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: brand.line, alignItems: 'center', justifyContent: 'center' },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  confirm: { height: 50, marginTop: 12, borderRadius: 14, backgroundColor: brand.purple, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 130, marginTop: 12 },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 20 },
  off: { width: 52, height: 52, borderRadius: 16, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center', padding: 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: brand.chip, marginTop: 6 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: brand.orange },
  acts: { flexDirection: 'row', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: brand.chip, paddingTop: 10 },
  act: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: brand.chip },
  premium: { marginTop: 18, backgroundColor: brand.lilac, borderRadius: 22, padding: 16 },
  intro: { backgroundColor: brand.purple, borderRadius: 28, padding: 22, alignItems: 'center' },
  introIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderRadius: 18, padding: 12, marginTop: 10 },
  pointIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: brand.softOrange, alignItems: 'center', justifyContent: 'center' },
});
