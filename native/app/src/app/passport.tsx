import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { BackButton } from '@/components/ui';
import { me } from '@/lib/mock';
import { brand, font } from '@/theme/tokens';

const STAMPS = [
  ['المدينة المنورة', 'مارس 2024'], ['الرياض', 'يناير 2025'], ['جدة', 'يونيو 2025'], ['العلا', 'ديسمبر 2025'], ['مكة المكرمة', 'مارس 2026'],
  ['الطائف', 'يوليو 2026'], ['أبها', 'أغسطس 2026'], ['ينبع', 'سبتمبر 2026'], ['الدرعية', 'أكتوبر 2026'],
];
const LOCKED = ['تبوك', 'حائل', 'الباحة'];
const COLORS = [brand.orange, brand.lilac, brand.sky, brand.pink, brand.green, brand.purple, brand.orangeDeep, brand.skyDeep, brand.pinkDeep];

/** جواز السعودية — تجريبي لين يتفعل ختم الزيارة بالموقع */
export default function Passport() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={[st.head, { paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><BackButton light /><AppText variant="title" color="#fff">جواز السعودية</AppText></View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 18 }}>
          <AppText style={{ fontFamily: font.bold, fontSize: 56, lineHeight: 66 }} color="#F9A158">9</AppText>
          <AppText style={{ fontFamily: font.bold, fontSize: 22 }} color="#CFC6DE">/ 21</AppText>
        </View>
        <AppText color="#E2DAEE">وجهة ختمتها يا {me.first}. باقي 12 وتصير «سفير الدليل».</AppText>
        <View style={{ flexDirection: 'row', marginTop: 18 }}>
          {[['4', 'مناطق'], ['2,840', 'كم مشيتها'], ['63', 'مكان زرته']].map(([v, l]) => (
            <View key={l} style={{ flex: 1 }}><AppText style={{ fontFamily: font.bold, fontSize: 20 }} color="#fff" center>{v}</AppText><AppText variant="tiny" color="#CFC6DE" center>{l}</AppText></View>
          ))}
        </View>
      </View>
      <View style={st.grid}>
        {STAMPS.map(([c, d], i) => (
          <View key={c} style={st.cell}>
            <View style={[st.stamp, { borderColor: COLORS[i], transform: [{ rotate: `${(i % 3 - 1) * 6}deg` }] }]}>
              <AppText style={{ fontFamily: font.bold, fontSize: 13, lineHeight: 18 }} color={COLORS[i]} center>{c}</AppText>
              <AppText variant="tiny" color={COLORS[i]} center>{d}</AppText>
            </View>
          </View>
        ))}
        {LOCKED.map((c) => (
          <View key={c} style={st.cell}>
            <View style={[st.stamp, { borderColor: '#CFC6DE', borderStyle: 'dashed' }]}>
              <Icon name="lock" color="#B9B1CC" size={18} />
              <AppText variant="tiny" color={brand.faint} center>{c}</AppText>
            </View>
          </View>
        ))}
      </View>
      <View style={st.next}>
        <View style={{ flex: 1 }}>
          <AppText variant="tiny" color="#F9A158" style={{ fontFamily: font.bold }}>الختم الجاي؟</AppText>
          <AppText style={{ fontFamily: font.bold, fontSize: 18 }} color="#fff">تبوك ونيوم</AppText>
          <AppText variant="small" color="#CFC6DE">أفضل وقت: أكتوبر – مارس</AppText>
        </View>
        <Pressable style={st.btn} onPress={() => router.push('/planner')}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#fff">خطط لها</AppText></Pressable>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: brand.ink, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, paddingTop: 18 },
  cell: { width: '33.33%', alignItems: 'center', paddingVertical: 8 },
  stamp: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, alignItems: 'center', justifyContent: 'center', padding: 8, backgroundColor: '#fff' },
  next: { margin: 16, backgroundColor: brand.purple, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: { backgroundColor: brand.orange, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
});
