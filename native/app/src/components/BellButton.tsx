import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useUnread } from '@/lib/notifications';
import { brand, font } from '@/theme/tokens';
import { t } from '@/lib/i18n';

/** جرس الإشعارات مع عدد غير المقروء */
export function BellButton({ style }: { style?: object }) {
  const n = useUnread();
  return (
    <Pressable accessibilityLabel={n ? t('الإشعارات، {n} جديدة', { n }) : t('الإشعارات')} onPress={() => router.push('/inbox')} style={style}>
      <Icon name="bell" color="#fff" size={22} />
      {n ? <View style={st.badge}><AppText style={st.tx} color="#fff">{n > 9 ? '9+' : n}</AppText></View> : null}
    </Pressable>
  );
}
const st = StyleSheet.create({
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: brand.pinkDeep, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#fff' },
  tx: { fontFamily: font.bold, fontSize: 10, lineHeight: 13 },
});
