import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { AppText } from '@/components/AppText';
import { isEn } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';

/** الشهرين الجايين (بتوقيت مكة) YYYY-MM-DD */
export const nextDays = (n = 60) => Array.from({ length: n }, (_, i) => new Date(Date.now() + 3 * 3600e3 + i * 86400e3).toISOString().slice(0, 10));
const loc = isEn ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn';

/** شريط أيام أفقي لاختيار تاريخ (بدون مكتبة تقويم: يشتغل في الجوال والويب) */
export function DateStrip({ value, onChange, pad = 16 }: { value: string; onChange: (d: string) => void; pad?: number }) {
  // تاريخ أبعد من الشهرين (مثلاً جاي من التقويم): نعرض الأيام من عنده
  let days = nextDays();
  if (value && value > days[days.length - 1]) {
    const t0 = Date.parse(value + 'T12:00:00Z');
    days = Array.from({ length: 30 }, (_, i) => new Date(t0 + i * 86400e3).toISOString().slice(0, 10));
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: pad, paddingTop: 10 }}>
      {days.map((d) => {
        const on = value === d, dt = new Date(d + 'T12:00:00Z');
        return (
          <Pressable key={d} onPress={() => onChange(d)} style={[st.box, on && { backgroundColor: brand.purple }]} accessibilityLabel={dt.toLocaleDateString(loc, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })}>
            <AppText variant="tiny" color={on ? '#E2DAEE' : brand.muted}>{dt.toLocaleDateString(loc, { timeZone: 'UTC', weekday: 'short' })}</AppText>
            <AppText style={{ fontFamily: font.bold, fontSize: 18 }} color={on ? '#fff' : brand.text}>{dt.getUTCDate()}</AppText>
            <AppText variant="tiny" color={on ? '#E2DAEE' : brand.muted}>{dt.toLocaleDateString(loc, { timeZone: 'UTC', month: 'short' })}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  box: { width: 58, alignItems: 'center', backgroundColor: brand.card, borderRadius: 16, paddingVertical: 8 },
});
