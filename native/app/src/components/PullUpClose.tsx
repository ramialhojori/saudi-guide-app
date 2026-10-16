import { useRef, useState } from 'react';
import { router, useNavigation } from 'expo-router';
import { Animated, Dimensions, Platform, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { t } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';

const PULL = 70; // كم بكسل يسحب بعد آخر الصفحة عشان تنقفل
const H = Dimensions.get('window').height;

/**
 * «ارفع الصفحة للرجوع»: لما يوصل المستخدم آخر صفحة المكان/الخبر/الفعالية ويكمّل يسحب لفوق بإبهامه،
 * الصفحة تطير لفوق وترجعه للقائمة اللي كان فيها (بنفس مكانه).
 * - الآيفون: السحب بعد آخر الصفحة (الارتداد) هو اللي يقفل
 * - الأندرويد (ما فيه ارتداد): نتابع حركة الإصبع نفسها وهو في آخر الصفحة، والصفحة ترتفع معه، ولو سحب كفاية وترك تنقفل
 * الاستخدام: const pull = usePullUpClose(); <Animated.View style={[{flex:1}, pull.style]}><ScrollView {...pull.scroll}>…{pull.footer}</ScrollView></Animated.View>
 */
export function usePullUpClose() {
  const nav = useNavigation();
  const y = useRef(new Animated.Value(0)).current;
  const [pull, setPull] = useState(0); // 0..1 لمؤشر السهم
  const atEnd = useRef(false);
  const endAtStart = useRef(false);
  const closing = useRef(false);
  const touchY = useRef<number | null>(null); // أندرويد: مكان الإصبع لما بدأ السحب وهو في آخر الصفحة
  const dragUp = useRef(0);

  const close = () => {
    if (closing.current || !router.canGoBack()) return;
    closing.current = true;
    // الصفحة تطير لفوق وتختفي، والرجوع بتلاشي عشان تبان القائمة تحتها مباشرة
    try { nav.setOptions({ animation: 'fade' } as never); } catch { /* */ }
    Animated.timing(y, { toValue: -H, duration: 260, useNativeDriver: true }).start();
    setTimeout(() => router.back(), 90);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = Math.max(0, contentSize.height - layoutMeasurement.height);
    const over = contentOffset.y - max;
    atEnd.current = over > -24 && contentSize.height > 0;
    const p = Math.max(0, Math.min(1, over / PULL));
    if (Math.abs(p - pull) > 0.05 || (p === 0 && pull !== 0) || (p === 1 && pull !== 1)) setPull(p);
  };
  const onScrollBeginDrag = () => { endAtStart.current = atEnd.current; };
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement, velocity } = e.nativeEvent;
    const over = contentOffset.y - Math.max(0, contentSize.height - layoutMeasurement.height);
    if (Platform.OS === 'ios') { if (over >= PULL) close(); return; }
    void velocity; // الأندرويد يتابع الإصبع في onTouchMove تحت
  };

  /* أندرويد: سحب الإصبع لفوق وهو في آخر الصفحة يرفع الصفحة معه */
  const onTouchStart = (e: { nativeEvent: { pageY: number } }) => {
    if (Platform.OS !== 'android') return;
    touchY.current = atEnd.current ? e.nativeEvent.pageY : null; dragUp.current = 0;
  };
  const onTouchMove = (e: { nativeEvent: { pageY: number } }) => {
    if (Platform.OS !== 'android' || closing.current) return;
    if (touchY.current == null) { if (atEnd.current) touchY.current = e.nativeEvent.pageY; return; }
    const d = Math.max(0, touchY.current - e.nativeEvent.pageY);
    dragUp.current = d;
    y.setValue(-Math.min(d, PULL * 2) * 0.5);
    const p = Math.min(1, d / PULL);
    if (Math.abs(p - pull) > 0.05 || p === 1 || p === 0) setPull(p);
  };
  const onTouchEnd = () => {
    if (Platform.OS !== 'android' || closing.current) return;
    const d = dragUp.current;
    touchY.current = null; dragUp.current = 0;
    if (d >= PULL) close();
    else { Animated.spring(y, { toValue: 0, useNativeDriver: true }).start(); setPull(0); }
  };

  const footer = (
    <View style={st.footer} pointerEvents="none">
      <View style={[st.arrow, { opacity: 0.35 + pull * 0.65, transform: [{ translateY: -pull * 8 }] }, pull >= 1 && { backgroundColor: brand.orange }]}>
        <Icon name="up" color={pull >= 1 ? '#fff' : brand.purple} size={18} />
      </View>
      <AppText variant="tiny" muted style={{ fontFamily: font.semibold }}>{pull >= 1 ? t('اترك للرجوع') : t('اسحب لفوق للرجوع')}</AppText>
    </View>
  );

  return {
    style: { transform: [{ translateY: y }] },
    scroll: { onScroll, onScrollBeginDrag, onScrollEndDrag, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd, scrollEventThrottle: 32, alwaysBounceVertical: true },
    footer,
  };
}

const st = StyleSheet.create({
  footer: { alignItems: 'center', gap: 6, paddingTop: 18, paddingBottom: 8 },
  arrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: brand.chip, alignItems: 'center', justifyContent: 'center' },
});
