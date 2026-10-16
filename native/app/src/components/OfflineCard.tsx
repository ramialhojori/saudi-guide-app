import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { alert } from '@/lib/alert';
import { isEn, t } from '@/lib/i18n';
import { downloadCity, offlineSupported, removeCity, useOffline } from '@/lib/offline';
import { brand, font } from '@/theme/tokens';

/** «حمّل المدينة بدون نت» في صفحة المدينة: تحميل، نسبة التقدم، تحديث، حذف */
export function OfflineCard({ city, name }: { city: string; name: string }) {
  const idx = useOffline();
  const e = idx[city];
  const [p, setP] = useState<number | null>(null);
  if (!offlineSupported) return null;

  const go = async () => {
    if (p != null) return;
    setP(0);
    try { await downloadCity(city, setP); }
    catch { alert(t('ما اكتمل التحميل'), t('تأكد من النت وجرّب مرة ثانية.')); }
    finally { setP(null); }
  };
  const menu = () => alert(t('{city} محمّلة', { city: name }), t('تقدر تحدّثها بآخر الأماكن، أو تشيلها عشان توفر مساحة.'), [
    { text: t('إلغاء'), style: 'cancel' }, { text: t('شيلها'), style: 'destructive', onPress: () => removeCity(city) }, { text: t('حدّثها'), onPress: go },
  ]);
  const date = e ? new Date(e.at * 1000).toLocaleDateString(isEn ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short' }) : '';

  return (
    <Pressable style={st.card} onPress={e ? menu : go} disabled={p != null}>
      <View style={[st.icon, e && p == null && { backgroundColor: brand.softGreen }]}>
        {p != null ? <ActivityIndicator color={brand.purple} /> : <Icon name={e ? 'check' : 'down'} color={e ? brand.green : brand.purple} size={20} />}
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontFamily: font.bold, fontSize: 14 }}>{p != null ? t('جاري التحميل… {n}%', { n: Math.round(p * 100) }) : e ? t('{city} جاهزة بدون نت', { city: name }) : t('حمّل {city} للاستخدام بدون نت', { city: name })}</AppText>
        <AppText variant="tiny" muted>{p != null ? t('خلك على النت لين يخلص') : e ? t('{n} مكان · آخر تحديث {d}', { n: e.places, d: date }) : t('الأماكن وتفاصيلها وصورها، تنفعك في البر والطريق')}</AppText>
        {p != null ? <View style={st.track}><View style={[st.fill, { width: `${Math.round(p * 100)}%` }]} /></View> : null}
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 12, backgroundColor: brand.card, borderRadius: 18, padding: 12 },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: brand.lilac + '55', alignItems: 'center', justifyContent: 'center' },
  track: { height: 5, borderRadius: 3, backgroundColor: brand.chip, marginTop: 6 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: brand.purple },
});
