import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import * as Brightness from 'expo-brightness';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui';
import { couponCode, couponErr, getCoupon, type Coupon } from '@/lib/coupons';
import { brand, font } from '@/theme/tokens';

/** استخدام الكوبون: رمز من السيرفر يتغير كل 30 ثانية (مربوط بحسابك) → الكاشير يدخله → يوصلك تأكيد هنا */
export default function CouponUse() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [c, setC] = useState<Coupon | null>(null);
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(30);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const since = useRef(Math.floor(Date.now() / 1000) - 5);
  const nextAt = useRef(0);

  useEffect(() => { getCoupon(Number(id)).then(setC).catch(() => {}); }, [id]);
  useEffect(() => {
    let prev: number | null = null;
    Brightness.getBrightnessAsync().then((b) => { prev = b; return Brightness.setBrightnessAsync(1); }).catch(() => {});
    return () => { if (prev != null) Brightness.setBrightnessAsync(prev).catch(() => {}); };
  }, []);
  // نسأل السيرفر كل 3 ثواني: نجيب الرمز الجديد لما يتغير، ونعرف إذا الكاشير أكّد
  useEffect(() => {
    if (done) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await couponCode(Number(id), since.current);
        if (!alive) return;
        if (r.redeemed) { setDone(true); return; }
        if (r.code) { setCode(r.code); setLeft(r.left ?? 30); nextAt.current = Date.now() + (r.left ?? 30) * 1000; setErr(''); }
      } catch (e) { if (alive) setErr((e as { code?: string })?.code === 'already_used' ? 'استخدمت هالكوبون قبل. العرض مرة وحدة لكل شخص.' : couponErr(e)); }
    };
    tick();
    const poll = setInterval(tick, 3000);
    const clock = setInterval(() => setLeft(Math.max(0, Math.round((nextAt.current - Date.now()) / 1000))), 500);
    return () => { alive = false; clearInterval(poll); clearInterval(clock); };
  }, [id, done]);

  if (done) {
    return (
      <View style={[st.wrap, { paddingTop: insets.top + 60, backgroundColor: brand.green }]}>
        <View style={st.doneIcon}><Icon name="check" color={brand.green} size={54} strokeWidth={3} /></View>
        <AppText style={{ fontFamily: font.bold, fontSize: 28, lineHeight: 40, marginTop: 20 }} color="#fff" center>تم استخدام الكوبون</AppText>
        <AppText color="#fff" center>{c ? `${c.off} في ${c.biz?.name ?? ''}` : ''}</AppText>
        <AppText variant="small" color="#E2F0E6" center style={{ marginTop: 6 }}>بالعافية! لا تنسى تقيّم المكان بعدين.</AppText>
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(insets.bottom, 16) + 10, gap: 10 }}>
          {c?.biz?.placeId ? <Button label="قيّم المكان" bg="rgba(255,255,255,0.2)" onPress={() => router.replace({ pathname: '/review/[id]', params: { id: String(c.biz!.placeId) } })} /> : null}
          <Button label="تمام" bg={brand.card} fg={brand.green} onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const digits = (code || '····').split('');
  return (
    <View style={[st.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} style={st.close} accessibilityLabel="إغلاق"><AppText color="#fff" style={{ fontSize: 22 }}>×</AppText></Pressable>
        <View style={st.pill}><AppText variant="small" color="#fff">السطوع رفعناه لك</AppText></View>
      </View>
      <View style={{ alignItems: 'center', marginTop: 24 }}>
        {c?.biz?.photo ? <Image source={c.biz.photo} style={st.logo} contentFit="cover" /> : <View style={[st.logo, { backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' }]}><Icon name="ticket" color="#fff" size={30} /></View>}
        <AppText color="#E2DAEE" style={{ marginTop: 10 }} center>{c?.biz?.name ?? ''}{c?.biz?.area ? ` · ${c.biz.area}` : ''}</AppText>
        <AppText variant="hero" color="#fff" center>{c?.off ?? ''}</AppText>
        <AppText variant="small" color="#E2DAEE" center>{c?.title ?? ''}{c?.minOrder ? ` · الحد الأدنى ${c.minOrder} ر.س` : ''}</AppText>
      </View>
      <View style={st.box}>
        <AppText variant="small" muted center style={{ fontFamily: font.semibold }}>اعرض الرمز للكاشير</AppText>
        {err && !code ? (
          <AppText center style={{ marginTop: 18, paddingHorizontal: 16, fontFamily: font.semibold }} color={brand.pinkDeep}>{err}</AppText>
        ) : (
          <View style={st.digits}>
            {digits.map((d, i) => <View key={i} style={st.digit}><AppText style={{ fontFamily: font.bold, fontSize: 36, lineHeight: 46 }} center>{d}</AppText></View>)}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          {code ? (
            <>
              <Svg width={26} height={26} viewBox="0 0 36 36"><Circle cx={18} cy={18} r={15} fill="none" stroke={brand.chip} strokeWidth={5} /><Circle cx={18} cy={18} r={15} fill="none" stroke={brand.orange} strokeWidth={5} strokeDasharray="94" strokeDashoffset={94 - (94 * left) / 30} transform="rotate(-90 18 18)" strokeLinecap="round" /></Svg>
              <AppText style={{ fontFamily: font.semibold }}>يتجدد بعد {left} ثانية</AppText>
            </>
          ) : !err ? <ActivityIndicator color={brand.purple} /> : null}
        </View>
      </View>
      <AppText variant="small" color="#CFC6DE" center style={{ marginTop: 18, lineHeight: 24 }}>الرمز يتغير كل 30 ثانية عشان يكون لك أنت فقط.{'\n'}بعد ما يدخله الكاشير يوصلك تأكيد هنا.</AppText>
      {c?.terms ? (
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(insets.bottom, 16) + 10 }}>
          <AppText variant="tiny" color="#CFC6DE" center numberOfLines={3}>{c.terms}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: brand.purple, paddingHorizontal: 20 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  pill: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  logo: { width: 76, height: 76, borderRadius: 24, borderWidth: 3, borderColor: brand.orange },
  box: { marginTop: 28, alignSelf: 'center', width: 300, backgroundColor: brand.card, borderRadius: 28, paddingVertical: 22 },
  digits: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 12, direction: 'ltr' },
  digit: { width: 52, height: 66, borderRadius: 16, backgroundColor: brand.bg, alignItems: 'center', justifyContent: 'center' },
  doneIcon: { alignSelf: 'center', width: 110, height: 110, borderRadius: 55, backgroundColor: brand.card, alignItems: 'center', justifyContent: 'center' },
});
