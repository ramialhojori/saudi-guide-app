import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { MapCanvas } from '@/components/MapCanvas';
import { Chip } from '@/components/ui';
import { cityKinds, getCities, getCityPlaces } from '@/lib/content';
import { trip, useTrip } from '@/lib/trip';
import { useAsync } from '@/lib/useAsync';
import type { City, Place } from '@/lib/types';
import { brand, font, kindStyle } from '@/theme/tokens';

const SHORT: Record<string, string> = { food: 'مطاعم', cafe: 'مقاهي', sights: 'معالم', heritage: 'تراث', nature: 'طبيعة', islamic: 'إسلامية', fun: 'ترفيه', shopping: 'تسوق' };

export function MapScreen({ toggle }: { toggle?: ReactNode } = {}) {
  const insets = useSafeAreaInsets();
  const { data: cities } = useAsync(getCities, []);
  const [city, setCity] = useState<City | null>(null);
  const [pick, setPick] = useState(false);
  const [kind, setKind] = useState<string | undefined>();
  const [sel, setSel] = useState<Place | null>(null);
  const { ids } = useTrip();
  const mapRef = useRef<{ animateToRegion?: (r: object, ms: number) => void } | null>(null);

  useEffect(() => { if (!city && cities?.length) setCity(cities.find((c) => c.id === 'medina') ?? cities[0]); }, [cities, city]);
  const { data } = useAsync(() => (city ? getCityPlaces(city.id) : Promise.resolve({ total: 0, places: [] })), [city?.id]);
  const all = data?.places ?? [];
  const shown = useMemo(() => (kind ? all.filter((p) => p.kinds.includes(kind)) : all), [all, kind]);
  const ks = city ? cityKinds(city.id).slice(0, 5) : [];

  const locate = async () => {
    const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (!perm?.granted) return;
    const pos = await Location.getCurrentPositionAsync({}).catch(() => null);
    if (pos) mapRef.current?.animateToRegion?.({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 500);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#EEF0EA' }}>
      {city ? <MapCanvas key={city.id} ref={mapRef as never} places={shown} center={{ lat: city.lat, lng: city.lng }} selected={sel?.id} onSelect={setSel} /> : null}

      <View style={[st.top, { paddingTop: insets.top + 10 }]}>
        {toggle ? <View style={{ marginBottom: 10 }}>{toggle}</View> : null}
        <Pressable style={st.search} onPress={() => setPick((v) => !v)} accessibilityRole="button">
          <Icon name="search" color={brand.purple} size={20} />
          <AppText style={{ flex: 1, fontFamily: font.semibold }} muted>ابحث في {city?.name ?? '...'} ▾</AppText>
        </Pressable>
        {pick ? (
          <View style={st.cityList}>
            <ScrollView style={{ maxHeight: 320 }}>
              {(cities ?? []).map((c) => (
                <Pressable key={c.id} onPress={() => { setCity(c); setPick(false); setSel(null); setKind(undefined); }} style={st.cityRow}>
                  <View style={[st.dot, { backgroundColor: c.color }]} />
                  <AppText style={{ flex: 1, fontFamily: font.semibold }}>{c.name}</AppText>
                  <AppText variant="small" muted>{c.count} مكان</AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
          <Chip label={`الكل · ${all.length}`} on={!kind} color={brand.ink} onPress={() => setKind(undefined)} />
          {ks.map((k) => <Chip key={k.id} label={SHORT[k.id] ?? k.name} on={kind === k.id} color={kindStyle[k.id]?.fg} onPress={() => setKind(k.id)} />)}
        </ScrollView>
      </View>

      <View style={[st.side, { bottom: sel ? 300 : 120 }]}>
        <Pressable onPress={locate} style={st.fab} accessibilityLabel="موقعي"><Icon name="nav" color={brand.skyDeep} size={20} /></Pressable>
      </View>

      {sel ? (
        <View style={st.card}>
          <Image source={sel.thumb || sel.image} style={st.cardImg} contentFit="cover" />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <AppText variant="tiny" color={kindStyle[sel.kinds[0]]?.fg ?? brand.purple} style={{ fontFamily: font.semibold }}>{sel.cat}</AppText>
            <AppText style={{ fontFamily: font.bold, fontSize: 17 }} numberOfLines={1}>{sel.title}</AppText>
            <AppText variant="small" muted numberOfLines={2}>{sel.summary}</AppText>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Pressable onPress={() => trip.toggle(sel.id)} style={[st.btn, { backgroundColor: brand.orange }]}>
                <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#fff">{ids.includes(sel.id) ? '✓ في رحلتي' : '+ رحلتي'}</AppText>
              </Pressable>
              <Pressable onPress={() => router.push(`/place/${sel.id}`)} style={[st.btn, { backgroundColor: brand.chip }]}>
                <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={brand.purple}>التفاصيل</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  top: { position: 'absolute', top: 0, right: 16, left: 16 },
  search: { height: 56, borderRadius: 20, backgroundColor: brand.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16,
    shadowColor: '#2B2745', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  cityList: { marginTop: 8, backgroundColor: brand.card, borderRadius: 20, padding: 6, elevation: 6, shadowColor: '#2B2745', shadowOpacity: 0.15, shadowRadius: 14 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  side: { position: 'absolute', left: 16, gap: 10 },
  fab: { width: 48, height: 48, borderRadius: 16, backgroundColor: brand.card, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#2B2745', shadowOpacity: 0.12, shadowRadius: 10 },
  card: { position: 'absolute', right: 16, left: 16, bottom: 116, backgroundColor: brand.card, borderRadius: 26, padding: 12, flexDirection: 'row', gap: 12,
    shadowColor: '#2B2745', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  cardImg: { width: 110, height: 130, borderRadius: 18 },
  btn: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
