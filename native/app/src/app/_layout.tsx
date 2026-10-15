import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { startIap } from '@/lib/iap';
import { registerPush, startPush } from '@/lib/push';
import { Appearance, DevSettings, I18nManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { startTracking } from '@/lib/track';
import { WebFrame } from '@/components/WebFrame';

// التطبيق عربي بالكامل: الاتجاه من اليمين دائماً (في النسخ المبنية يضبطه expo-localization في app.json)
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

// نسخة الويب (saudi-guide.com): الاتجاه واللغة من وسم html
if (Platform.OS === 'web' && typeof document !== 'undefined') { document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ar'; }

SplashScreen.preventAutoHideAsync().catch(() => {});
startTracking();

/* الوضع الليلي: الألوان تنحسب أول ما يفتح التطبيق حسب إعداد الآيفون.
   في نسخة التجربة: لو اخترت مظهر من الإعدادات نطبقه، ولو تغيّر إعداد الآيفون نعيد التحميل عشان تتبدل الألوان */
if (__DEV__ && Platform.OS !== 'web') {
  AsyncStorage.getItem('sg_scheme_v1').then((c) => {
    if ((c === 'dark' || c === 'light') && (c === 'dark') !== isDark) { Appearance.setColorScheme?.(c); setTimeout(() => DevSettings.reload(), 50); }
  }).catch(() => {});
  Appearance.addChangeListener(({ colorScheme }) => { if ((colorScheme === 'dark') !== isDark) DevSettings.reload(); });
}

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
      <WebFrame>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="city/[id]" />
        <Stack.Screen name="place/[id]" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="article/[id]" />
        <Stack.Screen name="search" options={{ animation: 'fade' }} />
        <Stack.Screen name="plus" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="coupon/use" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack>
      </WebFrame>
    </>
  );
}
