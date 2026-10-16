import { useState } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { BackButton, Chip } from '@/components/ui';
import { alert } from '@/lib/alert';
import { cityName, getPlacesByIds } from '@/lib/content';
import { isEn, t } from '@/lib/i18n';
import { decodeTrip, trip, tripDayDate } from '@/lib/trip';
import { useAsync } from '@/lib/useAsync';
import { brand, font, photos } from '@/theme/tokens';

const STEP = [brand.orange, brand.pink, brand.sky, brand.lilac, brand.green];

/** رحلة وصلت برابط من صديق (/plan/<الأماكن>?s=تاريخ): يشوفها ويحفظها في «رحلتي» */
export default function SharedPlan() {
  const insets = useSafeAreaInsets();
  const { code, s } = useLocalSearchParams<{ code: string; s?: string }>();
  const days = decodeTrip(code || '');
  const start = /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s! : '';
  const ids = days.flat();
  const { data: places, loading } = useAsync(() => getPlacesByIds(ids), [code]);
  const byId = new Map((places ?? []).map((p) => [p.id, p]));
  const [day, setDay] = useState(0);
  const shown = days.map((d) => d.map((id) => byId.get(id)).filter(Boolean));
  const city = places?.[0] ? cityName(places[0].city) : '';
  const cur = shown[Math.min(day, shown.length - 1)] ?? [];

  const save = () => {
    const apply = (mode: 'replace' | 'add') => {
      const ok = days.map((d) => d.filter((id) => byId.has(id))).filter((d) => d.length);
      trip.setDays(mode === 'replace' ? ok : [...trip.days().filter((d) => d.length), ...ok]);
      if (start && (mode === 'replace' || !trip.start())) trip.setStart(start);
      router.replace('/trip');
    };
    if (!trip.all().length) return apply('replace');
    alert(t('عندك أماكن في رحلتي'), t('تبي تستبدلها بالرحلة الجديدة ولا تضيفها عليها؟'), [
      { text: t('إلغاء'), style: 'cancel' }, { text: t('أضفها'), onPress: () => apply('add') }, { text: t('استبدل'), style: 'destructive', onPress: () => apply('replace') },
    ]);
  };

  if (!ids.length) {
    return (
      <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        <BackButton />
        <AppText center muted style={{ marginTop: 60 }}>{t('الرابط ناقص أو انتهى. اطلب من صاحبك يرسله مرة ثانية.')}</AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 130 }}>
        <View style={st.top}><BackButton /><View style={{ flex: 1 }}>
          <AppText variant="small" color={brand.orangeDeep} style={{ fontFamily: font.semibold }}>{t('رحلة وصلتك من صديق')}</AppText>
          <AppText variant="title" numberOfLines={2}>{city ? t('رحلة إلى {city}', { city }) : t('رحلة على دليل السعودية')}</AppText>
          <AppText variant="small" muted>{t('{n} أيام', { n: days.length })} · {t('{n} مكان', { n: ids.length })}{start ? ` · ${tripDayDate(start, 0, isEn)}` : ''}</AppText>
        </View></View>

        {days.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16 }}>
            {days.map((_, i) => <Chip key={i} label={start ? `${t('اليوم {n}', { n: i + 1 })} · ${tripDayDate(start, i, isEn, false)}` : t('اليوم {n}', { n: i + 1 })} on={i === day} color={brand.ink} onPress={() => setDay(i)} />)}
          </ScrollView>
        ) : <View style={{ height: 16 }} />}

        {loading && !places ? <ActivityIndicator color={brand.purple} style={{ marginTop: 30 }} /> : (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {cur.map((p, i) => (
              <Pressable key={p!.id} style={st.stop} onPress={() => router.push(`/place/${p!.id}`)}>
                <View style={[st.num, { backgroundColor: STEP[i % STEP.length] }]}><AppText style={{ fontFamily: font.bold }} color="#fff">{i + 1}</AppText></View>
                <Image source={p!.thumb || p!.image || photos.heritage} style={st.img} contentFit="cover" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText style={{ fontFamily: font.bold, fontSize: 15 }} numberOfLines={1}>{p!.title}</AppText>
                  <AppText variant="small" muted numberOfLines={1}>{p!.cat}</AppText>
                </View>
              </Pressable>
            ))}
            {!cur.length ? <AppText center muted style={{ marginTop: 20 }}>{t('أماكن هاليوم ما عادت موجودة في الدليل.')}</AppText> : null}
          </View>
        )}
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={[st.cta, !places?.length && { opacity: 0.5 }]} onPress={save} disabled={!places?.length}>
          <Icon name="route" color="#fff" size={18} /><AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 16 }}>{t('احفظها في رحلتي')}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: brand.card, borderRadius: 20, padding: 10 },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  img: { width: 62, height: 62, borderRadius: 14, backgroundColor: brand.chip },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: brand.bg },
  cta: { height: 54, borderRadius: 18, backgroundColor: brand.orange, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
});
