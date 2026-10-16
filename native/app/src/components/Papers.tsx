import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { NativeAdCard } from './Ads';
import { Icon } from './Icon';
import { getPapers, getPapersFeed, openPaperItem, toggleFollow, useFollows, type Paper, type PaperItem } from '@/lib/papers';
import { isEn, t } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';

/** «قبل 5 دقايق» */
export function ago(at: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - at);
  if (s < 60) return t('الحين');
  if (s < 3600) return t('قبل {n} د', { n: Math.floor(s / 60) });
  if (s < 86400) return t('قبل {n} س', { n: Math.floor(s / 3600) });
  const d = Math.floor(s / 86400);
  return d === 1 ? t('أمس') : t('قبل {n} أيام', { n: d });
}

/** قائمة أخبار الصحف. mine = الصحف اللي يتابعها بس */
export function PapersFeed({ mine, onBrowse }: { mine?: boolean; onBrowse?: () => void }) {
  const insets = useSafeAreaInsets();
  const follows = useFollows();
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [only, setOnly] = useState<string | null>(null);
  const [items, setItems] = useState<PaperItem[] | null>(null);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [manage, setManage] = useState(false);

  useEffect(() => { getPapers().then(setPapers).catch(() => setPapers([])); }, []);
  const sources = only ? [only] : mine ? follows : [];
  const key = sources.join(',');

  const load = useCallback(async (before?: number) => {
    if (mine && !sources.length) { setItems([]); setMore(false); return; }
    setBusy(true);
    try {
      const r = await getPapersFeed({ sources, before });
      setItems((l) => (before ? [...(l || []), ...r.items.filter((x) => !(l || []).some((y) => y.id === x.id))] : r.items));
      setMore(r.more);
    } catch { setItems((l) => l || []); } finally { setBusy(false); setRefreshing(false); }
  }, [key, mine]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setItems(null); load(); }, [load]);

  const shown = items || [];
  const strip = (papers || []).filter((p) => !mine || follows.includes(p.id));

  const header = (
    <View style={{ gap: 10, paddingBottom: 4 }}>
      {strip.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          <Pressable style={[st.src, !only && st.srcOn]} onPress={() => setOnly(null)}>
            <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={!only ? '#fff' : brand.text}>{t('الكل')}</AppText>
          </Pressable>
          {strip.map((p) => (
            <Pressable key={p.id} style={[st.src, only === p.id && st.srcOn]} onPress={() => setOnly(only === p.id ? null : p.id)}>
              {p.logo ? <Image source={p.logo} style={st.srcLogo} contentFit="cover" /> : null}
              <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={only === p.id ? '#fff' : brand.text}>{p.name}</AppText>
            </Pressable>
          ))}
          <Pressable style={[st.src, { backgroundColor: brand.chip }]} onPress={() => setManage(true)} accessibilityLabel={t('تابع الصحف')}>
            <Icon name="plus" size={16} color={brand.purple} />
            <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={brand.purple}>{mine ? t('عدّل') : t('تابع')}</AppText>
          </Pressable>
        </ScrollView>
      ) : null}
      {mine && !follows.length ? (
        <View style={st.empty}>
          <View style={st.emptyIcon}><Icon name="news" color="#fff" size={26} /></View>
          <AppText style={{ fontFamily: font.bold, fontSize: 17 }} center>{t('اختر صحفك')}</AppText>
          <AppText muted center>{t('تابع الصحف اللي تحبها، وتطلع لك أخبارها هنا ويوصلك إشعار بالجديد.')}</AppText>
          <PaperPicker papers={papers} />
        </View>
      ) : null}
      {items === null && !(mine && !follows.length) ? <ActivityIndicator color={brand.purple} style={{ marginTop: 30 }} /> : null}
      {items && !shown.length && !(mine && !follows.length) ? <AppText center muted style={{ marginTop: 30 }}>{t('ما فيه أخبار للحين.')}</AppText> : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={shown}
        keyExtractor={(x) => String(x.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: insets.bottom + 30, gap: 10 }}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (more && !busy && shown.length) load(shown[shown.length - 1].at); }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={brand.purple} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item, index }) => (
          <>
            {index > 0 && index % 8 === 0 ? <NativeAdCard style={{ marginHorizontal: 16, marginBottom: 10 }} /> : null}
            <PaperRow it={item} />
          </>
        )}
        ListFooterComponent={busy && shown.length ? <ActivityIndicator color={brand.purple} style={{ marginTop: 10 }} /> : null}
      />
      <Modal visible={manage} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setManage(false)}>
        <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 6 }}>
            <AppText variant="title" style={{ flex: 1, fontSize: 21 }}>{t('تابع الصحف')}</AppText>
            <Pressable onPress={() => setManage(false)} hitSlop={10} style={st.done}><AppText style={{ fontFamily: font.bold }} color="#fff">{t('تم')}</AppText></Pressable>
          </View>
          <AppText muted style={{ paddingHorizontal: 16, marginBottom: 8 }}>{t('أخبار الصحف اللي تتابعها تطلع في «أخباري»، ويوصلك إشعار واحد يجمع الجديد كم مرة باليوم.')}</AppText>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}><PaperPicker papers={papers} /></ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/** خبر من صحيفة: صورة، الصحيفة والوقت، العنوان، سطرين — والضغط يفتح الخبر في موقعها */
function PaperRow({ it }: { it: PaperItem }) {
  return (
    <Pressable style={st.row} onPress={() => openPaperItem(it)} accessibilityRole="link" accessibilityHint={t('يفتح الخبر في موقع {name}', { name: it.sourceName })}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {it.logo ? <Image source={it.logo} style={st.logo} contentFit="cover" /> : null}
            <AppText variant="tiny" style={{ fontFamily: font.bold }} color={brand.pinkDeep}>{it.sourceName}</AppText>
            <AppText variant="tiny" muted>· {ago(it.at)}</AppText>
          </View>
          <AppText style={{ fontFamily: font.bold, fontSize: 15, lineHeight: 23, writingDirection: /[a-z]/i.test(it.title.slice(0, 8)) && !isEn ? 'ltr' : undefined }} numberOfLines={3}>{it.title}</AppText>
          {it.snippet ? <AppText variant="small" muted numberOfLines={2}>{it.snippet}</AppText> : null}
        </View>
        {it.image ? <Image source={it.image} style={st.img} contentFit="cover" transition={150} /> : null}
      </View>
      <View style={st.readRow}>
        <AppText variant="tiny" color={brand.orangeDeep} style={{ fontFamily: font.bold }}>{t('اقرأ في {name}', { name: it.sourceName })}</AppText>
        <Icon name="globe" size={13} color={brand.orangeDeep} />
      </View>
    </Pressable>
  );
}

/** قائمة الصحف مع زر «تابع» */
function PaperPicker({ papers }: { papers: Paper[] | null }) {
  const follows = useFollows();
  if (!papers) return <ActivityIndicator color={brand.purple} style={{ marginTop: 20 }} />;
  return (
    <View style={{ gap: 8, paddingHorizontal: 16, marginTop: 6, alignSelf: 'stretch' }}>
      {papers.map((p) => {
        const on = follows.includes(p.id);
        return (
          <View key={p.id} style={st.pick}>
            {p.logo ? <Image source={p.logo} style={st.pickLogo} contentFit="cover" /> : <View style={st.pickLogo} />}
            <View style={{ flex: 1 }}>
              <AppText style={{ fontFamily: font.bold, fontSize: 15 }}>{p.name}</AppText>
              <AppText variant="tiny" muted>{p.site}</AppText>
            </View>
            <Pressable style={[st.follow, on && st.following]} onPress={() => toggleFollow(p.id)} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <AppText variant="small" style={{ fontFamily: font.bold }} color={on ? brand.orangeInk : '#fff'}>{on ? t('متابَع ✓') : t('تابع')}</AppText>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  src: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: brand.card },
  srcOn: { backgroundColor: brand.orange },
  srcLogo: { width: 20, height: 20, borderRadius: 6, backgroundColor: brand.chip },
  row: { marginHorizontal: 16, backgroundColor: brand.card, borderRadius: 18, padding: 12, gap: 8, borderStartWidth: 4, borderStartColor: brand.pink },
  img: { width: 96, height: 86, borderRadius: 12, backgroundColor: brand.chip },
  logo: { width: 16, height: 16, borderRadius: 4, backgroundColor: brand.chip },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { marginHorizontal: 16, marginTop: 10, backgroundColor: brand.card, borderRadius: 20, paddingVertical: 18, gap: 6, alignItems: 'center' },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: brand.pink, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderRadius: 16, padding: 10 },
  pickLogo: { width: 42, height: 42, borderRadius: 12, backgroundColor: brand.chip },
  follow: { height: 34, paddingHorizontal: 18, borderRadius: 17, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  following: { backgroundColor: brand.softOrange },
  done: { backgroundColor: brand.purple, borderRadius: 14, paddingHorizontal: 16, height: 34, justifyContent: 'center' },
});
