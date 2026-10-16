/** مكونات الواجهة المشتركة — نفس مقاسات وألوان لوحة التصميم */
import { Image, type ImageSource } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { brand, font, radius } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { t } from '@/lib/i18n';

/** شارة أيقونة ملونة (مربع بزوايا ناعمة) */
export function Badge({ icon, bg, fg, size = 40, r = 14 }: { icon: IconName; bg: string; fg: string; size?: number; r?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} color={fg} size={Math.round(size * 0.5)} />
    </View>
  );
}

/** زر شريحة (فلتر) */
export function Chip({ label, on, color = brand.purple, onPress }: { label: string; on?: boolean; color?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }}
      style={[s.chip, { backgroundColor: on ? color : brand.white }]}>
      <AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={on ? '#fff' : brand.text}>{label}</AppText>
    </Pressable>
  );
}

/** زر دائري (رجوع، حفظ، مشاركة) */
export function RoundButton({ icon, onPress, label, light = true, size = 44, color }: { icon: IconName; onPress?: () => void; label: string; light?: boolean; size?: number; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: light ? 'rgba(255,255,255,0.92)' : brand.white }}>
      <Icon name={icon} color={color ?? (light ? '#2B2745' : brand.text)} size={20} />
    </Pressable>
  );
}

export const BackButton = ({ light }: { light?: boolean }) => (
  <RoundButton icon="back" label={t('رجوع')} light={light} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
);

/** الزر الرئيسي العريض */
export function Button({ label, icon, bg = brand.orange, fg = '#fff', onPress, h = 56, style }: { label: string; icon?: IconName; bg?: string; fg?: string; onPress?: () => void; h?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [{ height: h, borderRadius: 18, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: pressed ? 0.85 : 1 }, style]}>
      {icon && <Icon name={icon} color={fg} size={20} />}
      <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color={fg}>{label}</AppText>
    </Pressable>
  );
}

/** عنوان قسم مع رابط اختياري */
export function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sec}>
      <AppText variant="section">{title}</AppText>
      {action ? <Pressable onPress={onAction} hitSlop={8}><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.purple}>{action}</AppText></Pressable> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** صف بصورة: نوع ملون + عنوان + سطر فرعي */
export function ImageRow({ img, cat, catColor, title, sub, right, onPress }: { img?: ImageSource | string; cat: string; catColor: string; title: string; sub: string; right?: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]}>
      {img ? <Image source={img} style={s.rowImg} contentFit="cover" transition={150} /> : <View style={[s.rowImg, { backgroundColor: brand.chip }]} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="tiny" color={catColor} numberOfLines={1} style={{ fontFamily: font.semibold }}>{cat}</AppText>
        <AppText style={{ fontFamily: font.semibold, fontSize: 15 }} numberOfLines={1}>{title}</AppText>
        <AppText variant="small" muted numberOfLines={1}>{sub}</AppText>
      </View>
      {right}
    </Pressable>
  );
}

export function Avatar({ t, c, size = 36 }: { t: string; c: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
      <AppText style={{ fontFamily: font.bold, fontSize: size * 0.42, lineHeight: size * 0.6 }} color="#fff">{t}</AppText>
    </View>
  );
}

export function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
    <AppText variant="tiny" color={fg} style={{ fontFamily: font.bold }}>{label}</AppText></View>;
}

export const s = StyleSheet.create({
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  sec: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  card: { backgroundColor: brand.card, borderRadius: radius.xl, padding: 16, marginHorizontal: 16 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: brand.card, borderRadius: 20, padding: 10 },
  rowImg: { width: 70, height: 70, borderRadius: 16 },
});
