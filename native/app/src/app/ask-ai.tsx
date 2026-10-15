import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { BackButton } from '@/components/ui';
import { aiAsk, aiErr, aiStatus, type AiMsg, type Quota } from '@/lib/ai';
import { useAuth } from '@/lib/auth';
import { cityName } from '@/lib/content';
import { riyadhDate } from '@/lib/text';
import { brand, font, kindStyle, photos, INPUT_START } from '@/theme/tokens';

const STARTERS = ['وش أزور في المدينة المنورة مع العائلة؟', 'وش فيه فعاليات في الرياض هالأسبوع؟', 'أبي مقهى هادي في جدة للشغل', 'وين أتعشى في العلا بإطلالة حلوة؟'];

/** «اسأل الدليل»: مساعد ذكي يجاوب من محتوى الدليل فقط (أماكن وفعاليات وإجابات أهل المدن) */
export default function AskAi() {
  const insets = useSafeAreaInsets();
  const prm = useLocalSearchParams<{ city?: string; q?: string }>();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<AiMsg[]>([]);
  const [text, setText] = useState(prm.q || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [quota, setQuota] = useState<Quota | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => { if (user) aiStatus().then((s) => setQuota(s.quota?.chat ?? null)).catch(() => {}); }, [user]);
  useEffect(() => { setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80); }, [msgs, busy]);

  const send = async (q?: string) => {
    const t = (q ?? text).trim();
    if (!t || busy) return;
    if (!user) return router.push('/login');
    const next: AiMsg[] = [...msgs, { role: 'user', content: t }];
    setMsgs(next); setText(''); setErr(''); setBusy(true);
    try {
      const r = await aiAsk(next, prm.city);
      setMsgs([...next, { role: 'assistant', content: r.answer, places: r.places, events: r.events, followups: r.followups }]);
      setQuota(r.quota);
    } catch (e) {
      setErr(aiErr(e));
      setMsgs(msgs); setText(t);
    } finally { setBusy(false); }
  };

  const left = quota && !quota.plus ? quota.left : null;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[st.top, { paddingTop: insets.top + 10 }]}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <AppText variant="title">اسأل الدليل</AppText>
          <AppText variant="tiny" muted>{quota?.plus ? 'دليل+ · بدون حد' : left != null ? `باقي لك ${left} ${left === 1 ? 'سؤال' : 'أسئلة'} اليوم مجاناً` : 'مساعدك الذكي للسياحة في السعودية'}</AppText>
        </View>
        <View style={st.plus}><Icon name="spark" color="#fff" size={14} /><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>دليل+</AppText></View>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 12 }} keyboardShouldPersistTaps="handled">
        {!msgs.length ? (
          <View style={st.intro}>
            <View style={st.introIcon}><Icon name="spark" color="#fff" size={26} /></View>
            <AppText style={{ fontFamily: font.bold, fontSize: 18 }} center>هلا! وش تبي تعرف؟</AppText>
            <AppText variant="small" muted center style={{ lineHeight: 22 }}>أجاوبك من أماكن الدليل وفعالياته ونصايح أهل المدن، وأعطيك الأماكن جاهزة تضيفها لرحلتك.</AppText>
            <View style={{ gap: 8, marginTop: 10, alignSelf: 'stretch' }}>
              {STARTERS.map((s) => <Pressable key={s} style={st.starter} onPress={() => send(s)}><AppText variant="small" style={{ fontFamily: font.semibold }}>{s}</AppText></Pressable>)}
            </View>
          </View>
        ) : null}

        {msgs.map((m, i) => m.role === 'user' ? (
          <View key={i} style={st.me}><AppText color="#fff" style={{ lineHeight: 24 }}>{m.content}</AppText></View>
        ) : (
          <View key={i} style={{ gap: 8 }}>
            <View style={st.bot}><AppText style={{ lineHeight: 26 }}>{m.content}</AppText></View>
            {(m.places || []).map((p) => {
              const ks = kindStyle[p.kinds[0]] ?? kindStyle.sights;
              return (
                <Pressable key={'p' + p.id} style={st.card} onPress={() => router.push(`/place/${p.id}`)}>
                  <Image source={p.thumb || photos.heritage} style={st.cardImg} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontFamily: font.bold, fontSize: 14 }} numberOfLines={1}>{p.title}</AppText>
                    <AppText variant="tiny" color={ks.fg}>{cityName(p.city)}</AppText>
                    {p.summary ? <AppText variant="tiny" muted numberOfLines={1}>{p.summary}</AppText> : null}
                  </View>
                  <Icon name="chevron" size={16} color={brand.faint} />
                </Pressable>
              );
            })}
            {(m.events || []).map((e) => (
              <Pressable key={'e' + e.id} style={st.card} onPress={() => router.push(`/event/${e.id}`)}>
                <Image source={e.thumb || photos.fest} style={st.cardImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontFamily: font.bold, fontSize: 14 }} numberOfLines={1}>{e.title}</AppText>
                  <AppText variant="tiny" color={brand.pinkDeep}>{riyadhDate(e.start, false)} · {cityName(e.city)}</AppText>
                </View>
                <Icon name="chevron" size={16} color={brand.faint} />
              </Pressable>
            ))}
            {i === msgs.length - 1 && (m.followups || []).length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {m.followups!.map((f) => <Pressable key={f} style={st.follow} onPress={() => send(f)}><AppText variant="tiny" color={brand.purple} style={{ fontFamily: font.bold }}>{f}</AppText></Pressable>)}
              </View>
            ) : null}
          </View>
        ))}
        {busy ? <View style={[st.bot, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}><ActivityIndicator color={brand.purple} /><AppText variant="small" muted>أدوّر لك في الدليل…</AppText></View> : null}
        {err ? <AppText center color={brand.pinkDeep} style={{ fontFamily: font.semibold }}>{err}</AppText> : null}
      </ScrollView>

      <View style={[st.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput value={text} onChangeText={setText} placeholder="اسأل عن أي مكان أو فعالية…" placeholderTextColor={brand.faint} style={st.input} multiline maxLength={500} onSubmitEditing={() => send()} />
        <Pressable onPress={() => send()} disabled={busy || !text.trim()} style={[st.send, (busy || !text.trim()) && { opacity: 0.4 }]}><Icon name="up" color="#fff" size={20} /></Pressable>
      </View>
      <AppText variant="tiny" muted center style={{ paddingBottom: Math.max(insets.bottom, 6), marginTop: -6 }}>المساعد يجاوب من محتوى الدليل، وتأكد من المواعيد قبل ما تروح.</AppText>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  plus: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: brand.purple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  intro: { alignItems: 'center', gap: 6, backgroundColor: brand.card, borderRadius: 24, padding: 18, marginTop: 10 },
  introIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  starter: { backgroundColor: brand.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  me: { alignSelf: 'flex-start', maxWidth: '85%', backgroundColor: brand.purple, borderRadius: 20, borderTopLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  bot: { alignSelf: 'flex-end', maxWidth: '92%', backgroundColor: brand.card, borderRadius: 20, borderTopRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: brand.card, borderRadius: 16, padding: 8 },
  cardImg: { width: 52, height: 52, borderRadius: 12 },
  follow: { borderWidth: 1.5, borderColor: brand.purple, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, backgroundColor: brand.bg },
  input: { flex: 1, minHeight: 46, maxHeight: 120, backgroundColor: brand.card, borderRadius: 18, borderWidth: 1.5, borderColor: brand.line, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, fontFamily: font.regular, fontSize: 15, color: brand.text, textAlign: INPUT_START },
  send: { width: 46, height: 46, borderRadius: 16, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
});
