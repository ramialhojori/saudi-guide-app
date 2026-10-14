import { useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Chip } from '@/components/ui';
import { prefs } from '@/lib/prefs';
import { brand, font, kindStyle, photos } from '@/theme/tokens';

const KINDS: { id: string; t: string; icon: IconName }[] = [
  { id: 'sights', t: 'معالم', icon: 'sights' }, { id: 'heritage', t: 'تراث', icon: 'heritage' }, { id: 'islamic', t: 'معالم إسلامية', icon: 'mosque' },
  { id: 'nature', t: 'طبيعة', icon: 'nature' }, { id: 'fun', t: 'ترفيه', icon: 'fun' }, { id: 'food', t: 'مطاعم', icon: 'food' },
  { id: 'cafe', t: 'مقاهي', icon: 'cafe' }, { id: 'shopping', t: 'تسوق', icon: 'shop' }, { id: 'family', t: 'مع العائلة', icon: 'family' },
];
const CITIES = ['العلا', 'أبها', 'جدة', 'الرياض', 'الطائف', 'تبوك', 'ينبع', 'الدرعية'];

/** الترحيب أول مرة: ٣ خطوات — مقدمة، الاهتمامات، الأذونات */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [kinds, setKinds] = useState<string[]>(['sights', 'heritage', 'nature', 'food', 'cafe']);
  const [cities, setCities] = useState<string[]>(['العلا', 'أبها']);
  const finish = async () => { await prefs.setInterests(kinds, cities); await prefs.setOnboarded(); router.replace('/'); };
  const dots = <View style={{ flexDirection: 'row', gap: 6 }}>{[0, 1, 2].map((i) => <View key={i} style={{ width: i === step ? 26 : 7, height: 7, borderRadius: 4, backgroundColor: i === step ? brand.orange : step === 0 ? 'rgba(255,255,255,0.4)' : '#E2DAEC' }} />)}</View>;

  if (step === 0) return (
    <View style={{ flex: 1, backgroundColor: brand.ink }}>
      <Image source={photos.land} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['rgba(32,22,54,0.15)', 'rgba(32,22,54,0.97)']} locations={[0, 0.62]} style={StyleSheet.absoluteFill} />
      <View style={[st.topRow, { top: insets.top + 12 }]}>
        <Image source={require('../../assets/brand/logo-white.png')} style={{ width: 130, height: 36 }} contentFit="contain" />
        <View style={st.glassBtn}><AppText variant="small" color="#fff" style={{ fontFamily: font.semibold }}>English</AppText></View>
      </View>
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>
        {dots}
        <AppText variant="hero" color="#fff" style={{ fontSize: 34, lineHeight: 48, marginTop: 18 }}>السعودية كلها{'\n'}في جيبك</AppText>
        <AppText color="#E2DAEE" style={{ lineHeight: 28, marginTop: 8 }}>أكثر من 1,500 مكان في 21 وجهة، فعاليات كل أسبوع، وأهل الديرة يجاوبونك.</AppText>
        <View style={{ gap: 10, marginTop: 26 }}>
          <Button label="ابدأ" onPress={() => setStep(1)} />
          <Button label="عندي حساب" bg="rgba(255,255,255,0.14)" onPress={() => { prefs.setOnboarded(); router.replace('/login'); }} />
        </View>
      </View>
    </View>
  );

  if (step === 1) return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 140 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>{[0, 1, 2].map((i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < 2 ? brand.orange : brand.line }} />)}</View>
        <AppText variant="title" style={{ fontSize: 26, marginTop: 20 }}>وش يهمك؟</AppText>
        <AppText muted>نرتب لك الرئيسية والإشعارات على ذوقك. اختر 3 أو أكثر.</AppText>
        <View style={st.grid}>
          {KINDS.map((k) => {
            const on = kinds.includes(k.id); const ks = kindStyle[k.id] ?? { fg: brand.orangeDeep, bg: brand.softOrange };
            return (
              <Pressable key={k.id} onPress={() => setKinds(on ? kinds.filter((x) => x !== k.id) : [...kinds, k.id])}
                style={[st.kind, { borderColor: on ? ks.fg : brand.line, borderWidth: on ? 2 : 1.5, backgroundColor: on ? ks.bg : brand.card }]}>
                <Icon name={k.icon} color={ks.fg} size={28} />
                <AppText variant="small" style={{ fontFamily: font.semibold }} center>{k.t}</AppText>
                {on ? <View style={[st.tick, { backgroundColor: ks.fg }]}><Icon name="check" color="#fff" size={12} strokeWidth={3} /></View> : null}
              </Pressable>
            );
          })}
        </View>
        <AppText style={{ fontFamily: font.bold, marginTop: 22 }}>مدينتك</AppText>
        <View style={st.cityBox}><Icon name="pin" color={brand.pink} size={20} /><AppText style={{ flex: 1, fontFamily: font.semibold }}>المدينة المنورة</AppText><AppText variant="small" color={brand.green} style={{ fontFamily: font.semibold }}>من موقعك</AppText></View>
        <AppText style={{ fontFamily: font.bold, marginTop: 18 }}>مدن ودك تزورها</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {CITIES.map((c, i) => <Chip key={c} label={c} on={cities.includes(c)} color={[brand.sky, brand.purple, brand.pink, brand.orange][i % 4]} onPress={() => setCities(cities.includes(c) ? cities.filter((x) => x !== c) : [...cities, c])} />)}
        </View>
      </ScrollView>
      <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}><Button label={kinds.length < 3 ? `اختر ${3 - kinds.length} كمان` : 'خلّصنا'} onPress={() => kinds.length >= 3 && setStep(2)} bg={kinds.length < 3 ? brand.inactive : brand.orange} /></View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FDF6EE', paddingTop: insets.top + 30, paddingHorizontal: 24, alignItems: 'center' }}>
      {dots}
      <View style={st.art}>
        <View style={[StyleSheet.absoluteFill, { borderRadius: 110, backgroundColor: brand.softOrange }]} />
        <View style={{ position: 'absolute', top: 34, left: 34, right: 34, bottom: 34, borderRadius: 80, backgroundColor: '#F9C9A0' }} />
        <View style={st.artPin}><Icon name="pin" color={brand.orangeDeep} size={40} /></View>
        <View style={[st.artSide, { top: 10, left: 0, backgroundColor: brand.purple }]}><Icon name="bell" color="#fff" size={24} /></View>
        <View style={[st.artSide, { bottom: 14, right: 0, backgroundColor: brand.pink, width: 50, height: 50 }]}><Icon name="ticket" color="#fff" size={22} /></View>
      </View>
      <AppText variant="title" center style={{ fontSize: 26, marginTop: 26 }}>خلّنا نعرف وين أنت</AppText>
      <AppText muted center style={{ lineHeight: 28, marginTop: 8 }}>عشان نرتب الأماكن الأقرب، ونعطيك كوبونات مدينتك، ونختم جوازك لما تزور مدينة جديدة.</AppText>
      <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8, backgroundColor: 'transparent' }]}>
        <Button label="موافق، كمّل" onPress={async () => { await Location.requestForegroundPermissionsAsync().catch(() => null); finish(); }} />
        <Pressable onPress={finish} style={{ marginTop: 12 }}><AppText center muted style={{ fontFamily: font.semibold }}>مو الحين</AppText></Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  topRow: { position: 'absolute', right: 20, left: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  glassBtn: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 19, paddingHorizontal: 14, paddingVertical: 8 },
  bottom: { position: 'absolute', right: 24, left: 24, bottom: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  kind: { width: '31%', height: 98, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 6 },
  tick: { position: 'absolute', top: 8, left: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cityBox: { marginTop: 8, height: 52, backgroundColor: brand.card, borderWidth: 1.5, borderColor: brand.line, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  footer: { position: 'absolute', left: 20, right: 20, bottom: 0, paddingTop: 12, backgroundColor: brand.bg },
  art: { width: 220, height: 220, marginTop: 34 },
  artPin: { position: 'absolute', top: 70, left: 70, width: 80, height: 80, borderRadius: 28, backgroundColor: brand.card, alignItems: 'center', justifyContent: 'center' },
  artSide: { position: 'absolute', width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
