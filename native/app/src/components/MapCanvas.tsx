import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { Place } from '@/lib/types';
import { brand, kindStyle } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';

type Props = { places: Place[]; center: { lat: number; lng: number }; selected?: number; onSelect: (p: Place) => void };

/** خريطة الأماكن: دبوس دائري بلون نوع المكان، والمختار أكبر وبرتقالي */
export const MapCanvas = forwardRef<MapView, Props>(function MapCanvas({ places, center, selected, onSelect }, ref) {
  return (
    <MapView ref={ref} style={StyleSheet.absoluteFill}
      initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
      showsUserLocation showsMyLocationButton={false} toolbarEnabled={false}>
      {places.filter((p) => p.lat && p.lng).map((p) => {
        const ks = kindStyle[p.kinds[0]] ?? kindStyle.sights;
        const on = p.id === selected;
        return (
          <Marker key={p.id} coordinate={{ latitude: p.lat!, longitude: p.lng! }} onPress={() => onSelect(p)} tracksViewChanges={false}>
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
});
