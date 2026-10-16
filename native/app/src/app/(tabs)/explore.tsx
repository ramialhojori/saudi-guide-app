import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { GuideScreen } from '@/components/screens/Guide';
import { MapScreen } from '@/components/screens/MapView';
import { brand, font } from '@/theme/tokens';
import { t } from '@/lib/i18n';

/** استكشف: الدليل (قائمة المدن) والخريطة في مكان واحد */
export default function Explore() {
  const prm = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'list' | 'map'>(prm.mode === 'map' ? 'map' : 'list');
  const toggle = (
    <View style={st.seg}>
      {([['list', t('قائمة'), 'book'], ['map', t('خريطة'), 'map']] as const).map(([k, label, ic]) => (
        <Pressable key={k} onPress={() => setMode(k)} style={[st.item, mode === k && st.on]} accessibilityRole="tab" accessibilityState={{ selected: mode === k }}>
          <Icon name={ic} size={17} color={mode === k ? '#fff' : brand.muted} />
          <AppText variant="small" style={{ fontFamily: font.bold }} color={mode === k ? '#fff' : brand.muted}>{label}</AppText>
        </Pressable>
      ))}
    </View>
  );
  return mode === 'map' ? <MapScreen toggle={toggle} /> : <GuideScreen asTab toggle={toggle} />;
}

const st = StyleSheet.create({
  seg: { flexDirection: 'row', backgroundColor: brand.card, borderRadius: 16, padding: 4, gap: 4, shadowColor: '#140A28', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  item: { flex: 1, height: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  on: { backgroundColor: brand.purple },
});
