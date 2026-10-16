import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { alert } from '@/lib/alert';
import { isPlus, useAuth } from '@/lib/auth';
import { router } from 'expo-router';
import { isEn, t } from '@/lib/i18n';
import { downloadCity, offlineSupported, removeCity, useOffline } from '@/lib/offline';
import { brand, font } from '@/theme/tokens';

/** «حمّل المدينة بدون نت» في صفحة المدينة: تحميل، نسبة التقدم، تحديث، حذف */
export function OfflineCard({ city, name }: { city: string; name: string }) {
  const idx = useOffline();
  const e = idx[city];
  const [p, setP] = useState<number | null>(null);
  const { user } = useAuth();
  const plus = isPlus(user);
  if (!offlineSupported) return null;

  // ميزة دليل+: غير المشترك يشوفها ويعرف إنها للمشتركين، والضغط يفتح صفحة الاشتراك
  const locked = () => alert(t('تحميل المدن لمشتركي دليل+'), t('حمّل أي مدينة بأماكنها وتفاصيلها وصورها، واستخدمها في البر والطريق بدون نت. جرّب دليل+ 3 أيام مجاناً.'), [
    { text: t('لاحقاً'), style: 'cancel' }, { text: t('جرّب دليل+'), onPress: () => router.push(user ? '/plus' : '/login') },
  ]);
  const go = async () => {
    if (!plus) return locked();
    if (p != null) return;
    setP(0);
    try { await downloadCity(city, setP); }
    catch (e) { if ((e as { code?: string })?.code === 'plus_required') locked(); else alert(t('ما اكتمل التحميل'), t('تأكد من النت وجرّب مرة ثانية.')); }
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {!plus && !e ? <View style={st.plusTag}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{t('دليل+')}</AppText></View> : null}
        <AppText style={{ fontFamily: font.bold, fontSize: 14, flexShrink: 1 }}>{p != null ? t('جاري التحميل… {n}%', { n: Math.round(p * 100) }) : e ? t('{city} جاهزة بدون نت', { city: name }) : t('حمّل {city} للاستخدام بدون نت', { city: name })}</AppText>
        </View>
        <AppText variant="tiny" muted>{p != null ? t('خلك على النت لين يخلص') : e ? t('{n} مكان · آخر تحديث {d}', { n: e.places, d: date }) : (plus ? t('الأماكن وتفاصيلها وصورها، تنفعك في البر والطريق') : t('ميزة للمشتركين · الأماكن وصورها بدون نت'))}</AppText>
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
  plusTag: { backgroundColor: brand.orange, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
});
