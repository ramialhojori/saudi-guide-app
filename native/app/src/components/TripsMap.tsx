import { Pressable, Share, StyleSheet, View } from 'react-native';
import Svg, { Circle, Polygon, Text as SvgText } from 'react-native-svg';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { t } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';

/** حدود المملكة مبسّطة (خط الطول، خط العرض) — رسم تقريبي للخريطة بس */
const KSA: [number, number][] = [
  [34.6, 28.1], [34.95, 29.35], [36.4, 29.5], [37.0, 31.5], [39.2, 32.15], [40.4, 31.95], [42.1, 31.1], [44.7, 29.2], [46.5, 29.1], [47.7, 28.5],
  [48.4, 28.0], [49.6, 26.9], [50.2, 26.2], [50.8, 24.75], [51.6, 24.25], [55.0, 22.7], [55.7, 22.0], [55.0, 20.0], [52.0, 19.0], [49.1, 18.6],
  [48.2, 17.4], [47.0, 16.95], [46.1, 17.25], [44.3, 17.4], [43.3, 17.5], [43.1, 16.5], [42.7, 16.4], [42.0, 17.9], [41.2, 19.3], [40.0, 20.9],
  [39.1, 21.5], [38.5, 23.5], [37.6, 24.6], [36.5, 25.9], [35.6, 27.3],
];
const W = 340, H = 300, X0 = 34.3, X1 = 56.0, Y0 = 15.9, Y1 = 32.5;
const px = (lng: number) => ((lng - X0) / (X1 - X0)) * W;
const py = (lat: number) => ((Y1 - lat) / (Y1 - Y0)) * H;

export type MapCity = { id: string; name: string; lat?: number; lng?: number };

/** «خريطة رحلاتي»: المدن اللي ختمتها تتلوّن على خريطة المملكة، وزر مشاركة */
export function TripsMap({ cities, visited }: { cities: MapCity[]; visited: string[] }) {
  const pts = cities.filter((c) => c.lat && c.lng);
  const done = pts.filter((c) => visited.includes(c.id));
  const share = () => Share.share({ message: t('زرت {n} من {total} وجهات في السعودية مع جواز دليل السعودية: {list}', { n: done.length, total: pts.length, list: done.map((c) => c.name).join('، ') || '…' }) }).catch(() => {});
  return (
    <View style={st.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="map" color={brand.purple} size={18} />
        <AppText style={{ fontFamily: font.bold, fontSize: 16, flex: 1 }}>{t('خريطة رحلاتي')}</AppText>
        <Pressable style={st.share} onPress={share} accessibilityLabel={t('مشاركة')}><Icon name="share" color={brand.purple} size={16} /><AppText variant="tiny" color={brand.purple} style={{ fontFamily: font.bold }}>{t('شارك')}</AppText></Pressable>
      </View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polygon points={KSA.map(([x, y]) => `${px(x)},${py(y)}`).join(' ')} fill={brand.chip} stroke={brand.lilac} strokeWidth={1.5} strokeLinejoin="round" />
        {pts.filter((c) => !visited.includes(c.id)).map((c) => <Circle key={c.id} cx={px(c.lng!)} cy={py(c.lat!)} r={3.5} fill="#C9C1DA" />)}
        {done.map((c, i) => (
          <Circle key={c.id} cx={px(c.lng!)} cy={py(c.lat!)} r={8} fill={[brand.orange, brand.pink, brand.lilac, brand.sky][i % 4]} stroke="#fff" strokeWidth={2} />
        ))}
        {done.map((c) => (
          <SvgText key={'t' + c.id} x={px(c.lng!)} y={py(c.lat!) - 12} fontSize={10} fontWeight="bold" fill={brand.text} textAnchor="middle">{c.name}</SvgText>
        ))}
      </Svg>
      <AppText variant="small" muted center>{done.length ? t('{n} من {total} وجهات تلوّنت على خريطتك', { n: done.length, total: pts.length }) : t('اختم أول مكان وتبدأ خريطتك تتلوّن')}</AppText>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: brand.card, borderRadius: 22, padding: 14, marginHorizontal: 16, marginTop: 14, gap: 8 },
  share: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: brand.chip, borderRadius: 12, paddingHorizontal: 10, height: 30 },
});
