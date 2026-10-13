import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import * as Brightness from 'expo-brightness';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/ui';
import { cityCoupons } from '@/lib/mock';
import { brand, font, photos } from '@/theme/tokens';

/** استخدام الكوبون: رمز يتغير كل 30 ثانية عشان ما ينفع تصويره ومشاركته */
export default function CouponUse() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const c = cityCoupons.find((x) => String(x.id) === id) ?? cityCoupons[0];
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let prev: number | null = null;
    Brightness.getBrightnessAsync().then((b) => { prev = b; return Brightness.setBrightnessAsync(1); }).catch(() => {});
    return () => { if (prev != null) Brightness.setBrightnessAsync(prev).catch(() => {}); };
  }, []);
  const slot = Math.floor(now / 30000), left = 30 - Math.floor((now / 1000) % 30);
  // رمز تجريبي من رقم الكوبون والوقت — في النسخة الحقيقية يجي من السيرفر وموقّع
  const code = String((slot * 7919 + c.id * 104729) % 10000).padStart(4, '0');

  return (
    <View style={{ flex: 1, backgroundColor: brand.purple, paddingTop: insets.top + 10, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} style={st.close} accessibilityLabel="إغلاق"><AppText color="#fff" style={{ fontSize: 22 }}>×</AppText></Pressable>
        <View style={st.pill}><AppText variant="small" color="#fff">السطوع رفعناه لك</AppText></View>
      </View>
      <View style={{ alignItems: 'center', marginTop: 24 }}>
        <Image source={photos[c.photo]} style={{ width: 76, height: 76, borderRadius: 24, borderWidth: 3, borderColor: brand.orange }} contentFit="cover" />
        <AppText color="#E2DAEE" style={{ marginTop: 10 }} center>{c.biz} · {c.area}</AppText>
        <AppText variant="hero" color="#fff" center>{c.off}</AppText>
        <AppText variant="small" color="#E2DAEE" center>{c.desc}{c.min ? ` · ${c.min}` : ''}</AppText>
      </View>
      <View style={st.box}>
        <AppText variant="small" muted center style={{ fontFamily: font.semibold }}>اعرض الرمز للكاشير</AppText>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 12 }}>
          {code.split('').reverse().map((d, i) => <View key={i} style={st.digit}><AppText style={{ fontFamily: font.bold, fontSize: 36, lineHeight: 46 }} center>{d}</AppText></View>)}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <Svg width={26} height={26} viewBox="0 0 36 36"><Circle cx={18} cy={18} r={15} fill="none" stroke={brand.chip} strokeWidth={5} /><Circle cx={18} cy={18} r={15} fill="none" stroke={brand.orange} strokeWidth={5} strokeDasharray="94" strokeDashoffset={94 - (94 * left) / 30} transform="rotate(-90 18 18)" strokeLinecap="round" /></Svg>
          <AppText style={{ fontFamily: font.semibold }}>يتجدد بعد {left} ثانية</AppText>
        </View>
      </View>
      <AppText variant="small" color="#CFC6DE" center style={{ marginTop: 18, lineHeight: 24 }}>الرمز يتغير كل 30 ثانية عشان يكون لك أنت فقط.{'\n'}بعد ما يدخله الكاشير يوصلك تأكيد هنا.</AppText>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(insets.bottom, 16) + 10 }}><Button label="عرض الشروط كاملة" bg="rgba(255,255,255,0.14)" /></View>
    </View>
  );
}

const st = StyleSheet.create({
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  pill: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  box: { marginTop: 28, alignSelf: 'center', width: 300, backgroundColor: '#fff', borderRadius: 28, paddingVertical: 22 },
  digit: { width: 52, height: 66, borderRadius: 16, backgroundColor: brand.bg, alignItems: 'center', justifyContent: 'center' },
});
