import { useEffect } from 'react';
import { I18nManager, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { colors } from '@/theme/tokens';

// التطبيق عربي بالكامل: الاتجاه من اليمين دائماً (في النسخ المبنية يضبطه expo-localization في app.json)
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

// نسخة الويب (للمعاينة فقط): الاتجاه يتضبط من وسم html
if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.dir = 'rtl';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="city/[id]" />
        <Stack.Screen name="place/[id]" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="article/[id]" />
        <Stack.Screen name="search" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}
