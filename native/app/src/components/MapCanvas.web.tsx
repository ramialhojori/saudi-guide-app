import { forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Place } from '@/lib/types';
import { brand, kindStyle } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';

type Props = { places: Place[]; center: { lat: number; lng: number }; selected?: number; onSelect: (p: Place) => void };

/** نسخة الويب (معاينة فقط): خلفية خريطة مرسومة ودبابيس بمواقعها التقريبية */
export const MapCanvas = forwardRef<unknown, Props>(function MapCanvas({ places, center, selected, onSelect }, _ref) {
  const pts = places.filter((p) => p.lat && p.lng).slice(0, 40);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#EEF0EA' }]}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Path d="M-10 0 C40 200 10 420 70 600 S40 800 60 860 L-10 860Z" fill="#BFE0F2" />
        <Path d="M0 300 L390 260 M120 0 L170 844 M0 520 L390 560 M260 0 L300 844" stroke="#fff" strokeWidth={10} />
        <Path d="M200 380 h90 v80 h-90z" fill="#DDEFD9" />
      </Svg>
      {pts.map((p) => {
        const ks = kindStyle[p.kinds[0]] ?? kindStyle.sights;
        const on = p.id === selected;
        const x = 50 + ((p.lng! - center.lng) / 0.12) * 300, y = 380 - ((p.lat! - center.lat) / 0.12) * 380;
        if (x < 0 || x > 380 || y < 120 || y > 640) return null;
        return (
          <Pressable key={p.id} onPress={() => onSelect(p)} style={[st.pin, { left: x, top: y, backgroundColor: on ? brand.orange : ks.fg, width: on ? 46 : 32, height: on ? 46 : 32 }]}>
            <Icon name={ks.icon as IconName} color="#fff" size={on ? 22 : 16} />
          </Pressable>
        );
      })}
    </View>
  );
});

const st = StyleSheet.create({
  pin: { position: 'absolute', borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
});
