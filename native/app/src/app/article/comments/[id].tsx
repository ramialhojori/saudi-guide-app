import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Avatar, BackButton } from '@/components/ui';
import { alert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { ago } from '@/lib/community';
import { commentErr, getComments, postComment, reportComment, type Comment } from '@/lib/comments';
import { t } from '@/lib/i18n';
import { brand, font, INPUT_START } from '@/theme/tokens';

const TINTS = [brand.lilac, brand.pink, brand.sky, brand.orange, brand.green];
const tint = (s: string) => TINTS[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];

/** تعليقات الخبر: كل تعليق يمر على المراجعة قبل النشر، والمسيء ينرفض ويطلع للكاتب السبب */
export default function ArticleComments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => { getComments(Number(id)).then((r) => setList(r.comments)).catch(() => setList((l) => l ?? [])); }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = async () => {
    if (!user) return router.push('/login');
    const v = text.trim();
    if (v.length < 2 || busy) return;
    setBusy(true); setNote(null);
    try {
      const r = await postComment(Number(id), v);
      setText('');
      setNote(r.status === 'pending' ? { ok: true, text: t('وصل تعليقك، وبينشر بعد المراجعة.') } : null);
      load();
    } catch (e) {
      const x = e as { code?: string; reason?: string };
      setNote({ ok: false, text: x.code === 'rejected' ? t('ما نشرنا التعليق لأنه ما يناسب قواعد التعليقات. خلّ أسلوبنا محترم.') : commentErr(e) });
    } finally { setBusy(false); }
  };
  const report = (c: Comment) => {
    if (!user) return router.push('/login');
    alert(t('تبلّغ عن التعليق؟'), t('نراجعه، ولو وصله 3 بلاغات يختفي تلقائياً.'), [
      { text: t('إلغاء'), style: 'cancel' },
      { text: t('بلّغ'), style: 'destructive', onPress: () => reportComment(c.id).then(() => alert(t('شكراً لك'), t('وصلنا بلاغك وبنراجعه.'))).catch((e) => alert(t('ما تم'), commentErr(e))) },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[st.head, { paddingTop: insets.top + 8 }]}>
        <BackButton />
        <AppText variant="title" style={{ flex: 1 }}>{t('التعليقات')}{list?.length ? ` (${list.filter((c) => c.status === 'visible').length})` : ''}</AppText>
      </View>
      <FlatList
        data={list ?? []}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 30 }}
        ListHeaderComponent={<View style={st.rules}><Icon name="info" color={brand.purple} size={16} /><AppText variant="tiny" style={{ flex: 1, lineHeight: 18 }} color={brand.purple}>{t('التعليقات تنراجع قبل النشر. السب والإساءة والإعلانات والكلام السياسي ما ينشر.')}</AppText></View>}
        ListEmptyComponent={list === null ? <ActivityIndicator color={brand.purple} style={{ marginTop: 40 }} /> : <AppText muted center style={{ marginTop: 40 }}>{t('ما فيه تعليقات للحين. كن أول واحد يعلّق.')}</AppText>}
        renderItem={({ item: c }) => (
          <View style={[st.item, c.status === 'pending' && { opacity: 0.7 }]}>
            <Avatar t={c.author.name.slice(0, 1)} c={tint(c.author.name)} size={34} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppText style={{ fontFamily: font.bold, fontSize: 13.5, flex: 1 }} numberOfLines={1}>{c.author.name}{c.author.city ? ` · ${c.author.city}` : ''}</AppText>
                <AppText variant="tiny" muted>{c.status === 'pending' ? t('قيد المراجعة') : ago(c.created)}</AppText>
              </View>
              <AppText style={{ fontSize: 14.5, lineHeight: 23 }}>{c.text}</AppText>
              {!c.mine && c.status === 'visible' ? <Pressable onPress={() => report(c)} hitSlop={8} style={{ alignSelf: 'flex-start' }}><AppText variant="tiny" muted>{t('بلّغ')}</AppText></Pressable> : null}
            </View>
          </View>
        )}
      />
      {note ? <AppText variant="small" center color={note.ok ? brand.green : brand.pinkDeep} style={{ paddingHorizontal: 16, paddingBottom: 6 }}>{note.text}</AppText> : null}
      <View style={[st.compose, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {user ? (
          <>
            <TextInput value={text} onChangeText={setText} placeholder={t('اكتب تعليقك…')} placeholderTextColor={brand.faint} style={st.input} multiline maxLength={600} />
            <Pressable style={[st.send, (text.trim().length < 2 || busy) && { opacity: 0.5 }]} onPress={send} disabled={busy || text.trim().length < 2} accessibilityLabel={t('أرسل')}>
              {busy ? <ActivityIndicator color="#fff" /> : <Icon name="up" color="#fff" size={20} />}
            </Pressable>
          </>
        ) : (
          <Pressable style={[st.send, { flex: 1, width: undefined }]} onPress={() => router.push('/login')}><AppText color="#fff" style={{ fontFamily: font.bold }}>{t('سجّل دخولك عشان تعلّق')}</AppText></Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  rules: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: brand.lilac + '22', borderRadius: 14, padding: 10, marginBottom: 4 },
  item: { flexDirection: 'row', gap: 10, backgroundColor: brand.card, borderRadius: 18, padding: 12 },
  compose: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: brand.line, backgroundColor: brand.bg },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: brand.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, fontFamily: font.regular, fontSize: 14.5, color: brand.text, textAlign: INPUT_START },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: brand.purple, alignItems: 'center', justifyContent: 'center' },
});
