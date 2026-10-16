import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { alert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { getInvite, redeemInvite, shareInvite, type InviteInfo } from '@/lib/invite';
import { brand, font, INPUT_START } from '@/theme/tokens';

const ERR: Record<string, string> = {
  bad_code: 'الكود غلط، تأكد منه وجرّب مرة ثانية.', own_code: 'هذا كودك أنت، أرسله لأصحابك.', already_used: 'استخدمت كود دعوة قبل.',
  old_account: 'كود الدعوة للحسابات الجديدة بس (أول 7 أيام).', login_required: 'سجّل دخولك أول.',
};

/** «ادعُ صديق»: كودك ورابطك وزر المشاركة، وعدد أصحابك اللي انضموا، وخانة كود صديق للحسابات الجديدة */
export function InviteScreen({ code: incoming }: { code?: string }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [code, setCode] = useState((incoming || '').toUpperCase());
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const load = () => { if (user) getInvite().then(setInfo).catch(() => setInfo(null)); };
  useEffect(load, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await redeemInvite(code.trim());
      alert(t('مبروك!'), t('انضاف لك {n} أيام دليل+ هدية{from}', { n: r.days, from: r.inviter ? t(' من دعوة {name}', { name: r.inviter }) : '' }));
      load();
    } catch (e) { alert(t('ما انقبل الكود'), t(ERR[(e as { code?: string }).code || ''] || 'صار خطأ، جرّب بعد شوي.')); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      <View style={[st.head, { paddingTop: insets.top + 12 }]}>
        <Pressable style={st.glass} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel={t('رجوع')}><Icon name="back" color="#fff" /></Pressable>
        <View style={st.giftIc}><Icon name="crown" color={brand.orange} size={34} /></View>
        <AppText variant="title" color="#fff" center style={{ fontSize: 24 }}>{t('ادعُ صديق')}</AppText>
        <AppText color="#FFF3E6" center style={{ lineHeight: 24, paddingHorizontal: 12 }}>{t('كل صديق يسجّل بكودك، ناخذ أنت وهو {n} أيام دليل+ هدية', { n: info?.rewardDays ?? 3 })}</AppText>
      </View>

      {!user ? (
        <View style={st.card}>
          <AppText center style={{ fontFamily: font.bold, fontSize: 16 }}>{t('سجّل دخولك عشان يطلع لك كودك')}</AppText>
          <Pressable style={st.btn} onPress={() => router.push('/login')}><AppText color="#fff" style={{ fontFamily: font.bold }}>{t('تسجيل الدخول')}</AppText></Pressable>
          {incoming ? <AppText variant="small" muted center>{t('بعد ما تسجّل، ارجع لهذا الرابط وفعّل كود صديقك {code}', { code: incoming })}</AppText> : null}
        </View>
      ) : !info ? <ActivityIndicator color={brand.orange} style={{ marginTop: 30 }} /> : (
        <>
          <View style={st.card}>
            <AppText variant="small" muted center>{t('كود دعوتك')}</AppText>
            <Pressable style={[st.code, copied && { borderColor: brand.green }]} onPress={async () => { await Clipboard.setStringAsync(info.code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
              <AppText style={{ fontFamily: font.bold, fontSize: 26, letterSpacing: 4 }}>{info.code}</AppText>
              <AppText variant="tiny" color={copied ? brand.green : brand.purple} style={{ fontFamily: font.bold }}>{copied ? t('انتسخ') : t('انسخ')}</AppText>
            </Pressable>
            <Pressable style={st.btn} onPress={() => shareInvite(info)}>
              <Icon name="share" color="#fff" size={18} /><AppText color="#fff" style={{ fontFamily: font.bold }}>{t('أرسل الدعوة لأصحابك')}</AppText>
            </Pressable>
            <View style={st.stats}>
              <View style={st.stat}><AppText style={{ fontFamily: font.bold, fontSize: 22 }} color={brand.purple}>{info.invited}</AppText><AppText variant="tiny" muted>{t('صديق انضم')}</AppText></View>
              <View style={st.stat}><AppText style={{ fontFamily: font.bold, fontSize: 22 }} color={brand.orangeDeep}>{info.daysEarned}</AppText><AppText variant="tiny" muted>{t('يوم دليل+ كسبتها')}</AppText></View>
            </View>
          </View>

          {info.canRedeem ? (
            <View style={st.card}>
              <AppText style={{ fontFamily: font.bold, fontSize: 16 }}>{t('عندك كود دعوة من صديق؟')}</AppText>
              <AppText variant="small" muted>{t('للحسابات الجديدة في أول 7 أيام')}</AppText>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder={t('اكتب الكود')} placeholderTextColor={brand.muted} autoCapitalize="characters" autoCorrect={false}
                  style={[st.input, { textAlign: INPUT_START, letterSpacing: code ? 2 : 0, fontFamily: code ? font.bold : font.regular }]} maxLength={12} />
                <Pressable style={[st.btn, { marginTop: 0, paddingHorizontal: 18 }]} onPress={apply} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <AppText color="#fff" style={{ fontFamily: font.bold }}>{t('فعّل')}</AppText>}</Pressable>
              </View>
            </View>
          ) : info.redeemed ? <AppText variant="small" muted center style={{ marginTop: 12 }}>{t('فعّلت كود دعوة صديق قبل ✓')}</AppText> : null}

          <View style={[st.card, { gap: 6 }]}>
            <AppText style={{ fontFamily: font.bold }}>{t('كيف تشتغل؟')}</AppText>
            {[t('أرسل الرابط أو الكود لصديقك'), t('يحمّل التطبيق ويسجّل حساب جديد'), t('يكتب كودك في صفحة «ادعُ صديق»'), t('توصلكم الأيام الهدية أنتم الاثنين على طول')].map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <View style={st.num}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{i + 1}</AppText></View>
                <AppText variant="small" style={{ flex: 1 }}>{s}</AppText>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: brand.orange, paddingHorizontal: 20, paddingBottom: 24, gap: 8, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  glass: { alignSelf: 'flex-start', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  giftIc: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: brand.card, borderRadius: 22, padding: 16, marginHorizontal: 16, marginTop: 14, gap: 12 },
  code: { borderWidth: 2, borderStyle: 'dashed', borderColor: brand.lilac, borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 2 },
  btn: { flexDirection: 'row', gap: 8, backgroundColor: brand.purple, borderRadius: 14, height: 48, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: brand.chip, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  input: { flex: 1, height: 48, borderRadius: 14, backgroundColor: brand.chip, paddingHorizontal: 14, fontSize: 16, color: brand.text },
  num: { width: 22, height: 22, borderRadius: 11, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
});
