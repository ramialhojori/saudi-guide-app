import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { PlaceRow } from '@/components/PlaceRow';
import { Screen } from '@/components/Screen';
import { Empty, Loading } from '@/components/State';
import { cityName, nearby, search } from '@/lib/content';
import type { Place } from '@/lib/types';
import { colors, font, radius, space, type } from '@/theme/tokens';
import { strings } from '@/i18n/ar';

/** البحث في كل الأماكن، و«قريب مني» (search?near=1) */
export default function SearchScreen() {
  const { near } = useLocalSearchParams<{ near?: string }>();
  const [q, setQ] = useState('');
  const [list, setList] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (near !== '1') return;
    (async () => {
      setBusy(true);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { setMsg('فعّل خدمة الموقع عشان نعرض لك الأماكن القريبة'); setBusy(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setList(await nearby(pos.coords.latitude, pos.coords.longitude, 30));
      setBusy(false);
    })().catch(() => { setBusy(false); setMsg('ما قدرنا نحدد موقعك'); });
  }, [near]);

  useEffect(() => {
    if (near === '1' && !q) return;
    const t = setTimeout(async () => {
      if (q.trim().length < 2) { setList([]); return; }
      setBusy(true);
      setList(await search(q.trim()));
      setBusy(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, near]);

  return (
    <Screen showBack showSearch={false} title={near === '1' ? strings.home.near : strings.search.title} scroll={false}>
      <View style={styles.bar}>
        <Icon name="search" color={colors.accent} size={20} />
        <TextInput autoFocus={near !== '1'} value={q} onChangeText={setQ} placeholder={strings.home.search} placeholderTextColor={colors.textMuted} style={styles.input} returnKeyType="search" />
      </View>
      <FlatList
        data={list}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={busy ? <Loading /> : msg ? <Empty title={msg} /> : q.length >= 2 ? <Empty title={strings.search.none} /> : <AppText muted center style={{ padding: space.xl }}>{strings.search.hint}</AppText>}
        renderItem={({ item }) => <PlaceRow place={item} sub={`${cityName(item.city)} · ${item.cat}`} />}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  bar: { margin: space.lg, marginBottom: 0, backgroundColor: '#fff', borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 50 },
  input: { flex: 1, ...type.body, fontFamily: font.regular, color: colors.text, textAlign: 'right' },
  list: { padding: space.lg, paddingBottom: 120 },
  sep: { height: 1, backgroundColor: colors.border },
});
