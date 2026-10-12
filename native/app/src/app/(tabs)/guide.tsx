import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Loading } from '@/components/State';
import { getCities } from '@/lib/content';
import { searchKey } from '@/lib/text';
import { useAsync } from '@/lib/useAsync';
import type { City } from '@/lib/types';
import { brand, colors, font, radius, space, type } from '@/theme/tokens';
import { strings } from '@/i18n/ar';

type Filter = 'all' | 'city' | 'region';

/** قسم الدليل: المدن والمناطق كبطاقات بالصور (نفس قسم guide في قودبابر) */
export default function GuideScreen() {
  const { data, loading } = useAsync(getCities, []);
  const [f, setF] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const k = searchKey(q);
    return (data ?? []).filter((c) => (f === 'all' || c.kind === f) && (!k || searchKey(c.name).includes(k)));
  }, [data, f, q]);
  const total = (data ?? []).reduce((n, c) => n + c.count, 0);

  return (
    <Screen scroll={false}>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <View style={styles.head}>
              <AppText variant="small" color={brand.peach}>الدليل</AppText>
              <AppText variant="title" color="#fff">{strings.guide.title}</AppText>
              <AppText variant="small" color="#E4DCEE">{data?.length ?? 21} مدينة ومنطقة، وأكثر من {total.toLocaleString('en')} مكان</AppText>
              <View style={styles.search}>
                <Icon name="search" color={brand.orange} size={20} />
                <TextInput value={q} onChangeText={setQ} placeholder={strings.guide.search} placeholderTextColor={colors.textMuted} style={styles.input} />
              </View>
            </View>
            <View style={styles.chips}>
              <Chip label={strings.common.all} on={f === 'all'} onPress={() => setF('all')} />
              <Chip label={strings.guide.cities} on={f === 'city'} onPress={() => setF('city')} />
              <Chip label={strings.guide.regions} on={f === 'region'} onPress={() => setF('region')} />
            </View>
            {loading && !data ? <Loading /> : null}
          </View>
        }
        renderItem={({ item }) => <CityCard city={item} />}
      />
    </Screen>
  );
}

function CityCard({ city }: { city: City }) {
  return (
    <Pressable onPress={() => router.push(`/city/${city.id}`)} style={styles.card} accessibilityRole="link">
      {city.cover ? <Image source={city.cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: city.color }]} />}
      <View style={styles.shade} />
      <View style={styles.cap}>
        <AppText variant="title" color="#fff">{city.name}</AppText>
        <AppText variant="small" color="#F2ECF7">{city.count} {strings.common.places}</AppText>
      </View>
      <View style={[styles.bar, { backgroundColor: city.color }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md, paddingBottom: 120 },
  head: { backgroundColor: brand.purpleDeep, borderRadius: radius.xl, padding: space.lg, gap: 2 },
  search: { marginTop: space.md, backgroundColor: '#fff', borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 48 },
  input: { flex: 1, ...type.body, fontFamily: font.regular, color: colors.text, textAlign: 'right' },
  chips: { flexDirection: 'row', gap: space.sm, backgroundColor: '#fff', padding: 6, borderRadius: radius.lg },
  card: { height: 170, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: brand.purpleDeep },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(25,18,45,0.32)' },
  cap: { position: 'absolute', right: space.lg, bottom: space.md },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 },
});
