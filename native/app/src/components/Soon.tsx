import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand } from '@/theme/tokens';
import { AppText } from './AppText';
import { Badge, BackButton } from './ui';
import type { IconName } from './Icon';
import { t } from '@/lib/i18n';

/** شاشة مؤقتة لأجزاء مصممة وتنبني في المراحل الجاية */
export function Soon({ title, icon, note }: { title: string; icon: IconName; note: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <AppText variant="title">{title}</AppText>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 80 }}>
        <Badge icon={icon} bg={brand.softPurple} fg={brand.purple} size={90} r={30} />
        <AppText variant="section" center>{t('قريباً')}</AppText>
        <AppText muted center style={{ paddingHorizontal: 24 }}>{note}</AppText>
      </View>
    </View>
  );
}
