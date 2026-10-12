import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { Empty, Loading } from '@/components/State';
import { cityName, getEvents } from '@/lib/content';
import { eventWhen } from '@/lib/text';
import { useAsync } from '@/lib/useAsync';
import { brand, radius, space } from '@/theme/tokens';
import { strings } from '@/i18n/ar';

export default function EventsScreen() {
  const { data, loading } = useAsync(getEvents, []);
  return (
    <Screen scroll={false}>
      <FlatList
        data={data ?? []}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={loading ? <Loading /> : <Empty title={strings.events.none} />}
        renderItem={({ item: e }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/event/${e.id}`)}>
            <Image source={e.thumb} style={styles.img} contentFit="cover" transition={150} />
            <View style={styles.tx}>
              <AppText variant="small" color={brand.orange}>{eventWhen(e.start, e.end)}{e.city ? ' · ' + cityName(e.city) : ''}</AppText>
              <AppText variant="heading" numberOfLines={2}>{e.title}</AppText>
              <AppText variant="small" muted numberOfLines={2}>{e.summary}</AppText>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md, paddingBottom: 120 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden' },
  img: { width: '100%', height: 170, backgroundColor: '#E8E3EE' },
  tx: { padding: space.md, gap: 2 },
});
