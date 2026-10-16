import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BackButton, Chip } from '@/components/ui';
import { getArticlesPage } from '@/lib/content';
import { riyadhDate } from '@/lib/text';
import type { Article } from '@/lib/types';
import { brand, font } from '@/theme/tokens';
import { t } from '@/lib/i18n';

/** كل الأخبار: تصنيفات (أخبار المشاريع، سياحة وفعاليات، رؤية 2030...) وتحميل المزيد لما ينزل لتحت */
/** نفس تصنيفات الأخبار في دليل السعودية القديم (قودبابر) */
const NEWS_CATS = ['أخبار المشاريع', 'سياحة وفعاليات', 'مشاريع رؤية السعودية 2030'];
const catOf = (a: Article) => (a.cats || []).find((c) => NEWS_CATS.includes(c)) || '';

export default function News() {
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<Article[] | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sec, setSec] = useState<string | null>(null);

  const load = async (pg: number, cat: string | null = sec) => {
    if (busy && pg > 1) return;
    setBusy(true);
    try {
      const r = await getArticlesPage(pg, cat);
      setList((l) => (pg === 1 ? r : [...(l || []), ...r.filter((x) => !(l || []).some((y) => y.id === x.id))]));
      setMore(r.length >= 20); setPage(pg);
    } catch { setList((l) => l || []); } finally { setBusy(false); }
  };
  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = list || [];
  const [top, ...rest] = shown;

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <FlatList
        data={rest}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ paddingBottom: insets.bottom + 30, gap: 10 }}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (more && !busy && list) load(page + 1); }}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 10, gap: 12 }}>
            <View style={st.head}>
              <BackButton />
              <AppText variant="title" style={{ fontSize: 24 }}>{t('الأخبار')}</AppText>
            </View>
            <FlatList horizontal data={[null, ...NEWS_CATS]} keyExtractor={(x) => x || 'all'} showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
              renderItem={({ item }) => <Chip label={item ? t(item) : t('الكل')} on={sec === item} color={brand.ink} onPress={() => { setSec(item); setList(null); load(1, item); }} />} />
            {list === null ? <ActivityIndicator color={brand.purple} style={{ marginTop: 40 }} /> : null}
            {list && !shown.length ? <AppText center muted style={{ marginTop: 30 }}>{t('ما فيه أخبار هنا للحين.')}</AppText> : null}
            {top ? (
              <Pressable style={st.hero} onPress={() => router.push(`/article/${top.id}`)}>
                <Image source={top.thumb} style={st.heroImg} contentFit="cover" />
                <View style={{ padding: 14, gap: 6 }}>
                  {catOf(top) ? <AppText variant="tiny" color={brand.pinkDeep} style={{ fontFamily: font.bold }}>{t(catOf(top))}</AppText> : null}
                  <AppText style={{ fontFamily: font.bold, fontSize: 18, lineHeight: 28 }} numberOfLines={3}>{top.title}</AppText>
                  {top.summary ? <AppText variant="small" muted numberOfLines={2}>{top.summary}</AppText> : null}
                  <AppText variant="tiny" muted>{riyadhDate(top.date, false)}</AppText>
                </View>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item: a }) => (
          <Pressable style={st.row} onPress={() => router.push(`/article/${a.id}`)}>
            <Image source={a.thumb} style={st.rowImg} contentFit="cover" />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              {catOf(a) ? <AppText variant="tiny" color={brand.pinkDeep} style={{ fontFamily: font.semibold }}>{t(catOf(a))}</AppText> : null}
              <AppText style={{ fontFamily: font.bold, fontSize: 15, lineHeight: 23 }} numberOfLines={2}>{a.title}</AppText>
              <AppText variant="tiny" muted>{riyadhDate(a.date, false)}</AppText>
            </View>
          </Pressable>
        )}
        ListFooterComponent={busy && list ? <ActivityIndicator color={brand.purple} style={{ marginTop: 10 }} /> : null}
      />
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  hero: { marginHorizontal: 16, backgroundColor: brand.card, borderRadius: 22, overflow: 'hidden' },
  heroImg: { width: '100%', height: 190, backgroundColor: brand.chip },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, backgroundColor: brand.card, borderRadius: 18, padding: 10 },
  rowImg: { width: 92, height: 76, borderRadius: 12, backgroundColor: brand.chip },
});
