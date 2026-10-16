import type { ReactNode } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { usePullUpClose } from './PullUpClose';
import { colors, space } from '@/theme/tokens';
import { AppHeader } from './AppHeader';

type Props = { children: ReactNode; title?: string; showBack?: boolean; showSearch?: boolean; scroll?: boolean; pad?: boolean; pullClose?: boolean; browse?: { kind: 'place' | 'event' | 'article'; id: number } };

/** هيكل كل شاشة: الترويسة + المحتوى. scroll=false للشاشات اللي فيها قائمة خاصة (FlatList) */
export function Screen({ children, title, showBack, showSearch, scroll = true, pad = true, pullClose, browse }: Props) {
  // pullClose: «اسحب لفوق للرجوع» في آخر الصفحة (صفحات المحتوى مثل الخبر)
  const pull = usePullUpClose(browse ? { ...browse, skipTop: 0 } : {});
  return (
    <Animated.View style={[styles.root, pullClose && pull.style]}>
      <AppHeader title={title} showBack={showBack} showSearch={showSearch} />
      {scroll ? (
        <ScrollView {...(pullClose ? pull.scroll : {})} contentContainerStyle={pad ? styles.content : undefined}>{children}{pullClose ? pull.footer : null}</ScrollView>
      ) : (
        <View style={styles.flex}>{children}</View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.md, paddingBottom: 120 },
});
