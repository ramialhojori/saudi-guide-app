import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { RichText } from '@/components/RichText';
import { Screen } from '@/components/Screen';
import { Empty, Loading } from '@/components/State';
import { cityName, getEvent } from '@/lib/content';
import { eventWhen } from '@/lib/text';
import { useAsync } from '@/lib/useAsync';
import { brand, radius, space } from '@/theme/tokens';
import { strings } from '@/i18n/ar';
import { openDirections } from '@/lib/maps';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: e, loading } = useAsync(() => getEvent(Number(id)), [id]);
  if (loading && !e) return <Screen showBack><Loading /></Screen>;
  if (!e) return <Screen showBack><Empty /></Screen>;
  return (
    <Screen showBack title={strings.events.title} pad={false}>
      <Image source={e.images?.[0] || e.thumb} style={styles.img} contentFit="cover" />
      <View style={styles.body}>
        <AppText variant="small" color={brand.orange}>{eventWhen(e.start, e.end)}{e.city ? ' · ' + cityName(e.city) : ''}</AppText>
        <AppText variant="title">{e.title}</AppText>
        {e.tickets ? (
          <Pressable style={styles.cta} onPress={() => WebBrowser.openBrowserAsync(e.tickets)}>
            <Icon name="ticket" color="#fff" /><AppText color="#fff">{strings.events.tickets}</AppText>
          </Pressable>
        ) : null}
        <View style={styles.card}>{e.body ? <RichText html={e.body} /> : <AppText>{e.summary}</AppText>}</View>
        {e.address ? (
          <Pressable style={styles.card} onPress={() => openDirections(e.lat, e.lng, e.title)}>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}><Icon name="pin" color={brand.orange} /><AppText style={{ flex: 1 }}>{e.address}</AppText></View>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  img: { width: '100%', height: 260, backgroundColor: '#E8E3EE' },
  body: { padding: space.lg, gap: space.md, paddingBottom: 120 },
  cta: { flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.pink, borderRadius: radius.pill, paddingVertical: space.md },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: space.lg },
});
