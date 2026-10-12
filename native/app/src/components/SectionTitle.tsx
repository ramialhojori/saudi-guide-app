import { Pressable, StyleSheet, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { AppText } from './AppText';

/** عنوان قسم مع مربع الهوية المائل، ورابط «عرض الكل» اختياري */
export function SectionTitle({ title, color = colors.accent, action, onAction }: { title: string; color?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <View style={[styles.mark, { backgroundColor: color }]} />
      <AppText variant="title" style={styles.flex}>{title}</AppText>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}><AppText variant="small" color={colors.primary}>{action}</AppText></Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  mark: { width: 10, height: 10, borderRadius: 3, transform: [{ rotate: '45deg' }] },
  flex: { flex: 1 },
});
