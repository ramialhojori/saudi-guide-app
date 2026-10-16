import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { startIap } from '@/lib/iap';
import { registerPush, startPush } from '@/lib/push';
import { Appearance, DevSettings, I18nManager, Platform, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Stack, router } from 'expo-router';
import { prefs } from '@/lib/prefs';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { colors, isDark } from '@/theme/tokens';
import { schemePref } from '@/theme/scheme';
import { startTracking } from '@/lib/track';
import { WebFrame } from '@/components/WebFrame';
import { initLang, isRtl, LANG, t } from '@/lib/i18n';
import { installErrorReporting, reportError, setErrorScreen } from '@/lib/errors';
import { usePathname } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';

// اللغة والاتجاه: الجوال يتبع لغة الجهاز أول مرة، وبعدها اختيار المستخدم (lib/i18n.ts)
I18nManager.allowRTL(isRtl);
if (Platform.OS !== 'web') initLang();
// نسخة الويب: /en/... تعني إنجليزي — نحفظ الاختيار ونشيل /en من الرابط عشان المسارات تشتغل
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // /en/... : نحفظ اختيار الإنجليزي، وصفحة app/en تحوّل لنفس المسار بدون /en
  if (/^\/en(\/|$)/.test(location.pathname)) { try { localStorage.setItem('sg_lang', 'en'); } catch { /* */ } }
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  document.documentElement.lang = LANG;
}

SplashScreen.preventAutoHideAsync().catch(() => {});
startTracking();
installErrorReporting();

/* الوضع الليلي: الألوان تنحسب أول ما يفتح التطبيق حسب اختيار المستخدم (scheme.ts).
   في نسخة التجربة ومع «تلقائي»: لو تغيّر إعداد الآيفون نعيد التحميل عشان تتبدل الألوان */
if (__DEV__ && Platform.OS !== 'web' && schemePref === 'auto') {
  Appearance.addChangeListener(({ colorScheme }) => { if ((colorScheme === 'dark') !== isDark) DevSettings.reload(); });
}

const BOTTOM = { animation: 'slide_from_bottom' } as const;

/** لو صفحة طاحت: نسجّل العطل ونعرض رسالة لطيفة مع زر «جرّب مرة ثانية» بدل شاشة بيضاء */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { reportError(error, true); }, [error]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12, backgroundColor: colors.bg }}>
      <AppText style={{ fontSize: 18, fontFamily: 'IBMPlexSansArabic_700Bold' }} center>{t('صار خلل بسيط في هالصفحة')}</AppText>
      <AppText muted center>{t('سجّلناه عندنا ونصلحه بإذن الله. جرّب مرة ثانية.')}</AppText>
      <Pressable onPress={retry} style={{ backgroundColor: '#604C87', borderRadius: 14, paddingHorizontal: 22, height: 46, justifyContent: 'center' }}><AppText color="#fff">{t('جرّب مرة ثانية')}</AppText></Pressable>
    </View>
  );
}

/** نحفظ اسم الصفحة الحالية عشان يطلع مع العطل */
function ScreenTracker() { const p = usePathname(); useEffect(() => { setErrorScreen(p); }, [p]); return null; }

export default function RootLayout() {
  const [loaded, error] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);
  // أول تشغيل: شاشة الترحيب
  useEffect(() => {
    if (!loaded && !error) return;
    // الموقع: الزائر جاي من قوقل لصفحة معينة، ما نحوله لشاشة الترحيب
    if (Platform.OS === 'web') return;
    prefs.onboarded().then((done) => { if (!done) setTimeout(() => router.replace('/welcome'), 50); });
  }, [loaded, error]);
  // دليل+: نستقبل عمليات آبل اللي ما انقفلت (تجديد، انقطاع نت) أول ما يكون فيه حساب
  const uid = useAuth().user?.id;
  useEffect(() => { if (uid && Platform.OS === 'ios') startIap().catch(() => {}); }, [uid]);
  // إشعارات الجوال: تجهيز فتح الروابط مرة وحدة، وربط الجهاز بالحساب كل ما تغيّر
  useEffect(() => { startPush(); }, []);
  useEffect(() => { if (uid) registerPush(false).catch(() => {}); }, [uid]);
  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style="light" />
      <ScreenTracker />
      <WebFrame>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="city/[id]" />
        {/* صفحات المحتوى تطلع من تحت (مثل «Content appears from the bottom» في قودبابر): تنقفل بالسحب لتحت في أول الصفحة،
            أو بالسحب لفوق بعد آخر الصفحة (PullUpClose) */}
        <Stack.Screen name="place/[id]" options={BOTTOM} />
        <Stack.Screen name="event/[id]" options={BOTTOM} />
        <Stack.Screen name="trips/[id]" options={BOTTOM} />
        <Stack.Screen name="article/[id]" options={BOTTOM} />
        <Stack.Screen name="search" options={{ animation: 'fade' }} />
        <Stack.Screen name="plus" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="coupon/use" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack>
      </WebFrame>
    </>
  );
}
