import { useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Chip, Section } from '@/components/ui';
import { cityCoupons, featuredCoupon } from '@/lib/mock';
import { brand, font, photos } from '@/theme/tokens';

const CATS = ['الكل', 'مطاعم', 'مقاهي', 'حلويات', 'تجارب', 'ينتهي قريباً'];

/** كوبونات المدينة — تجريبي لين تجهز بوابة التجار */
export default function Coupons() {
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState(0);
  const [saved, setSaved] = useState<number[]>([1]);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={[st.head, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable style={st.glass} onPress={() => router.back()} accessibilityLabel="رجوع"><Icon name="back" color="#fff" /></Pressable>
          <View style={{ flex: 1 }}><AppText variant="small" color="#FFE6EC">كوبونات</AppText><AppText variant="title" color="#fff">المدينة المنورة ▾</AppText></View>
          <View style={st.wallet}><AppText style={{ fontFamily: font.bold, fontSize: 18 }} color="#fff" center>{saved.length}</AppText><AppText variant="tiny" color="#fff" center>محفظتي</AppText></View>
        </View>
        <AppText variant="small" color="#fff" style={{ marginTop: 12 }}>42 عرض فعّال من 31 نشاط في مدينتك. احفظ الكوبون واستخدمه عند الكاشير.</AppText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16, paddingBottom: 4 }}>
        {CATS.map((c, i) => <Chip key={c} label={c} on={cat === i} color={brand.pinkDeep} onPress={() => setCat(i)} />)}
      </ScrollView>
      <Section title="عرض الأسبوع" />
      <Pressable style={st.feat} onPress={() => router.push('/coupon/1')}>
        <Image source={photos[featuredCoupon.photo]} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(43,31,69,0.92)', 'rgba(43,31,69,0.1)']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
        <View style={{ padding: 18, width: '62%' }}>
          <View style={st.tag}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>مميز</AppText></View>
          <AppText variant="small" color="#F9A158" style={{ marginTop: 8 }}>{featuredCoupon.biz}</AppText>
          <AppText style={{ fontFamily: font.bold, fontSize: 28, lineHeight: 38 }} color="#fff">{featuredCoupon.off}</AppText>
          <AppText variant="small" color="#fff">{featuredCoupon.desc}</AppText>
        </View>
      </Pressable>
      <Section title="كل العروض" action="الأقرب" />
      <View style={{ gap: 12, paddingHorizontal: 16 }}>
        {cityCoupons.map((c) => {
          const on = saved.includes(c.id);
          return (
            <Pressable key={c.id} style={[st.cp, { backgroundColor: c.bg }]} onPress={() => router.push(`/coupon/${c.id}`)}>
              <Image source={photos[c.photo]} style={{ width: 92, height: 116 }} contentFit="cover" />
              <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
                <View>
                  <AppText variant="tiny" color="#fff">{c.biz} · {c.area}</AppText>
                  <AppText style={{ fontFamily: font.bold, fontSize: 21, lineHeight: 30 }} color="#fff">{c.off}</AppText>
                  <AppText variant="small" color="#fff" numberOfLines={1}>{c.desc}</AppText>
                </View>
                <AppText variant="tiny" color="#fff">{c.left}</AppText>
              </View>
              <Pressable onPress={() => setSaved(on ? saved.filter((x) => x !== c.id) : [...saved, c.id])} style={st.save}>
                <Icon name={on ? 'heartFill' : 'heart'} color="#fff" size={22} />
              </Pressable>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: brand.pink, paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  glass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  wallet: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  feat: { marginHorizontal: 16, height: 190, borderRadius: 26, overflow: 'hidden', backgroundColor: brand.ink, justifyContent: 'center' },
  tag: { alignSelf: 'flex-start', backgroundColor: brand.orange, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  cp: { height: 116, borderRadius: 22, flexDirection: 'row', overflow: 'hidden' },
  save: { width: 64, alignItems: 'center', justifyContent: 'center', borderRightWidth: 2, borderStyle: 'dashed', borderRightColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(0,0,0,0.07)' },
});
