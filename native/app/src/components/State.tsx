import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { AppText } from './AppText';
import { strings } from '@/i18n/ar';

export function Loading() {
  return <View style={styles.box}><ActivityIndicator color={colors.primary} /></View>;
}
export function Empty({ title = strings.common.empty, sub, action, onAction }: { title?: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.box}>
      <AppText variant="heading" center>{title}</AppText>
      {sub ? <AppText muted center>{sub}</AppText> : null}
      {action ? (
        <Pressable onPress={onAction} style={styles.btn}><AppText color="#fff" center>{action}</AppText></Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  box: { padding: space.xxl, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  btn: { marginTop: space.md, backgroundColor: colors.primary, paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: 999 },
});
