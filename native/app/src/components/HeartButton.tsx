import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';
import { trip, useTrip } from '@/lib/trip';
import { colors } from '@/theme/tokens';
import { Icon } from './Icon';
import { strings } from '@/i18n/ar';

/** زر «أضف لرحلتي» — نفس الحفظ في كل مكان بالتطبيق (ما فيه نظامين مثل قودبابر) */
export function HeartButton({ id, size = 36, light }: { id: number; size?: number; light?: boolean }) {
  const { ids } = useTrip();
  const on = ids.includes(id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={on ? strings.place.inTrip : strings.place.addTrip}
      accessibilityState={{ selected: on }}
      hitSlop={8}
      onPress={() => { trip.toggle(id); Haptics.selectionAsync().catch(() => {}); }}
      style={[styles.b, { width: size, height: size, borderRadius: size / 2, backgroundColor: light ? 'rgba(255,255,255,0.92)' : on ? '#FBE3EA' : '#F3F0F8' }]}
    >
      <Icon name={on ? 'heartFill' : 'heart'} size={size * 0.55} color={on ? colors.heart : colors.text} />
    </Pressable>
  );
}
const styles = StyleSheet.create({ b: { alignItems: 'center', justifyContent: 'center' } });
