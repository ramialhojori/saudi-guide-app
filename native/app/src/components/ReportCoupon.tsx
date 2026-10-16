import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Input } from '@/components/Form';
import { couponErr, reportCoupon } from '@/lib/coupons';
import { brand, font } from '@/theme/tokens';
import { t } from '@/lib/i18n';

const REASONS: [string, string][] = [
  ['refused', t('المحل رفض الكوبون')], ['different', t('العرض مختلف عن المكتوب')], ['conditions', t('حطوا شروط ما كانت مكتوبة')], ['closed', t('المحل مقفل أو ما لقيته')], ['other', t('مشكلة ثانية')],
];

/** «بلّغ عن مشكلة في الكوبون» — حماية المستخدم من تلاعب التجار */
export function ReportCoupon({ id, visible, onClose, initial }: { id: number; visible: boolean; onClose: () => void; initial?: string }) {
  const [reason, setReason] = useState(initial || 'refused');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | boolean>(null);
  const [err, setErr] = useState('');
  const send = async () => {
    setBusy(true); setErr('');
    try { const r = await reportCoupon(id, reason, note.trim()); setDone(r.paused); } catch (e) { setErr(couponErr(e)); } finally { setBusy(false); }
  };
  const close = () => { setDone(null); setNote(''); setErr(''); onClose(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={st.back} onPress={close} />
        <View style={st.sheet}>
          {done !== null ? (
            <>
              <AppText style={{ fontFamily: font.bold, fontSize: 18 }} center>{t('وصلنا بلاغك، شكراً')}</AppText>
              <AppText variant="small" muted center style={{ lineHeight: 22, marginTop: 6 }}>
                {done ? t('وصلت بلاغات كثيرة على هالكوبون، فأوقفناه مؤقتاً لين نراجعه.') : t('نراجعه مع المحل، ولو ثبت تاخذ 20 نقطة اعتذار ونتخذ إجراء مع المحل.')}
              </AppText>
              <Pressable style={st.btn} onPress={close}><AppText style={{ fontFamily: font.bold }} color="#fff">{t('تمام')}</AppText></Pressable>
            </>
          ) : (
            <>
              <AppText style={{ fontFamily: font.bold, fontSize: 18 }}>{t('وش صار؟')}</AppText>
              <AppText variant="small" muted style={{ marginBottom: 10 }}>{t('بلاغك يحمي غيرك. المحل اللي يتكرر عليه البلاغ نوقفه.')}</AppText>
              {REASONS.map(([k, label]) => (
                <Pressable key={k} style={[st.opt, reason === k && st.optOn]} onPress={() => setReason(k)}>
                  <View style={[st.radio, reason === k && { borderColor: brand.pinkDeep }]}>{reason === k ? <View style={st.dot} /> : null}</View>
                  <AppText style={{ fontFamily: font.semibold, fontSize: 14 }}>{label}</AppText>
                </Pressable>
              ))}
              <Input value={note} onChangeText={setNote} multiline maxLength={500} placeholder={t('تفاصيل تساعدنا (اختياري): وش قالوا لك؟ متى؟')} style={{ marginTop: 8, minHeight: 80 }} />
              {err ? <AppText variant="small" color={brand.pinkDeep} style={{ marginTop: 6 }}>{err}</AppText> : null}
              <Pressable style={[st.btn, { backgroundColor: brand.pinkDeep }]} onPress={send} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <AppText style={{ fontFamily: font.bold }} color="#fff">{t('أرسل البلاغ')}</AppText>}</Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: brand.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: brand.card, borderRadius: 14, padding: 12, marginTop: 6, borderWidth: 1.5, borderColor: 'transparent' },
  optOn: { borderColor: brand.pinkDeep },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: brand.faint, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: brand.pinkDeep },
  btn: { marginTop: 14, height: 52, borderRadius: 16, backgroundColor: brand.purple, alignItems: 'center', justifyContent: 'center' },
});
