import { useEffect, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Badge } from '@/components/ui';
import { appleAvailable, signInWithApple } from '@/lib/auth';
import { brand, font } from '@/theme/tokens';

/** تسجيل الدخول — مثل التصميم: آبل (شغال)، قوقل والجوال (قريباً)، أو تصفح كزائر */
export default function Login() {
  const insets = useSafeAreaInsets();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { appleAvailable().then(setApple).catch(() => {}); }, []);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const onApple = async () => {
    setErr(''); setBusy(true);
    try {
      if ((await signInWithApple()) === 'ok') done();
    } catch (e: unknown) {
      const x = e as { code?: string; message?: string };
      setErr(`ما قدرنا نكمل الدخول. (${x?.code || x?.message || 'خطأ'})`);
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <View style={[st.top, { paddingTop: insets.top + 40 }]}>
        <View style={st.blob1} /><View style={st.blob2} />
        <Pressable onPress={done} style={[st.close, { top: insets.top + 10 }]} accessibilityLabel="إغلاق"><Icon name="x" color="#fff" size={20} /></Pressable>
        <View style={st.mark}><Image source={require('../../assets/brand/mark.png')} style={{ width: 56, height: 56 }} contentFit="contain" /></View>
        <AppText variant="title" color="#fff" center style={{ fontSize: 25, marginTop: 16 }}>سجّل وخلّ رحلاتك معك</AppText>
        <AppText variant="small" color="#E2DAEE" center>خطوة وحدة، بدون كلمة مرور</AppText>
      </View>

      <View style={{ padding: 20, gap: 12 }}>
        {apple ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={18} style={{ height: 56, width: '100%' }} onPress={onApple} />
        ) : (
          <Pressable onPress={Platform.OS === 'ios' ? onApple : undefined} style={[st.btn, { backgroundColor: '#000', opacity: Platform.OS === 'ios' ? 1 : 0.5 }]}>
            <Icon name="apple" color="#fff" fill="#fff" size={22} strokeWidth={1.6} />
            <AppText style={st.btnTx} color="#fff">{Platform.OS === 'ios' ? 'المتابعة مع Apple' : 'Apple على الآيفون فقط'}</AppText>
          </Pressable>
        )}
        <View style={[st.btn, { backgroundColor: '#fff', borderWidth: 1.5, borderColor: brand.line }]}>
          <AppText style={{ fontFamily: font.bold, fontSize: 18 }} color="#4285F4">G</AppText>
          <AppText style={st.btnTx}>المتابعة مع Google</AppText>
          <View style={st.soon}><AppText variant="tiny" color={brand.purple}>قريباً</AppText></View>
        </View>
        <View style={[st.btn, { backgroundColor: brand.softPurple }]}>
          <Icon name="phone" color={brand.purple} size={20} />
          <AppText style={st.btnTx} color={brand.purple}>برقم الجوال</AppText>
          <View style={st.soon}><AppText variant="tiny" color={brand.purple}>قريباً</AppText></View>
        </View>
        {busy ? <ActivityIndicator color={brand.purple} /> : null}
        {err ? <AppText variant="small" color={brand.pinkDeep} center>{err}</AppText> : null}
      </View>

      <View style={st.perks}>
        {([['bag', brand.softOrange, brand.orangeDeep, 'رحلاتك ومفضلتك على كل أجهزتك'], ['star', brand.softPurple, brand.purple, 'نقاط وأوسمة وجواز السعودية'], ['ticket', brand.softPink, brand.pinkDeep, 'كوبونات حصرية في مدينتك']] as const).map(([k, bg, fg, t]) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Badge icon={k} bg={bg} fg={fg} size={32} r={10} /><AppText variant="small">{t}</AppText></View>
        ))}
      </View>
      <Pressable onPress={done} style={{ marginTop: 18 }}><AppText center style={{ fontFamily: font.semibold }} color={brand.purple}>تصفح كزائر</AppText></Pressable>

      <AppText variant="tiny" muted center style={[st.terms, { bottom: Math.max(insets.bottom, 16) + 6 }]}>
        بالمتابعة توافق على <AppText variant="tiny" color={brand.purple} onPress={() => WebBrowser.openBrowserAsync('https://www.saudi-guide.com/terms')}>شروط الاستخدام</AppText> و<AppText variant="tiny" color={brand.purple} onPress={() => WebBrowser.openBrowserAsync('https://www.saudi-guide.com/privacy')}>سياسة الخصوصية</AppText>
      </AppText>
    </View>
  );
}

const st = StyleSheet.create({
  top: { backgroundColor: brand.purple, height: 320, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden', alignItems: 'center' },
  blob1: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(248,151,67,0.18)', top: -60, left: -80 },
  blob2: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(235,131,155,0.18)', bottom: -40, right: -40 },
  close: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  mark: { width: 76, height: 76, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  btn: { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnTx: { fontFamily: font.bold, fontSize: 16 },
  soon: { position: 'absolute', left: 14, backgroundColor: brand.chip, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  perks: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, padding: 14, gap: 10 },
  terms: { position: 'absolute', left: 30, right: 30 },
});
