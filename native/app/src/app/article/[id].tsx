import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Animated, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { usePullUpClose } from '@/components/PullUpClose';
import { RichText } from '@/components/RichText';
import { Empty, Loading } from '@/components/State';
import { env } from '@/config/env';
import { getComments, useFontScale } from '@/lib/comments';
import { getArticle } from '@/lib/content';
import { useFeatures } from '@/lib/features';
import { t } from '@/lib/i18n';
import { riyadhDate } from '@/lib/text';
import { track } from '@/lib/track';
import { useAsync } from '@/lib/useAsync';
import { brand, font } from '@/theme/tokens';

/**
 * صفحة الخبر: الصورة من أعلى الشاشة بدون شريط فوقها (بس زر إغلاق صغير شفاف)،
 * وتحت شريط ثابت: تصغير/تكبير الخط، التعليقات، المشاركة
 */
export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pull = usePullUpClose({ kind: 'article', id: Number(id) });
  const insets = useSafeAreaInsets();
  const F = useFeatures();
  const [scale, step] = useFontScale();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => { if (id) track('article', Number(id)); }, [id]);
  const { data: a, loading } = useAsync(() => getArticle(Number(id)), [id]);
  useFocusEffect(useCallback(() => { if (F.comments !== false) getComments(Number(id)).then((r) => setCount(r.count)).catch(() => {}); }, [id, F.comments]));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/news'));
  if (loading && !a) return <View style={st.root}><Loading /></View>;
  if (!a) return <View style={[st.root, { paddingTop: insets.top + 60 }]}><Empty /></View>;

  const share = () => { track('share_article', a.id); Share.share({ message: `${a.title}\n${env.siteUrl}/article/${a.id}`, url: `${env.siteUrl}/article/${a.id}` }).catch(() => {}); };
  const img = a.images?.[0] || a.thumb;

  return (
    <Animated.View style={[st.root, pull.style]}>
      <ScrollView {...pull.scroll} contentContainerStyle={{ paddingBottom: 90 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {img ? <Image source={img} style={[st.img, { height: 300 + insets.top }]} contentFit="cover" transition={200} /> : <View style={{ height: insets.top + 64 }} />}
        <View style={st.body}>
          {a.section ? <AppText variant="tiny" color={brand.pinkDeep} style={{ fontFamily: font.bold }}>{a.section}</AppText> : null}
          <AppText style={{ fontFamily: font.bold, fontSize: 22 * scale, lineHeight: 34 * scale }}>{a.title}</AppText>
          <AppText variant="small" muted>{riyadhDate(a.date, false)}{a.author ? ` · ${a.author}` : ''}</AppText>
          <View style={st.card}>
            {a.body ? <RichText html={a.body} scale={scale} /> : <AppText style={{ fontSize: 15 * scale, lineHeight: 26 * scale }}>{a.summary}</AppText>}
          </View>
        </View>
        {pull.footer}
      </ScrollView>

      {/* زر الإغلاق الوحيد فوق الصورة */}
      <Pressable style={[st.close, { top: insets.top + 10 }]} onPress={back} accessibilityLabel={t('رجوع')} hitSlop={8}>
        <Icon name="chevronDown" color="#fff" size={22} strokeWidth={2.4} />
      </Pressable>

      {/* الشريط السفلي */}
      <View style={[st.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={st.fontBox}>
          <Pressable style={st.fontBtn} onPress={() => step(-1)} accessibilityLabel={t('تصغير الخط')} hitSlop={6}><AppText style={{ fontFamily: font.bold, fontSize: 13 }}>A-</AppText></Pressable>
          <View style={st.sep} />
          <Pressable style={st.fontBtn} onPress={() => step(1)} accessibilityLabel={t('تكبير الخط')} hitSlop={6}><AppText style={{ fontFamily: font.bold, fontSize: 17 }}>A+</AppText></Pressable>
        </View>
        {F.comments !== false ? (
          <Pressable style={st.barBtn} onPress={() => router.push(`/article/comments/${a.id}` as never)}>
            <Icon name="chat" color={brand.purple} size={20} />
            <AppText variant="small" style={{ fontFamily: font.semibold }}>{count ? t('{n} تعليق', { n: count }) : t('علّق')}</AppText>
          </Pressable>
        ) : null}
        <Pressable style={st.barBtn} onPress={share}>
          <Icon name="share" color={brand.purple} size={20} />
          <AppText variant="small" style={{ fontFamily: font.semibold }}>{t('شارك')}</AppText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.bg },
  img: { width: '100%', backgroundColor: '#E8E3EE' },
  body: { padding: 18, gap: 10 },
  card: { backgroundColor: brand.card, borderRadius: 20, padding: 16, marginTop: 4 },
  close: { position: 'absolute', start: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(20,16,36,0.35)', alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, backgroundColor: brand.bg, borderTopWidth: 1, borderTopColor: brand.line },
  fontBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: brand.card, borderRadius: 14, height: 44 },
  fontBtn: { width: 46, height: 44, alignItems: 'center', justifyContent: 'center' },
  sep: { width: 1, height: 22, backgroundColor: brand.line },
  barBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: brand.card, borderRadius: 14, height: 44 },
});
