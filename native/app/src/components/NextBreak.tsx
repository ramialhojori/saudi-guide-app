import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { calTitle, countdown, getCalendar, lengthDays, todayKey, type CalItem } from '@/lib/calendar';
import { isEn, t } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';

/** شريط الرئيسية: أقرب إجازة دراسية بعد كم يوم، ويفتح «التقويم والإجازات» */
export function NextBreak({ style }: { style?: object }) {
  const [x, setX] = useState<CalItem | null>(null);
  useEffect(() => {
    let alive = true;
    getCalendar().then((c) => { if (alive) setX(c.items.find((i) => i.kind === 'school' && (i.end || i.start) >= todayKey()) || null); });
    return () => { alive = false; };
  }, []);
  if (!x) return null;
  const c = countdown(x), n = lengthDays(x);
  return (
    <Pressable style={[st.card, style]} onPress={() => router.push('/calendar?tab=breaks')} accessibilityRole="button">
      <View style={st.ic}><Icon name="calendar" color="#fff" size={20} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText style={{ fontFamily: font.bold, fontSize: 15 }} numberOfLines={1}>{calTitle(x)} · {c.label}</AppText>
        <AppText variant="small" muted numberOfLines={1}>{isEn ? `${n} days off · plan your trip now` : `${n} ${n <= 10 ? 'أيام' : 'يوم'} إجازة · خطط لها من الحين`}</AppText>
      </View>
      <AppText variant="small" color={brand.purple} style={{ fontFamily: font.bold }}>{t('التقويم')}</AppText>
      <Icon name="chevron" color={brand.purple} size={16} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderRadius: 20, padding: 12 },
  ic: { width: 42, height: 42, borderRadius: 14, backgroundColor: brand.pink, alignItems: 'center', justifyContent: 'center' },
});
