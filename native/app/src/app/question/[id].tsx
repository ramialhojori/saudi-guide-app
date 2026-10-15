import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Avatar, BackButton, Pill } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ago, answer, block, errText, getPost, hideMine, initial, markBest, nAnswers, report, thank, tint, type CAnswer, type CPost } from '@/lib/community';
import { cityName } from '@/lib/content';
import { brand, font, START, INPUT_START } from '@/theme/tokens';

const KIND = { question: 'سؤال', tip: 'نصيحة', photo: 'صورة' } as const;
const REASONS = ['إساءة أو كلام جارح', 'إعلان أو سبام', 'معلومة غلط أو مضللة', 'محتوى غير لائق'];

/** مشاركة في المجتمع مع إجاباتها */
export default function Question() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<CPost | null>(null);
  const [answers, setAnswers] = useState<CAnswer[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try { const r = await getPost(Number(id)); setPost(r.post); setAnswers(r.answers); setState('ok'); }
    catch (e) { setState((e as { status?: number })?.status === 404 ? 'missing' : 'error'); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        <BackButton />
        {state === 'loading' ? <ActivityIndicator color={brand.purple} style={{ marginTop: 60 }} /> : (
          <View style={st.gone}>
            <AppText style={{ fontFamily: font.bold, fontSize: 17 }} center>{state === 'missing' ? 'المشاركة هذي ما عادت موجودة' : 'ما قدرنا نفتح المشاركة'}</AppText>
            <AppText variant="small" muted center>{state === 'missing' ? 'يمكن صاحبها شالها أو انخفت بعد بلاغات.' : 'تأكد من النت وجرّب مرة ثانية.'}</AppText>
            {state === 'error' ? <Pressable style={st.btn} onPress={() => { setState('loading'); load(); }}><AppText color="#fff" style={{ fontFamily: font.bold }}>جرّب مرة ثانية</AppText></Pressable> : null}
          </View>
        )}
      </View>
    );
  }

  const needLogin = () => { router.push('/login'); };

  const thankPost = async () => {
    if (!user) return needLogin();
    if (post.mine) return;
    const old = post;
    setPost({ ...post, thanked: !post.thanked, thanks: post.thanks + (post.thanked ? -1 : 1) });
    try { const r = await thank('p', post.id); setPost((p) => p && { ...p, ...r }); } catch { setPost(old); }
  };
  const thankAnswer = async (a: CAnswer) => {
    if (!user) return needLogin();
    if (a.mine) return;
    const upd = (x: Partial<CAnswer>) => setAnswers((l) => l.map((y) => (y.id === a.id ? { ...y, ...x } : y)));
    upd({ thanked: !a.thanked, thanks: a.thanks + (a.thanked ? -1 : 1) });
    try { upd(await thank('a', a.id)); } catch { upd(a); }
  };
  const best = async (a: CAnswer) => {
    const next = post.best === a.id ? null : a.id;
    setPost({ ...post, best: next });
    try { await markBest(post.id, next); load(); } catch { setPost(post); }
  };
  const send = async () => {
    if (!user) return needLogin();
    const t = text.trim();
    if (t.length < 2 || sending) return;
    setSending(true); setErr('');
    try {
      const r = await answer(post.id, t);
      if (r.status === 'rejected') { setErr(r.message || 'ما قدرنا ننشر إجابتك لأنها تخالف قواعد المجتمع.'); return; }
      setText('');
      if (r.status === 'pending') Alert.alert('وصلت إجابتك', r.message || 'بتظهر بعد مراجعة سريعة من فريق الدليل.');
      await load();
    } catch (e) { setErr(errText(e)); } finally { setSending(false); }
  };

  /** قائمة الخيارات: حذف لمشاركتي، وإبلاغ/حظر لمشاركات غيري */
  const menu = (target: 'p' | 'a', item: { id: number; mine: boolean; author: { id: string; name: string } }) => {
    if (!user) return needLogin();
    if (item.mine) {
      return Alert.alert(target === 'p' ? 'حذف المشاركة' : 'حذف الإجابة', 'بتختفي من المجتمع. متأكد؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'احذف', style: 'destructive', onPress: async () => { try { await hideMine(target, item.id); if (target === 'p') router.back(); else load(); } catch (e) { Alert.alert(errText(e)); } } },
      ]);
    }
    Alert.alert('وش تبي تسوي؟', undefined, [
      { text: 'إبلاغ', onPress: () => Alert.alert('سبب البلاغ', 'نراجع كل بلاغ، وتختفي المشاركة بعد ٣ بلاغات.', [
        ...REASONS.map((r) => ({ text: r, onPress: async () => { try { await report(target, item.id, r); Alert.alert('وصلنا بلاغك', 'شكراً لك، بنراجعه.'); } catch (e) { Alert.alert(errText(e)); } } })),
        { text: 'إلغاء', style: 'cancel' as const },
      ]) },
      { text: `حظر ${item.author.name}`, style: 'destructive', onPress: () => Alert.alert(`حظر ${item.author.name}؟`, 'ما عاد بتشوف مشاركاته ولا إجاباته.', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'احظر', style: 'destructive', onPress: async () => { try { await block(item.author.id); if (target === 'p') router.back(); else load(); } catch (e) { Alert.alert(errText(e)); } } },
      ]) },
      { text: 'إلغاء', style: 'cancel' },
    ]);
  };

  const sub = [post.city ? cityName(post.city) : '', post.answers ? nAnswers(post.answers) : 'بدون إجابات للحين'].filter(Boolean).join(' · ');
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
          <BackButton />
          <View style={{ flex: 1 }}><AppText variant="title">{KIND[post.kind]}</AppText><AppText variant="small" muted>{sub}</AppText></View>
          <Pressable style={st.round} onPress={() => Share.share({ message: `${post.text.slice(0, 120)}\n— من مجتمع دليل السعودية` }).catch(() => {})} accessibilityLabel="مشاركة"><Icon name="share" size={20} /></Pressable>
          <Pressable style={st.round} onPress={() => menu('p', post)} accessibilityLabel="خيارات"><AppText style={{ fontFamily: font.bold, fontSize: 18, lineHeight: 22 }}>···</AppText></Pressable>
        </View>

        <View style={st.q}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Avatar t={initial(post.author.name)} c={tint(post.author.id)} size={42} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <AppText style={{ fontFamily: font.bold }}>{post.author.name}</AppText>
                {post.author.badge ? <Pill label={post.author.badge} bg={brand.purple} fg="#fff" /> : null}
              </View>
              <AppText variant="tiny" muted>{[post.author.city ? 'من ' + cityName(post.author.city) : '', ago(post.created)].filter(Boolean).join(' · ')}</AppText>
            </View>
          </View>
          <AppText style={{ fontFamily: post.kind === 'question' ? font.bold : font.regular, fontSize: post.kind === 'question' ? 18 : 16, lineHeight: 30, marginTop: 10 }}>{post.text}</AppText>
          {post.photo ? <Image source={{ uri: post.photo }} style={st.photo} contentFit="cover" /> : null}
          {post.placeId ? (
            <Pressable style={st.place} onPress={() => router.push(`/place/${post.placeId}`)}>
              <Icon name="pin" color={brand.pinkDeep} size={18} />
              <AppText variant="small" style={{ flex: 1, fontFamily: font.bold }}>افتح المكان في الدليل</AppText>
              <Icon name="chevron" size={16} color={brand.faint} />
            </Pressable>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 12 }}>
            <Pressable onPress={thankPost} disabled={post.mine} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name={post.thanked ? 'heartFill' : 'heart'} color={brand.pinkDeep} size={18} />
              <AppText variant="small" color={brand.pinkDeep} style={{ fontFamily: font.bold }}>{post.mine ? 'شكر' : 'شكراً'}{post.thanks ? ' · ' + post.thanks : ''}</AppText>
            </Pressable>
          </View>
        </View>

        {post.mine && post.kind === 'question' && answers.length && !post.best ? (
          <AppText variant="small" color={brand.green} style={{ paddingHorizontal: 22, paddingTop: 14, fontFamily: font.bold }}>لقيت جوابك؟ اختر أفضل إجابة عشان تفيد اللي بعدك.</AppText>
        ) : null}

        <View style={{ gap: 12, paddingHorizontal: 16, marginTop: 12 }}>
          {answers.map((a) => {
            const isBest = post.best === a.id;
            return (
              <View key={a.id} style={[st.a, isBest && { borderWidth: 2, borderColor: brand.green }]}>
                {isBest ? <AppText variant="tiny" color={brand.green} style={{ fontFamily: font.bold, marginBottom: 6 }}>✓ أفضل إجابة</AppText> : null}
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Avatar t={initial(a.author.name)} c={tint(a.author.id)} size={36} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <AppText style={{ fontFamily: font.bold, fontSize: 14 }}>{a.author.name}</AppText>
                      {a.author.badge ? <Pill label={a.author.badge} bg={brand.purple} fg="#fff" /> : null}
                    </View>
                    <AppText variant="tiny" muted>{[a.author.city ? 'من ' + cityName(a.author.city) : '', ago(a.created)].filter(Boolean).join(' · ')}</AppText>
                  </View>
                  <Pressable onPress={() => menu('a', a)} hitSlop={10} accessibilityLabel="خيارات"><AppText muted style={{ fontFamily: font.bold, fontSize: 16 }}>···</AppText></Pressable>
                </View>
                <AppText style={{ marginTop: 8, lineHeight: 26 }}>{a.text}</AppText>
                <View style={{ flexDirection: 'row', gap: 18, marginTop: 10, alignItems: 'center' }}>
                  <Pressable onPress={() => thankAnswer(a)} disabled={a.mine} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name={a.thanked ? 'heartFill' : 'heart'} color={brand.pinkDeep} size={16} />
                    <AppText variant="small" color={brand.pinkDeep} style={{ fontFamily: font.bold }}>مفيد{a.thanks ? ' · ' + a.thanks : ''}</AppText>
                  </Pressable>
                  {post.mine && post.kind === 'question' && !a.mine ? (
                    <Pressable onPress={() => best(a)} hitSlop={8}><AppText variant="small" color={brand.green} style={{ fontFamily: font.bold }}>{isBest ? 'شيل أفضل إجابة' : 'أفضل إجابة ✓'}</AppText></Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
          {!answers.length ? (
            <View style={st.none}><AppText style={{ fontFamily: font.bold }} center>{post.mine ? 'بنعلمك أول ما أحد يجاوب' : 'كن أول من يجاوب'}</AppText><AppText variant="small" muted center>{post.mine ? 'شارك السؤال مع أحد يعرف المدينة عشان يوصلك الجواب أسرع.' : 'جوابك يفيد ناس كثير يزورون المكان.'}</AppText></View>
          ) : null}
        </View>
      </ScrollView>

      {err ? <AppText variant="small" color={brand.pinkDeep} center style={{ paddingBottom: 4 }}>{err}</AppText> : null}
      <View style={[st.reply, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {user ? (
          <>
            <Avatar t={initial(user.name || '؟')} c={tint(user.id)} size={36} />
            <TextInput value={text} onChangeText={setText} placeholder={post.kind === 'question' ? 'اكتب إجابتك...' : 'اكتب تعليقك...'} placeholderTextColor={brand.faint} style={st.input} multiline maxLength={1500} />
            <Pressable onPress={send} disabled={sending || text.trim().length < 2} style={[st.send, (sending || text.trim().length < 2) && { opacity: 0.4 }]}>
              {sending ? <ActivityIndicator color="#fff" /> : <AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>إرسال</AppText>}
            </Pressable>
          </>
        ) : (
          <Pressable style={[st.send, { flex: 1, alignItems: 'center' }]} onPress={needLogin}><AppText color="#fff" style={{ fontFamily: font.bold }}>سجّل عشان تجاوب</AppText></Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: brand.card, alignItems: 'center', justifyContent: 'center' },
  q: { margin: 16, marginBottom: 0, backgroundColor: brand.card, borderRadius: 24, padding: 16 },
  photo: { height: 260, borderRadius: 18, marginTop: 12, backgroundColor: brand.chip },
  place: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: brand.bg, borderRadius: 14, padding: 12 },
  a: { backgroundColor: brand.card, borderRadius: 22, padding: 14 },
  none: { backgroundColor: brand.card, borderRadius: 22, padding: 20, gap: 4 },
  gone: { marginTop: 60, backgroundColor: brand.card, borderRadius: 24, padding: 24, gap: 8, alignItems: 'center' },
  btn: { marginTop: 8, backgroundColor: brand.purple, borderRadius: 14, paddingHorizontal: 20, height: 44, justifyContent: 'center' },
  reply: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10, backgroundColor: brand.card, borderTopWidth: 1, borderTopColor: brand.line },
  input: { flex: 1, minWidth: 0, minHeight: 44, maxHeight: 120, backgroundColor: brand.bg, borderRadius: 14, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 8, fontFamily: font.regular, fontSize: 14.5, color: brand.text, textAlign: INPUT_START },
  send: { backgroundColor: brand.purple, borderRadius: 12, paddingHorizontal: 14, height: 44, justifyContent: 'center' },
});
