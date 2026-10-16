import { useRef, useState } from 'react';
import { router, useNavigation } from 'expo-router';
import { Animated, Dimensions, Platform, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { position, sibling, type BrowseKind } from '@/lib/browse';
import { isRtl, t } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';

const PULL = 70; // كم بكسل يسحب بعد آخر الصفحة (أو قبل أولها) عشان تنقفل
const SWIPE = 70; // كم بكسل يسحب يمين/يسار عشان ينتقل للعنصر اللي بعده
const { height: H, width: W } = Dimensions.get('window');

/**
 * حركات صفحة التفاصيل (مكان، فعالية، خبر) — مثل «Content appears from the bottom» في قودبابر:
 *  - في آخر الصفحة: اسحب لفوق ← الصفحة تطير لفوق وترجع للقائمة بنفس مكانك
 *  - في أول الصفحة: اسحب لتحت ← الصفحة تنزل وترجع للقائمة
 *  - يمين/يسار: ينتقل للعنصر اللي بعده أو قبله في نفس القائمة اللي فتح منها (lib/browse.ts)
 *    بالعربي: سحب الإصبع لليمين = اللي بعده، وبالإنجليزي العكس
 *  الآيفون يعتمد على الارتداد (السحب بعد حدود الصفحة)، والأندرويد نتابع حركة الإصبع نفسها
 *  skipTop: ارتفاع منطقة أعلى المحتوى ما يشتغل فيها السحب الأفقي (معرض الصور الأفقي)
 */
export function usePullUpClose(opts: { kind?: BrowseKind; id?: number; skipTop?: number } = {}) {
  const { kind, id, skipTop = 0 } = opts;
  const nav = useNavigation();
  const y = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(0)).current;
  const ref = useRef<ScrollView>(null);
  const [pull, setPull] = useState(0); // 0..1 مؤشر السهم تحت
  const atEnd = useRef(false);
  const atTop = useRef(true);
  const scrollY = useRef(0);
  const closing = useRef(false);
  const touch = useRef<{ x: number; y: number; cy: number; mode: '' | 'up' | 'down' | 'h' } | null>(null);

  const close = (dir: 'up' | 'down') => {
    if (closing.current || !router.canGoBack()) return;
    closing.current = true;
    // الصفحة تطير (لفوق أو تحت) وتختفي، والرجوع بتلاشي عشان تبان القائمة تحتها مباشرة
    try { nav.setOptions({ animation: 'fade' } as never); } catch { /* */ }
    Animated.timing(y, { toValue: dir === 'up' ? -H : H, duration: 260, useNativeDriver: true }).start();
    setTimeout(() => router.back(), 90);
  };

  const next = kind && id ? sibling(kind, id, 1) : null;
  const prev = kind && id ? sibling(kind, id, -1) : null;
  const pos = kind && id ? position(kind, id) : null;
  const go = (dir: 1 | -1) => {
    const to = dir === 1 ? next : prev;
    if (!to || closing.current) return;
    // الحالي يطلع من جهة، واللي بعده يدخل من الجهة الثانية (بالعربي اللي بعده يجي من اليسار)
    const out = (dir === 1 ? 1 : -1) * (isRtl ? 1 : -1) * W;
    Animated.timing(x, { toValue: out, duration: 160, useNativeDriver: true }).start(() => {
      router.setParams({ id: String(to) } as never);
      ref.current?.scrollTo({ y: 0, animated: false });
      x.setValue(-out);
      Animated.timing(x, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    scrollY.current = contentOffset.y;
    const max = Math.max(0, contentSize.height - layoutMeasurement.height);
    const over = contentOffset.y - max;
    atEnd.current = over > -24 && contentSize.height > 0;
    atTop.current = contentOffset.y < 8;
    const p = Math.max(0, Math.min(1, over / PULL));
    setPull((old) => (Math.abs(p - old) > 0.05 || (p === 0 && old !== 0) || (p === 1 && old !== 1) ? p : old));
  };
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Platform.OS !== 'ios') return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const over = contentOffset.y - Math.max(0, contentSize.height - layoutMeasurement.height);
    if (over >= PULL) close('up');
    else if (contentOffset.y <= -PULL * 1.3) close('down');
  };

  /* اللمس: السحب الأفقي (الكل) + السحب لفوق/لتحت عند حدود الصفحة (أندرويد) */
  type Ev = { nativeEvent: { pageX: number; pageY: number } };
  const onTouchStart = (e: Ev) => {
    const { pageX, pageY } = e.nativeEvent;
    touch.current = { x: pageX, y: pageY, cy: scrollY.current + pageY, mode: '' };
  };
  const onTouchMove = (e: Ev) => {
    const tc = touch.current;
    if (!tc || closing.current) return;
    const dx = e.nativeEvent.pageX - tc.x, dy = e.nativeEvent.pageY - tc.y;
    if (!tc.mode) {
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.6 && tc.cy > skipTop && (next || prev)) tc.mode = 'h';
      else if (Platform.OS === 'android' && dy < -10 && atEnd.current) tc.mode = 'up';
      else if (Platform.OS === 'android' && dy > 10 && atTop.current) tc.mode = 'down';
    }
    if (tc.mode === 'h') x.setValue(dx * 0.35);
    else if (tc.mode === 'up') { const d = Math.max(0, -dy); y.setValue(-Math.min(d, PULL * 2) * 0.5); setPull(Math.min(1, d / PULL)); }
    else if (tc.mode === 'down') { const d = Math.max(0, dy); y.setValue(Math.min(d, PULL * 2) * 0.5); }
  };
  const onTouchEnd = (e: Ev) => {
    const tc = touch.current;
    touch.current = null;
    if (!tc || closing.current) return;
    const dx = e.nativeEvent.pageX - tc.x, dy = e.nativeEvent.pageY - tc.y;
    if (tc.mode === 'h') {
      const dir: 1 | -1 = (dx > 0) === isRtl ? 1 : -1; // بالعربي: الإصبع لليمين = اللي بعده
      if (Math.abs(dx) >= SWIPE && (dir === 1 ? next : prev)) go(dir);
      else Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
      return;
    }
    if (tc.mode === 'up' && -dy >= PULL) return close('up');
    if (tc.mode === 'down' && dy >= PULL * 1.3) return close('down');
    if (tc.mode === 'up' || tc.mode === 'down') { Animated.spring(y, { toValue: 0, useNativeDriver: true }).start(); setPull(0); }
  };

  const footer = (
    <View style={st.footer}>
      {next || prev ? (
        <View style={st.navRow}>
          <Pressable style={[st.navBtn, !prev && { opacity: 0.3 }]} disabled={!prev} onPress={() => go(-1)} accessibilityLabel={t('السابق')}>
            <View style={{ transform: [{ scaleX: -1 }] }}><Icon name="chevron" color={brand.purple} size={16} /></View>
            <AppText variant="small" style={{ fontFamily: font.semibold }}>{t('السابق')}</AppText>
          </Pressable>
          {pos ? <AppText variant="tiny" muted>{t('{i} من {n}', { i: pos.i, n: pos.n })}</AppText> : null}
          <Pressable style={[st.navBtn, !next && { opacity: 0.3 }]} disabled={!next} onPress={() => go(1)} accessibilityLabel={t('التالي')}>
            <AppText variant="small" style={{ fontFamily: font.semibold }}>{t('التالي')}</AppText>
            <Icon name="chevron" color={brand.purple} size={16} />
          </Pressable>
        </View>
      ) : null}
      <View style={{ alignItems: 'center', gap: 6 }} pointerEvents="none">
        <View style={[st.arrow, { opacity: 0.35 + pull * 0.65, transform: [{ translateY: -pull * 8 }] }, pull >= 1 && { backgroundColor: brand.orange }]}>
          <Icon name="up" color={pull >= 1 ? '#fff' : brand.purple} size={18} />
        </View>
        <AppText variant="tiny" muted style={{ fontFamily: font.semibold }}>{pull >= 1 ? t('اترك للرجوع') : t('اسحب لفوق للرجوع')}</AppText>
      </View>
    </View>
  );

  return {
    style: { transform: [{ translateY: y }, { translateX: x }] },
    scroll: { ref, onScroll, onScrollEndDrag, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd, scrollEventThrottle: 32, alwaysBounceVertical: true },
    footer,
  };
}

const st = StyleSheet.create({
  footer: { gap: 16, paddingTop: 18, paddingBottom: 8 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: brand.card, borderRadius: 14, paddingHorizontal: 14, height: 40 },
  arrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: brand.chip, alignItems: 'center', justifyContent: 'center' },
});
