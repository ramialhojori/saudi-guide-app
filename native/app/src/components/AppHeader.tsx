import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, space } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { strings } from '@/i18n/ar';

type Props = { title?: string; showBack?: boolean; showSearch?: boolean };

/** ترويسة الدليل: بنفسجي الهوية والشعار بالنص (أو عنوان للشاشات الداخلية) */
export function AppHeader({ title, showBack, showSearch = true }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.side}>
          {showBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel={strings.common.back} onPress={() => router.back()} hitSlop={12} style={styles.btn}>
              <Icon name="back" color={colors.onHeader} />
            </Pressable>
          ) : null}
        </View>
        {title ? (
          <AppText variant="heading" color={colors.onHeader} numberOfLines={1} center style={styles.center}>{title}</AppText>
        ) : (
          <Image source={require('../../assets/brand/logo-white.png')} style={styles.logo} contentFit="contain" accessibilityLabel={strings.appName} />
        )}
        <View style={[styles.side, styles.end]}>
          {showSearch ? (
            <Pressable accessibilityRole="button" accessibilityLabel={strings.search.title} onPress={() => router.push('/search')} hitSlop={12} style={styles.btn}>
              <Icon name="search" color={colors.onHeader} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.header },
  row: { height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md },
  side: { width: 48, flexDirection: 'row' },
  end: { justifyContent: 'flex-end' },
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1 },
  logo: { flex: 1, height: 34 },
});
