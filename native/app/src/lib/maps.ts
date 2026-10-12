import { Linking, Platform } from 'react-native';

/** يفتح الاتجاهات في خرائط آبل (آيفون) أو قوقل (أندرويد) */
export function openDirections(lat: number | null | undefined, lng: number | null | undefined, label: string) {
  if (!lat || !lng) return;
  const url = Platform.OS === 'ios'
    ? `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  Linking.openURL(url).catch(() => {});
}
