import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { BackButton } from '@/components/ui';
import { acceptMerchantTerms, couponErr, dayLabel, merchantTerms } from '@/lib/coupons';
import { brand, font } from '@/theme/tokens';

/** الشروط والأحكام لبوابة التجار. مع ?accept=1 يطلع زر «أوافق» (لما تتحدث النسخة) */
export default function MerchantTerms() {
  const insets = useSafeAreaInsets();
  const prm = useLocalSearchParams<{ accept?: string }>();
  const [t, setT] = useState<{ version: string; date: string; sections: [string, string[]][] } | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { merchantTerms().then(setT).catch(() => setErr('ما قدرنا نجيب الشروط، تأكد من النت.')); }, []);
  const accept = async () => {
    if (!t || !ok) return;
    setBusy(true); setErr('');
    try { await acceptMerchantTerms(t.version); router.back(); } catch (e) { setErr(couponErr(e)); } finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: prm.accept ? 170 : 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <View style={{ flex: 1 }}>
            <AppText variant="title">الشروط والأحكام للتجار</AppText>
            {t ? <AppText variant="small" muted>النسخة {t.version} · آخر تحديث {dayLabel(t.date)} {t.date.slice(0, 4)}</AppText> : null}
          </View>
        </View>
        {!t ? (err ? <AppText center muted style={{ marginTop: 30 }}>{err}</AppText> : <ActivityIndicator color={brand.purple} style={{ marginTop: 40 }} />) : (
          <>
            <View style={st.intro}><AppText variant="small" style={{ lineHeight: 22 }}>هذي الشروط اتفاق بينك وبين دليل السعودية. اقرأها كاملة: موافقتك عليها من حسابك تنحفظ بالتاريخ والوقت وتعتبر توقيع ملزم.</AppText></View>
            {t.sections.map(([title, items], i) => (
              <View key={title} style={st.sec}>
                <AppText style={{ fontFamily: font.bold, fontSize: 16 }}>{i + 1}. {title}</AppText>
                {items.map((x, k) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <AppText variant="small" muted>{i + 1}.{k + 1}</AppText>
                    <AppText variant="small" style={{ flex: 1, lineHeight: 23 }}>{x}</AppText>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
      {prm.accept && t ? (
        <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Pressable style={st.check} onPress={() => setOk(!ok)}>
            <View style={[st.box, ok && { backgroundColor: brand.purple, borderColor: brand.purple }]}>{ok ? <Icon name="check" color="#fff" size={14} strokeWidth={3} /> : null}</View>
            <AppText variant="small" style={{ flex: 1, lineHeight: 21 }}>قرأت الشروط والأحكام (النسخة {t.version}) وأوافق عليها وألتزم بها.</AppText>
          </Pressable>
          {err ? <AppText variant="small" color={brand.pinkDeep}>{err}</AppText> : null}
          <Pressable style={[st.cta, !ok && { opacity: 0.5 }]} onPress={accept} disabled={!ok || busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color="#fff">أوافق</AppText>}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  intro: { marginTop: 14, backgroundColor: brand.softPurple, borderRadius: 18, padding: 14 },
  sec: { marginTop: 12, backgroundColor: brand.card, borderRadius: 20, padding: 16 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: brand.card, paddingHorizontal: 16, paddingTop: 14, gap: 10, borderTopLeftRadius: 26, borderTopRightRadius: 26, shadowColor: '#2B1F45', shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
  check: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: brand.faint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  cta: { height: 54, borderRadius: 18, backgroundColor: brand.purple, alignItems: 'center', justifyContent: 'center' },
});
