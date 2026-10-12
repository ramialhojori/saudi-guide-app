import { Pressable, StyleSheet } from 'react-native';
import { colors, font, radius, space } from '@/theme/tokens';
import { AppText } from './AppText';

export function Chip({ label, on, onPress, color }: { label: string; on?: boolean; onPress: () => void; color?: string }) {
  const bg = on ? color ?? colors.chipOn : colors.surface;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }} style={[styles.c, { backgroundColor: bg, borderColor: on ? bg : colors.border }]}>
      <AppText variant="small" color={on ? '#fff' : colors.text} style={{ fontFamily: font.medium }}>{label}</AppText>
    </Pressable>
  );
}
const styles = StyleSheet.create({ c: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md + 2, paddingVertical: 7 } });
