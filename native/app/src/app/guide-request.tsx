import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Input } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { BackButton } from '@/components/ui';
import { myStats, requestGuide, type Stats } from '@/lib/community';
import { couponErr } from '@/lib/coupons';
import { brand, font } from '@/theme/tokens';
import { t } from '@/lib/i18n';

/** طلب شارة «مرشد موثّق»: من 500 نقطة، والإدارة تراجعه من اللوحة */
export default function GuideRequest() {
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<Stats | null>(null);
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  useFocusEffect(useCallback(() => { myStats().then(setS).catch(() => {}); }, []));

  const submit = async () => {
    if (about.trim().length < 20) return setErr(t('اكتب شوي أكثر عن نفسك (سطرين على الأقل).'));
    setBusy(true); setErr('');
    try { await requestGuide(about.trim()); setSent(true); } catch (e) { setErr(couponErr(e)); } finally { setBusy(false); }
  };
  const req = s?.guide.request;
  const pct = s ? Math.min(1, s.points / s.guide.at) : 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 60, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
        <BackButton />
        <View style={st.hero}>
          <View style={st.icon}><Icon name="crown" color="#fff" size={32} /></View>
          <AppText variant="title" color="#fff" center style={{ marginTop: 12 }}>{t('مرشد موثّق')}</AppText>
          <AppText variant="small" color="#E2DAEE" center style={{ lineHeight: 22 }}>{t('شارة تطلع جنب اسمك في المجتمع، وإجاباتك تظهر أول، والناس يثقون فيها أكثر.')}</AppText>
        </View>

        {!s ? <ActivityIndicator color={brand.purple} style={{ marginTop: 30 }} /> : s.role !== 'user' ? (
          <View style={st.card}><AppText style={{ fontFamily: font.bold }} center>{s.role === 'guide' ? t('أنت مرشد موثّق') : t('أنت من فريق الدليل')} ✓</AppText></View>
        ) : sent || req?.status === 'pending' ? (
          <View style={st.card}>
            <Icon name="check" color={brand.green} size={30} />
            <AppText style={{ fontFamily: font.bold, fontSize: 16 }} center>{t('طلبك وصلنا')}</AppText>
            <AppText variant="small" muted center>{t('نراجعه ويوصلك إشعار بالنتيجة.')}</AppText>
          </View>
        ) : !s.guide.eligible ? (
          <View style={st.card}>
            <AppText style={{ fontFamily: font.bold }}>{t('باقي لك {n} نقطة', { n: s.guide.at - s.points })}</AppText>
            <View style={st.track}><View style={[st.fill, { width: `${pct * 100}%` }]} /></View>
            <AppText variant="small" muted style={{ lineHeight: 22, marginTop: 6 }}>{t('عندك {n} من {at}. أسرع طريق: جاوب على أسئلة الناس في المجتمع (+5)، وأفضل إجابة (+15)، وقيّم الأماكن (+3)، واختم جوازك (+10، ومدينة جديدة +25).', { n: s.points, at: s.guide.at })}</AppText>
            <Pressable style={st.btn} onPress={() => router.push('/community')}><AppText style={{ fontFamily: font.bold }} color="#fff">{t('روح للمجتمع')}</AppText></Pressable>
          </View>
        ) : (
          <View style={st.card}>
            {req?.status === 'rejected' ? <AppText variant="small" color={brand.pinkDeep} style={{ marginBottom: 6 }}>{t('الطلب السابق ما انقبل')}{req.note ? `: ${req.note}` : ''}.</AppText> : null}
            <AppText style={{ fontFamily: font.bold }}>{t('عرّفنا بنفسك')}</AppText>
            <AppText variant="small" muted style={{ marginBottom: 8, lineHeight: 21 }}>{t('وش المدن اللي تعرفها زين؟ وش خبرتك؟ (تشوفه الإدارة بس)')}</AppText>
            <Input value={about} onChangeText={setAbout} multiline maxLength={600} placeholder={t('مثلاً: من أهل المدينة، أعرف المزارع والمساجد التاريخية، وأحب أرشد الزوار…')} />
            {err ? <AppText variant="small" color={brand.pinkDeep} style={{ marginTop: 8 }}>{err}</AppText> : null}
            <Pressable style={st.btn} onPress={submit} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <AppText style={{ fontFamily: font.bold }} color="#fff">{t('أرسل الطلب')}</AppText>}</Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  hero: { marginTop: 14, backgroundColor: brand.purple, borderRadius: 28, padding: 22, alignItems: 'center' },
  icon: { width: 64, height: 64, borderRadius: 22, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  card: { marginTop: 14, backgroundColor: brand.card, borderRadius: 22, padding: 16, gap: 6, alignItems: 'stretch' },
  track: { height: 10, borderRadius: 5, backgroundColor: brand.chip, marginTop: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: brand.orange },
  btn: { marginTop: 12, height: 50, borderRadius: 16, backgroundColor: brand.purple, alignItems: 'center', justifyContent: 'center' },
});
