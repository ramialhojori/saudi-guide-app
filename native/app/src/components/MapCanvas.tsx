import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import type { Place } from '@/lib/types';
import { clusterPlaces, type Cluster } from '@/lib/cluster';
import { brand, font, kindStyle } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';

type Props = { places: Place[]; center: { lat: number; lng: number }; selected?: number; onSelect: (p: Place) => void; onLongPress?: (c: { lat: number; lng: number }) => void; lite?: boolean; zoom?: number };
/** خريطة الأماكن: دبوس دائري بلون نوع المكان، والمختار أكبر وبرتقالي، والمتقاربة تتجمع في دائرة برقمها */
export const MapCanvas = forwardRef<MapView, Props>(function MapCanvas({ places, center, selected, onSelect, onLongPress, lite, zoom }, ref) {
  const inner = useRef<MapView>(null);
  useImperativeHandle(ref, () => inner.current as MapView);
  const [region, setRegion] = useState<Region>({ latitude: center.lat, longitude: center.lng, latitudeDelta: zoom ?? 0.12, longitudeDelta: zoom ?? 0.12 });
  const clusters = useMemo(() => clusterPlaces(places, region, selected), [places, region, selected]);

  const zoomInto = (c: Cluster) => {
    const lats = c.items.map((p) => p.lat!), lngs = c.items.map((p) => p.lng!);
    const dLat = Math.max(0.006, (Math.max(...lats) - Math.min(...lats)) * 1.8), dLng = Math.max(0.006, (Math.max(...lngs) - Math.min(...lngs)) * 1.8);
    inner.current?.animateToRegion({ latitude: c.lat, longitude: c.lng, latitudeDelta: Math.min(dLat, region.latitudeDelta / 2.5), longitudeDelta: Math.min(dLng, region.longitudeDelta / 2.5) }, 350);
  };

  return (
    <MapView ref={inner} style={StyleSheet.absoluteFill}
      initialRegion={region} onRegionChangeComplete={setRegion}
      showsUserLocation={!lite} showsMyLocationButton={false} toolbarEnabled={false}
      scrollEnabled={!lite} zoomEnabled={!lite} rotateEnabled={!lite} pitchEnabled={!lite} liteMode={lite}
      onLongPress={onLongPress ? (e) => onLongPress({ lat: +e.nativeEvent.coordinate.latitude.toFixed(6), lng: +e.nativeEvent.coordinate.longitude.toFixed(6) }) : undefined}>
      {clusters.map((c) => {
        if (c.items.length > 1) {
          const n = c.items.length, size = n < 10 ? 40 : n < 50 ? 48 : 56;
          return (
            <Marker key={c.key} coordinate={{ latitude: c.lat, longitude: c.lng }} onPress={() => zoomInto(c)} tracksViewChanges={false}>
              <View style={[st.cluster, { width: size, height: size }]}><Text style={st.count}>{n}</Text></View>
            </Marker>
          );
        }
        const p = c.items[0];
        const ks = kindStyle[p.kinds[0]] ?? kindStyle.sights;
        const on = p.id === selected;
        return (
          <Marker key={c.key + (on ? 's' : '')} coordinate={{ latitude: p.lat!, longitude: p.lng! }} onPress={() => onSelect(p)} tracksViewChanges={false}>
            <View style={[st.pin, { backgroundColor: on ? brand.orange : ks.fg, width: on ? 46 : 32, height: on ? 46 : 32 }]}>
              <Icon name={ks.icon as IconName} color="#fff" size={on ? 22 : 16} />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
});

const st = StyleSheet.create({
  pin: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  cluster: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.purple, borderWidth: 4, borderColor: 'rgba(255,255,255,0.85)' },
  count: { color: '#fff', fontFamily: font.bold, fontSize: 15 },
});
