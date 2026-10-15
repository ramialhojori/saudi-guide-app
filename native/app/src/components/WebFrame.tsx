import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Linking, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { brand, font } from '@/theme/tokens';

const IOS_URL = 'https://apps.apple.com/app/id1595843013';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=carizmaapps.saudiguide';
const isAndroid = () => typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
const inApp = () => typeof navigator !== 'undefined' && /wv\)|; wv|FBAN|Instagram/i.test(navigator.userAgent);

/**
 * غلاف نسخة الويب (saudi-guide.com):
 *  - الجوال (أغلب الزوار): التطبيق نفسه بكامل الشاشة + شريط «حمّل التطبيق» للأندرويد (الآيفون له شريط سفاري الرسمي)
 *  - الكمبيوتر: التطبيق في إطار جوال بالوسط، وجنبه تعريف بالدليل ورمز QR للتحميل
 */
export function WebFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const [banner, setBanner] = useState(false);
  useEffect(() => {
    try { setBanner(isAndroid() && !inApp() && sessionStorage.getItem('sg_banner_off') !== '1'); } catch { setBanner(isAndroid()); }
  }, []);
  if (Platform.OS !== 'web') return <>{children}</>;

  if (width < 900) {
    return (
      <View style={{ flex: 1 }}>
        {banner ? (
          <View style={st.banner}>
            <Pressable onPress={() => { setBanner(false); try { sessionStorage.setItem('sg_banner_off', '1'); } catch { /* */ } }} hitSlop={10} accessibilityLabel="إغلاق"><Icon name="x" size={16} color={brand.muted} /></Pressable>
            <Image source={require('../../assets/brand/mark.png')} style={{ width: 36, height: 36, borderRadius: 9 }} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <AppText style={{ fontFamily: font.bold, fontSize: 13 }}>تطبيق دليل السعودية</AppText>
              <AppText variant="tiny" muted>أسرع، ومعه الإشعارات والجواز</AppText>
            </View>
            <Pressable onPress={() => Linking.openURL(ANDROID_URL)} style={st.get}><AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>حمّل</AppText></Pressable>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }

  return (
    <View style={st.desk}>
      <View style={st.blobA} /><View style={st.blobB} />
      <View style={st.row}>
        <View style={st.side}>
          <Image source={require('../../assets/brand/logo-white.png')} style={{ width: 260, height: 68 }} contentFit="contain" />
          <AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 34, lineHeight: 52, marginTop: 26 }}>دليلك لكل مدن{'\n'}السعودية</AppText>
          <AppText color="#E9E0FF" style={{ fontSize: 17, lineHeight: 30, marginTop: 10 }}>أماكن ومطاعم وفعاليات المواسم، ونصايح أهل المدن، وخطط رحلات ذكية. كل هذا في جيبك.</AppText>
          <View style={st.qrRow}>
            <View style={st.qr}><Image source={require('../../assets/web/qr-app.png')} style={{ width: 132, height: 132 }} contentFit="contain" /></View>
            <View style={{ gap: 10, flex: 1 }}>
              <AppText color="#fff" style={{ fontFamily: font.bold }}>صوّر الرمز بكاميرا جوالك وحمّل التطبيق</AppText>
              <Pressable style={st.store} onPress={() => Linking.openURL(IOS_URL)}><Icon name="apple" color="#fff" fill="#fff" size={18} /><AppText color="#fff" style={{ fontFamily: font.bold }}>App Store</AppText></Pressable>
              <Pressable style={st.store} onPress={() => Linking.openURL(ANDROID_URL)}><Icon name="up" color="#fff" size={18} /><AppText color="#fff" style={{ fontFamily: font.bold }}>Google Play</AppText></Pressable>
            </View>
          </View>
        </View>
        <View style={st.phone}>{children}</View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: brand.card, borderBottomWidth: 1, borderBottomColor: brand.line, zIndex: 10 },
  get: { backgroundColor: brand.orange, borderRadius: 999, paddingHorizontal: 16, height: 32, justifyContent: 'center' },
  desk: { flex: 1, backgroundColor: brand.purple, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  blobA: { position: 'absolute', width: 620, height: 620, borderRadius: 310, backgroundColor: 'rgba(248,151,67,0.16)', top: -220, right: -160 },
  blobB: { position: 'absolute', width: 520, height: 520, borderRadius: 260, backgroundColor: 'rgba(235,131,155,0.16)', bottom: -220, left: -120 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 70, height: '100%', paddingVertical: 24 },
  side: { width: 420 },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 34, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24, padding: 16 },
  qr: { backgroundColor: '#fff', borderRadius: 16, padding: 8 },
  store: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: brand.ink, borderRadius: 14, height: 42, paddingHorizontal: 14 },
  phone: { width: 420, height: '100%', maxHeight: 900, borderRadius: 36, overflow: 'hidden', backgroundColor: brand.bg, borderWidth: 8, borderColor: '#1E1A33', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 40, shadowOffset: { width: 0, height: 20 } },
});
