import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { BackButton } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ago } from '@/lib/community';
import { CONTACT_KINDS, myContact, sendContact, type ContactMsg } from '@/lib/contact';
import { brand, font, INPUT_START } from '@/theme/tokens';

/** «تواصل معنا»: يختار نوع الرسالة ويكتبها، وتوصل لوحة التحكم مباشرة. والرد يوصله هنا وبإشعار */
export default function Contact() {
  const insets = useSafeAreaInsets();
  const prm = useLocalSearchParams<{ kind?: string; text?: string }>();
  const { user } = useAuth();
  const [kind, setKind] = useState(prm.kind && CONTACT_KINDS.some((k) => k.id === prm.kind) ? prm.kind : '');
  const [text, setText] = useState(prm.text || '');
  const [replyTo, setReplyTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<ContactMsg[]>([]);

  useFocusEffect(useCallback(() => { if (user) myContact().then(setMine).catch(() => {}); }, [user?.id]));

  const k = CONTACT_KINDS.find((x) => x.id === kind);
  const ok = !!kind && text.trim().length >= 5 && (!!user || replyTo.trim().length >= 5);
  const send = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr('');
    try {
      await sendContact(kind, text.trim(), user ? undefined : replyTo.trim());
      setSent(true); setText('');
      if (user) myContact().then(setMine).catch(() => {});
    } catch (e) {
      const c = e instanceof ApiError ? e.code : '';
      setErr(c === 'too_many' ? 'أرسلت رسائل كثيرة اليوم، جرّب بكرة.' : c === 'text_too_short' ? 'اكتب تفاصيل أكثر شوي.' : 'ما قدرنا نرسلها، تأكد من النت وجرّب مرة ثانية.');
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 60, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <View style={{ flex: 1 }}>
            <AppText variant="title">تواصل معنا</AppText>
            <AppText variant="small" muted>رسالتك توصل فريق الدليل مباشرة، والرد يوصلك هنا</AppText>
          </View>
        </View>

        {sent ? (
          <View style={st.done}>
            <View style={st.doneIc}><Icon name="check" color="#fff" size={26} strokeWidth={3} /></View>
            <AppText style={{ fontFamily: font.bold, fontSize: 18 }} center>وصلتنا رسالتك، شكراً لك</AppText>
            <AppText variant="small" muted center style={{ lineHeight: 22 }}>{user ? 'بنرد عليك هنا وبيوصلك إشعار أول ما نرد.' : 'بنرد عليك على وسيلة التواصل اللي كتبتها.'}</AppText>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <Pressable style={[st.btn, { backgroundColor: brand.purple }]} onPress={() => { setSent(false); setKind(''); }}><AppText color="#fff" style={{ fontFamily: font.bold }}>رسالة ثانية</AppText></Pressable>
              <Pressable style={[st.btn, { backgroundColor: brand.ink }]} onPress={() => router.back()}><AppText color="#fff" style={{ fontFamily: font.bold }}>رجوع</AppText></Pressable>
            </View>
          </View>
        ) : (
          <>
            <AppText style={{ fontFamily: font.bold, marginTop: 20, marginBottom: 10 }}>وش نوع رسالتك؟</AppText>
            <View style={st.kinds}>
              {CONTACT_KINDS.map((x) => {
                const on = kind === x.id;
                return (
                  <Pressable key={x.id} style={[st.kind, on && st.kindOn]} onPress={() => setKind(x.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                    <Icon name={x.icon as IconName} color={on ? '#fff' : brand.purple} size={20} />
                    <AppText variant="small" color={on ? '#fff' : brand.text} style={{ fontFamily: font.semibold }} center>{x.name}</AppText>
                  </Pressable>
                );
              })}
            </View>

            {kind ? (
              <>
                <AppText style={{ fontFamily: font.bold, marginTop: 18, marginBottom: 8 }}>رسالتك</AppText>
                <TextInput value={text} onChangeText={setText} placeholder={k?.hint} placeholderTextColor={brand.faint} multiline maxLength={2000} style={st.input} />
                <AppText variant="tiny" muted style={{ marginTop: 4 }}>{text.length} / 2000</AppText>
                {!user ? (
                  <>
                    <AppText style={{ fontFamily: font.bold, marginTop: 14, marginBottom: 8 }}>كيف نرد عليك؟</AppText>
                    <TextInput value={replyTo} onChangeText={setReplyTo} placeholder="إيميلك أو رقم جوالك" placeholderTextColor={brand.faint} style={[st.input, { minHeight: 50 }]} keyboardType="email-address" autoCapitalize="none" />
                    <Pressable onPress={() => router.push('/login')}><AppText variant="small" color={brand.purple} style={{ marginTop: 8 }}>أو سجّل دخولك ويوصلك الرد داخل التطبيق</AppText></Pressable>
                  </>
                ) : null}
                {err ? <AppText color={brand.pinkDeep} style={{ marginTop: 10, fontFamily: font.semibold }}>{err}</AppText> : null}
                <Pressable onPress={send} disabled={!ok || busy} style={[st.send, (!ok || busy) && { opacity: 0.45 }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 16 }}>أرسل</AppText>}
                </Pressable>
              </>
            ) : null}
          </>
        )}

        {mine.length ? (
          <>
            <AppText style={{ fontFamily: font.bold, marginTop: 26, marginBottom: 10 }}>رسائلك السابقة</AppText>
            <View style={{ gap: 10 }}>
              {mine.map((m) => (
                <View key={m.id} style={st.msg}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={st.tag}><AppText variant="tiny" color={brand.purple} style={{ fontFamily: font.bold }}>{m.kindName}</AppText></View>
                    <AppText variant="tiny" muted style={{ flex: 1 }}>{ago(m.created)}</AppText>
                    <AppText variant="tiny" color={m.reply ? brand.green : brand.orangeDeep} style={{ fontFamily: font.bold }}>{m.reply ? 'تم الرد' : m.status === 'new' ? 'وصلت' : 'تمت'}</AppText>
                  </View>
                  <AppText variant="small" style={{ lineHeight: 22, marginTop: 6 }} numberOfLines={4}>{m.text}</AppText>
                  {m.reply ? (
                    <View style={st.reply}>
                      <AppText variant="tiny" color={brand.green} style={{ fontFamily: font.bold }}>رد فريق الدليل</AppText>
                      <AppText variant="small" style={{ lineHeight: 22 }}>{m.reply}</AppText>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kind: { width: '47.5%', backgroundColor: brand.card, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: brand.line },
  kindOn: { backgroundColor: brand.purple, borderColor: brand.purple },
  input: { backgroundColor: brand.card, borderRadius: 18, borderWidth: 1.5, borderColor: brand.line, minHeight: 140, padding: 14, fontFamily: font.regular, fontSize: 15, color: brand.text, textAlign: INPUT_START, textAlignVertical: 'top', lineHeight: 24 },
  send: { marginTop: 16, height: 54, borderRadius: 18, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  done: { marginTop: 24, backgroundColor: brand.card, borderRadius: 24, padding: 22, alignItems: 'center', gap: 8 },
  doneIc: { width: 56, height: 56, borderRadius: 28, backgroundColor: brand.green, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  btn: { borderRadius: 14, paddingHorizontal: 18, height: 44, justifyContent: 'center' },
  msg: { backgroundColor: brand.card, borderRadius: 18, padding: 14 },
  tag: { backgroundColor: brand.softPurple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  reply: { marginTop: 10, backgroundColor: brand.softGreen, borderRadius: 14, padding: 10, gap: 2 },
});
