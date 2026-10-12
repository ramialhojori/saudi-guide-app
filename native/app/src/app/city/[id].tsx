import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { PlaceRow } from '@/components/PlaceRow';
import { Screen } from '@/components/Screen';
import { Empty, Loading } from '@/components/State';
import { cityKinds, getCities, getCityPlaces } from '@/lib/content';
import { useAsync } from '@/lib/useAsync';
import { colors, font, kindColor, radius, space, type } from '@/theme/tokens';
import { strings } from '@/i18n/ar';

/** صفحة المدينة: صورة + أنواع الأماكن + بحث + القائمة. الحفظ لرحلتي من نفس الصفحة */
export default function CityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [kind, setKind] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const cities = useAsync(getCities, []);
  const city = cities.data?.find((c) => c.id === id);
  const kinds = useMemo(() => cityKinds(id), [id]);
  const { data, loading } = useAsync(() => getCityPlaces(id, kind, q.trim() || undefined), [id, kind, q]);

  return (
    <Screen title={city?.name} showBack scroll={false}>
      <FlatList
        data={data?.places ?? []}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            {city?.cover ? (
              <View style={styles.cover}>
                <Image source={city.cover} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={styles.shade} />
                <AppText variant="hero" color="#fff" style={styles.coverTx}>{city.name}</AppText>
              </View>
            ) : null}
            <View style={styles.search}>
              <Icon name="search" color={colors.accent} size={20} />
              <TextInput value={q} onChangeText={setQ} placeholder={`ابحث في أماكن ${city?.name ?? ''}`} placeholderTextColor={colors.textMuted} style={styles.input} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              <Chip label={strings.common.all} on={!kind} onPress={() => setKind(undefined)} />
              {kinds.map((k) => <Chip key={k.id} label={`${k.name} ${k.n}`} on={kind === k.id} color={kindColor[k.id]} onPress={() => setKind(k.id)} />)}
            </ScrollView>
            <AppText variant="small" muted>{data?.total ?? 0} {strings.common.places}</AppText>
          </View>
        }
        ListEmptyComponent={loading ? <Loading /> : <Empty title={strings.search.none} />}
        renderItem={({ item }) => <PlaceRow place={item} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 120, backgroundColor: colors.bg },
  sep: { height: 1, backgroundColor: colors.border },
  cover: { height: 180, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'flex-end' },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(25,18,45,0.3)' },
  coverTx: { padding: space.lg },
  search: { backgroundColor: '#fff', borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 48 },
  input: { flex: 1, ...type.body, fontFamily: font.regular, color: colors.text, textAlign: 'right' },
});
