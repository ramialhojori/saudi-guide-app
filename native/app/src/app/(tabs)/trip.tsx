import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { PlaceRow } from '@/components/PlaceRow';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { Empty, Loading } from '@/components/State';
import { cityName, getPlacesByIds } from '@/lib/content';
import { trip, useTrip } from '@/lib/trip';
import { useAsync } from '@/lib/useAsync';
import type { Place } from '@/lib/types';
import { brand, colors, radius, space } from '@/theme/tokens';
import { strings } from '@/i18n/ar';

/** مسار قوقل ماب بكل محطات المدينة بالترتيب */
function openRoute(items: Place[]) {
  const pts = items.filter((p) => p.lat && p.lng);
  if (!pts.length) return;
  const dest = pts[pts.length - 1];
  const way = pts.slice(0, -1).map((p) => `${p.lat},${p.lng}`).join('|');
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${way ? `&waypoints=${encodeURIComponent(way)}` : ''}`).catch(() => {});
}

/** «رحلتي»: الأماكن المحفوظة مجمّعة حسب المدينة، مع ترتيب ومسار */
export default function TripScreen() {
  const { ids, loaded } = useTrip();
  const { data, loading } = useAsync(() => getPlacesByIds(ids), [ids.join(',')]);

  if (!loaded || (loading && !data)) return <Screen><Loading /></Screen>;
  if (!ids.length) {
    return (
      <Screen>
        <Empty title={strings.trip.empty} sub={strings.trip.emptySub} action={strings.trip.browse} onAction={() => router.push('/guide')} />
      </Screen>
    );
  }

  const groups: { city: string; items: Place[] }[] = [];
  for (const p of data ?? []) {
    let g = groups.find((x) => x.city === p.city);
    if (!g) groups.push((g = { city: p.city, items: [] }));
    g.items.push(p);
  }

  return (
    <Screen>
      <View style={styles.head}>
        <AppText variant="small" color={brand.peach}>مخطط الرحلات</AppText>
        <AppText variant="title" color="#fff">{strings.trip.title}</AppText>
        <AppText variant="small" color="#E4DCEE">{ids.length} مكان في {groups.length} {groups.length === 1 ? 'مدينة' : 'مدن'}</AppText>
      </View>
      {groups.map((g) => (
        <View key={g.city} style={styles.card}>
          <SectionTitle title={cityName(g.city)} />
          <View style={styles.btns}>
            <Pressable style={[styles.btn, { backgroundColor: brand.purpleDeep }]} onPress={() => openRoute(g.items)}>
              <Icon name="nav" color="#fff" size={18} /><AppText variant="small" color="#fff">{strings.trip.route}</AppText>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnAlt]} onPress={() => router.push(`/city/${g.city}`)}>
              <Icon name="plus" color={colors.text} size={18} /><AppText variant="small">{strings.trip.addMore}</AppText>
            </Pressable>
          </View>
          {g.items.map((p, i) => (
            <PlaceRow
              key={p.id}
              place={p}
              sub={`${i + 1}. ${p.cat}`}
              right={
                <View style={styles.ctrl}>
                  <Pressable onPress={() => trip.move(p.id, -1)} hitSlop={6} style={styles.ib} accessibilityLabel="لفوق"><AppText color={brand.purple}>▲</AppText></Pressable>
                  <Pressable onPress={() => trip.move(p.id, 1)} hitSlop={6} style={styles.ib} accessibilityLabel="لتحت"><AppText color={brand.purple}>▼</AppText></Pressable>
                  <Pressable onPress={() => trip.remove(p.id)} hitSlop={6} style={[styles.ib, styles.x]} accessibilityLabel="احذف"><Icon name="x" color="#B2405E" size={16} /></Pressable>
                </View>
              }
            />
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: brand.purpleDeep, borderRadius: radius.xl, padding: space.lg },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  btns: { flexDirection: 'row', gap: space.sm, marginVertical: space.sm },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 8 },
  btnAlt: { borderWidth: 1, borderColor: colors.border },
  ctrl: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  ib: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  x: { backgroundColor: '#FBE3EA', borderRadius: 15 },
});
