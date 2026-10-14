import { useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { BackButton, Chip } from '@/components/ui';
import { getCities } from '@/lib/content';
import { useAsync } from '@/lib/useAsync';
import type { City } from '@/lib/types';
import { brand, font } from '@/theme/tokens';

const REGIONS: { id: string; label: string; ids: string[] }[] = [
  { id: 'all', label: 'الكل', ids: [] },
  { id: 'west', label: 'الغربية', ids: ['medina', 'jeddah', 'makkah-region', 'taif', 'yanbu', 'alula', 'umluj'] },
  { id: 'center', label: 'الوسطى', ids: ['riyadh', 'diriyah', 'riyadh-region', 'qassim-region'] },
  { id: 'south', label: 'الجنوب', ids: ['abha', 'asir-region', 'jizan', 'najran', 'albaha'] },
  { id: 'north', label: 'الشمال', ids: ['tabuk-region', 'hail', 'aljawf-region', 'northern-border', 'alula'] },
  { id: 'east', label: 'الشرقية', ids: ['eastern-region'] },
];
const HOME_CITY = 'medina';

/** الدليل — كل الوجهات: مدينتك أولاً، بعدها شبكة صور، وباقي الوجهات */
export function GuideScreen({ asTab, toggle }: { asTab?: boolean; toggle?: ReactNode } = {}) {
  const insets = useSafeAreaInsets();
  const { data } = useAsync(getCities, []);
  const [reg, setReg] = useState('all');
  const cities = data ?? [];
  const filter = REGIONS.find((r) => r.id === reg)!;
  const list = filter.ids.length ? cities.filter((c) => filter.ids.includes(c.id)) : cities;
  const mine = list.find((c) => c.id === HOME_CITY);
  const big = list.filter((c) => c.id !== HOME_CITY).slice(0, 6);
  const rest = list.filter((c) => c.id !== HOME_CITY).slice(6);
  const total = cities.reduce((n, c) => n + c.count, 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: asTab ? 130 : 60 }}>
      <View style={st.head}>
        {asTab ? null : <BackButton />}
        <View style={{ flex: 1 }}>
          <AppText variant="title">{asTab ? 'استكشف' : 'الدليل'}</AppText>
          <AppText variant="small" muted>{cities.length} وجهة · {total.toLocaleString('en')} مكان</AppText>
        </View>
        <Pressable style={st.searchBtn} onPress={() => router.push('/search')} accessibilityLabel="بحث"><Icon name="search" color={brand.ink} size={20} /></Pressable>
      </View>
      {toggle ? <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>{toggle}</View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 14 }}>
        {REGIONS.map((r) => <Chip key={r.id} label={r.label} on={r.id === reg} color={brand.ink} onPress={() => setReg(r.id)} />)}
      </ScrollView>

      {mine ? <CityTile c={mine} wide tag="مدينتك" /> : null}
      <View style={st.grid}>
        {big.map((c) => <CityTile key={c.id} c={c} />)}
      </View>

      {rest.length ? (
        <>
          <AppText variant="section" style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 }}>باقي الوجهات</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 }}>
            {rest.map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/city/${c.id}`)} style={st.restChip}>
                <View style={[st.dot, { backgroundColor: c.color }]} />
                <AppText style={{ fontFamily: font.semibold, fontSize: 13.5 }}>{c.name} <AppText variant="tiny" muted>{c.count}</AppText></AppText>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View style={st.plan}>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontFamily: font.bold, fontSize: 17 }} color="#fff">ما تدري وين تروح؟</AppText>
          <AppText variant="small" color="#CFC6DE">قل لنا مدتك واهتماماتك ونقترح لك وجهة وخطة</AppText>
        </View>
        <Pressable style={st.planBtn} onPress={() => router.push('/planner')}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#fff">خطط لي</AppText></Pressable>
      </View>
    </ScrollView>
  );
}

function CityTile({ c, wide, tag }: { c: City; wide?: boolean; tag?: string }) {
  return (
    <Pressable onPress={() => router.push(`/city/${c.id}`)} style={[st.tile, wide ? { marginHorizontal: 16, height: 170 } : { width: '48.5%', height: 180 }]}>
      <Image source={c.cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      <LinearGradient colors={['transparent', 'rgba(32,22,54,0.88)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
      {tag ? <View style={st.tag}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{tag}</AppText></View> : null}
      <View style={{ position: 'absolute', right: 14, bottom: 12, left: 14 }}>
        <AppText style={{ fontFamily: font.bold, fontSize: wide ? 24 : 18 }} color="#fff">{c.name}</AppText>
        <AppText variant="tiny" color="#E2DAEE">{c.count} مكان</AppText>
      </View>
      <View style={[st.colorBar, { backgroundColor: c.color }]} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  searchBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, paddingHorizontal: 16, paddingTop: 10 },
  tile: { borderRadius: 24, overflow: 'hidden', backgroundColor: brand.ink },
  tag: { position: 'absolute', top: 12, right: 12, backgroundColor: brand.orange, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  colorBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  restChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, height: 38 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  plan: { margin: 16, marginTop: 22, backgroundColor: brand.ink, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  planBtn: { backgroundColor: brand.orange, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
});
