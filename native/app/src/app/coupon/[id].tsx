import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Empty, Loading } from '@/components/State';
import { BackButton, Button, Pill } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ReportCoupon } from '@/components/ReportCoupon';
import { cityName } from '@/lib/content';
import { bizKind, couponColor, couponErr, dayLabel, getCouponMe, toggleSave, type Coupon, type Me } from '@/lib/coupons';
import { openDirections } from '@/lib/maps';
import { t } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';
import { track } from '@/lib/track';

/** تفاصيل الكوبون: العرض والشروط والمحل، و«استخدمه الحين» يفتح الرمز */
export default function CouponDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [c, setC] = useState<Coupon | null>(null);
  const [me, setMe] = useState<Me>(null);
  const [err, setErr] = useState('');
  const [rep, setRep] = useState(false);
  useEffect(() => { if (id) track('coupon', Number(id)); }, [id]);
  useFocusEffect(useCallback(() => { getCouponMe(Number(id)).then((r) => { setC(r.coupon); setMe(r.me); }).catch((e) => setErr(couponErr(e))); }, [id, user?.id]));

  if (!c) return <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}><BackButton />{err ? <Empty title={t('الكوبون انتهى أو خلص')} sub={err} /> : <Loading />}</View>;
  const bg = couponColor(c.biz?.kind);
  const used = !!c.usedByMe && c.perUser;
  const rows: [string, string][] = [
    ...(c.points ? [[t('يتبادل بـ'), t('{n} نقطة من رصيدك', { n: c.points })] as [string, string]] : []),
    ...(c.minLevel ? [[t('حصري لـ'), t('المستوى {n} «{name}» وأعلى', { n: c.minLevel, name: c.levelName })] as [string, string]] : []),
    ...(c.minOrder ? [[t('الحد الأدنى للطلب'), t('{n} ر.س', { n: c.minOrder })] as [string, string]] : []),
    [t('الاستخدام'), c.perUser ? t('مرة وحدة لكل شخص') : t('تقدر تستخدمه أكثر من مرة')],
    ...(c.hours ? [[t('الأوقات'), c.hours] as [string, string]] : []),
    [t('المدة'), c.start || c.end ? `${c.start ? t('من {d}', { d: dayLabel(c.start) }) + ' ' : ''}${c.end ? t('حتى {d}', { d: dayLabel(c.end) }) : ''}` : t('مستمر')],
    ...(c.left != null ? [[t('المتبقي'), t('{left} من {qty}', { left: c.left, qty: String(c.qty) })] as [string, string]] : []),
  ];
  const save = async () => { if (!user) return router.push('/login'); const s = await toggleSave(c.id).catch(() => c.saved); setC({ ...c, saved: s }); };

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={[st.head, { backgroundColor: bg, paddingTop: insets.top + 10 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <BackButton light />
            <Pressable style={st.glass} onPress={save} accessibilityLabel={t('احفظ في المحفظة')}><Icon name={c.saved ? 'heartFill' : 'heart'} color="#fff" size={22} /></Pressable>
          </View>
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            {c.biz?.photo ? <Image source={c.biz.photo} style={st.logo} contentFit="cover" /> : <View style={[st.logo, { alignItems: 'center', justifyContent: 'center' }]}><Icon name="shop" color={bg} size={30} /></View>}
            <AppText color="#fff" center style={{ marginTop: 10, fontFamily: font.semibold }}>{c.biz?.name}{c.biz?.verified ? ' ✓' : ''}</AppText>
            <AppText style={{ fontFamily: font.bold, fontSize: 36, lineHeight: 50 }} color="#fff" center>{c.off}</AppText>
            <AppText color="#fff" center>{c.title}</AppText>
          </View>
        </View>

        <View style={st.card}>
          {rows.map(([l, v], i) => (
            <View key={l} style={[st.row, i < rows.length - 1 && st.rowLine]}>
              <AppText variant="small" muted style={{ flex: 1 }}>{l}</AppText>
              <AppText style={{ fontFamily: font.semibold, fontSize: 14 }}>{v}</AppText>
            </View>
          ))}
        </View>
        {c.terms ? (
          <View style={st.card}>
            <AppText style={{ fontFamily: font.bold, marginBottom: 4 }}>{t('الشروط')}</AppText>
            <AppText variant="small" style={{ lineHeight: 24 }}>{c.terms}</AppText>
          </View>
        ) : null}

        {c.biz ? (
          <View style={st.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText style={{ fontFamily: font.bold, flex: 1 }}>{c.biz.name}</AppText>
              {c.biz.verified ? <Pill label={t('موثّق')} bg={brand.softGreen} fg={brand.green} /> : null}
            </View>
            <AppText variant="small" muted>{bizKind(c.biz.kind)} · {cityName(c.biz.city)}{c.biz.area ? ` · ${c.biz.area}` : ''}</AppText>
            {c.biz.trust?.pct != null && c.biz.trust.n >= 3 ? (
              <AppText variant="small" color={c.biz.trust.pct >= 90 ? brand.green : c.biz.trust.pct >= 70 ? brand.orangeDeep : brand.pinkDeep} style={{ fontFamily: font.semibold, marginTop: 4 }}>
                {t('التزام بالعرض {pct}% · من {n} تجربة', { pct: c.biz.trust.pct, n: c.biz.trust.n })}
              </AppText>
            ) : <AppText variant="tiny" muted style={{ marginTop: 4 }}>{t('بعد كل استخدام نسأل العميل: انطبق العرض مثل ما هو مكتوب؟')}</AppText>}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {c.biz.placeId ? <Pressable style={st.mini} onPress={() => router.push(`/place/${c.biz!.placeId}`)}><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.purple}>{t('صفحة المكان')}</AppText></Pressable> : null}
              {c.biz.lat && c.biz.lng ? <Pressable style={st.mini} onPress={() => openDirections(c.biz!.lat, c.biz!.lng, c.biz!.name)}><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.purple}>{t('الاتجاهات')}</AppText></Pressable> : null}
            </View>
          </View>
        ) : null}
        <AppText variant="tiny" muted center style={{ marginTop: 14, paddingHorizontal: 30, lineHeight: 18 }}>{t('العرض مقدّم من المحل نفسه وهو المسؤول عنه')}{c.license ? ` · ${t('رقم ترخيص التخفيضات:')} ${c.license}` : ''}</AppText>
        <View style={st.guard}>
          <AppText variant="small" style={{ fontFamily: font.bold }}>{t('ضمان الدليل')}</AppText>
          <AppText variant="tiny" muted style={{ lineHeight: 19, marginTop: 2 }}>{t('نراجع كل عرض قبل النشر. ولو المحل رفض الكوبون أو غيّر العرض، بلّغنا: نراجع البلاغ، ولو ثبت تاخذ 20 نقطة اعتذار والمحل تنسجل عليه مخالفة.')}</AppText>
          {user ? <Pressable onPress={() => setRep(true)} hitSlop={8}><AppText variant="small" color={brand.pinkDeep} style={{ fontFamily: font.bold, marginTop: 8 }}>{t('بلّغ عن مشكلة في هالكوبون')}</AppText></Pressable> : null}
        </View>
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {used ? <Button label={t('استخدمته ✓')} bg={brand.green} />
          : user && me && c.minLevel && me.level < c.minLevel ? <Button label={t('يحتاج المستوى {n} · مستواك {me}', { n: c.minLevel, me: me.level })} bg={brand.faint} />
          : user && me && c.points && me.balance < c.points ? <Button label={t('تحتاج {n} نقطة زيادة', { n: c.points - me.balance })} bg={brand.faint} onPress={() => router.push('/community')} />
          : <Button label={user ? t('استخدمه الحين') : t('سجّل دخولك عشان تستخدمه')} bg={bg} onPress={() => (user ? router.push({ pathname: '/coupon/use', params: { id: String(c.id) } }) : router.push('/login'))} />}
        <AppText variant="tiny" muted center style={{ marginTop: 6 }}>{c.points && user && me ? t('رصيدك {b} نقطة · تنخصم {n} لما يأكد الكاشير', { b: me.balance, n: c.points }) : t('افتحه وأنت عند الكاشير. الرمز يتغير كل 30 ثانية.')}</AppText>
      </View>
      <ReportCoupon id={c.id} visible={rep} onClose={() => setRep(false)} />
    </View>
  );
}

const st = StyleSheet.create({
  guard: { marginHorizontal: 16, marginTop: 14, backgroundColor: brand.softPurple, borderRadius: 20, padding: 14 },
  head: { paddingHorizontal: 16, paddingBottom: 26, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  glass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 80, height: 80, borderRadius: 24, borderWidth: 3, borderColor: '#fff', backgroundColor: brand.card },
  card: { marginHorizontal: 16, marginTop: 14, backgroundColor: brand.white, borderRadius: 22, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: brand.chip },
  mini: { backgroundColor: brand.softPurple, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: brand.bg },
});
