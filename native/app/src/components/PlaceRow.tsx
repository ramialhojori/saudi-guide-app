import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Place } from '@/lib/types';
import { colors, kindColor, radius, space } from '@/theme/tokens';
import { AppText } from './AppText';
import { HeartButton } from './HeartButton';

/** سطر مكان في القوائم: صورة + اسم + تصنيف + حفظ */
export function PlaceRow({ place, right, sub }: { place: Place; right?: React.ReactNode; sub?: string }) {
  const tint = kindColor[place.kinds[0]] ?? colors.primary;
  return (
    <Pressable onPress={() => router.push(`/place/${place.id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} accessibilityRole="link">
      {place.thumb ? (
        <Image source={place.thumb} style={styles.img} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.img, { backgroundColor: tint, opacity: 0.85 }]} />
      )}
      <View style={styles.tx}>
        <AppText variant="heading" numberOfLines={1}>{place.title}</AppText>
        <AppText variant="small" muted numberOfLines={1}>{sub ?? place.cat}{place.km != null ? ` · ${place.km} كم` : ''}</AppText>
      </View>
      {right ?? <HeartButton id={place.id} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  img: { width: 62, height: 62, borderRadius: radius.md, backgroundColor: '#E8E3EE' },
  tx: { flex: 1, minWidth: 0 },
});
