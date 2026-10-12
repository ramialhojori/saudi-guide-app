import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Dimensions, FlatList, Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { HeartButton } from '@/components/HeartButton';
import { Icon, type IconName } from '@/components/Icon';
import { RichText } from '@/components/RichText';
import { Screen } from '@/components/Screen';
import { Empty, Loading } from '@/components/State';
import { cityName, getPlace } from '@/lib/content';
import { openDirections } from '@/lib/maps';
import { useAsync } from '@/lib/useAsync';
import { brand, colors, kindColor, radius, space } from '@/theme/tokens';
import { env } from '@/config/env';
import { strings } from '@/i18n/ar';

const W = Dimensions.get('window').width;

/** صفحة المكان: الصور، الأزرار السريعة، الوصف، والتواصل */
export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p, loading, error } = useAsync(() => getPlace(Number(id)), [id]);

  if (loading && !p) return <Screen showBack><Loading /></Screen>;
  if (error || !p) return <Screen showBack><Empty title={strings.common.empty} /></Screen>;

  const tint = kindColor[p.kinds[0]] ?? brand.purple;
  const actions: { icon: IconName; label: string; on: () => void; show: boolean; color: string }[] = [
    { icon: 'nav', label: strings.place.directions, on: () => openDirections(p.lat, p.lng, p.title), show: !!(p.lat && p.lng), color: brand.orange },
    { icon: 'phone', label: strings.place.call, on: () => Linking.openURL(`tel:${p.phone.replace(/\s/g, '')}`), show: !!p.phone, color: '#3E8E5A' },
    { icon: 'globe', label: strings.place.site, on: () => WebBrowser.openBrowserAsync(p.website), show: !!p.website, color: brand.sky },
    { icon: 'share', label: strings.place.share, on: () => Share.share({ message: `${p.title} — ${cityName(p.city)}\n${p.url || env.siteUrl}` }), show: true, color: brand.pink },
  ];

  return (
    <Screen showBack title={cityName(p.city)} pad={false}>
      <View>
        {p.images.length ? (
          <FlatList
            data={p.images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(u, i) => u + i}
            renderItem={({ item }) => <Image source={item} style={styles.img} contentFit="cover" transition={200} />}
          />
        ) : (
          <View style={[styles.img, { backgroundColor: tint }]} />
        )}
        <View style={styles.heart}><HeartButton id={p.id} size={44} light /></View>
      </View>

      <View style={styles.body}>
        <View style={[styles.tag, { backgroundColor: tint }]}><AppText variant="small" color="#fff">{p.cats[0] || p.cat}</AppText></View>
        <AppText variant="hero">{p.title}</AppText>
        {p.title_en ? <AppText muted style={{ writingDirection: 'ltr' }}>{p.title_en}</AppText> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          {actions.filter((a) => a.show).map((a) => (
            <Pressable key={a.label} onPress={a.on} style={styles.action} accessibilityRole="button">
              <View style={[styles.aIcon, { backgroundColor: a.color }]}><Icon name={a.icon} color="#fff" size={20} /></View>
              <AppText variant="small" center>{a.label}</AppText>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.card}>
          <AppText variant="heading">{strings.place.about}</AppText>
          {p.body ? <RichText html={p.body} /> : <AppText>{p.summary}</AppText>}
          {!p.body && p.url ? (
            <Pressable onPress={() => WebBrowser.openBrowserAsync(p.url)}><AppText color={colors.primary}>{strings.place.openSite}</AppText></Pressable>
          ) : null}
        </View>

        {p.address ? (
          <Pressable style={styles.card} onPress={() => openDirections(p.lat, p.lng, p.title)}>
            <View style={styles.rowI}><Icon name="pin" color={brand.orange} /><AppText style={{ flex: 1 }}>{p.address}</AppText></View>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  img: { width: W, height: 300, backgroundColor: '#E8E3EE' },
  heart: { position: 'absolute', top: space.md, left: space.md },
  body: { padding: space.lg, gap: space.md, paddingBottom: 120 },
  tag: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  actions: { gap: space.lg, paddingVertical: space.sm },
  action: { alignItems: 'center', gap: 6, minWidth: 64 },
  aIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  rowI: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
