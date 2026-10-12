import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { AppHeader } from './AppHeader';

type Props = { children: ReactNode; title?: string; showBack?: boolean; showSearch?: boolean; scroll?: boolean; pad?: boolean };

/** هيكل كل شاشة: الترويسة + المحتوى. scroll=false للشاشات اللي فيها قائمة خاصة (FlatList) */
export function Screen({ children, title, showBack, showSearch, scroll = true, pad = true }: Props) {
  return (
    <View style={styles.root}>
      <AppHeader title={title} showBack={showBack} showSearch={showSearch} />
      {scroll ? (
        <ScrollView contentContainerStyle={pad ? styles.content : undefined}>{children}</ScrollView>
      ) : (
        <View style={styles.flex}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.md, paddingBottom: 120 },
});
