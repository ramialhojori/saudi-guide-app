import { useEffect } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { RichText } from '@/components/RichText';
import { Screen } from '@/components/Screen';
import { Empty, Loading } from '@/components/State';
import { getArticle } from '@/lib/content';
import { riyadhDate } from '@/lib/text';
import { useAsync } from '@/lib/useAsync';
import { colors, radius, space } from '@/theme/tokens';
import { track } from '@/lib/track';
import { t } from '@/lib/i18n';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => { if (id) track('article', Number(id)); }, [id]);
  const { data: a, loading } = useAsync(() => getArticle(Number(id)), [id]);
  if (loading && !a) return <Screen showBack><Loading /></Screen>;
  if (!a) return <Screen showBack><Empty /></Screen>;
  return (
    <Screen showBack title={a.section || t('الأخبار')} pad={false} pullClose>
      <Image source={a.images?.[0] || a.thumb} style={styles.img} contentFit="cover" />
      <View style={styles.body}>
        <AppText variant="small" muted>{riyadhDate(a.date, false)} · {a.author}</AppText>
        <AppText variant="title">{a.title}</AppText>
        <View style={styles.card}>{a.body ? <RichText html={a.body} /> : <AppText>{a.summary}</AppText>}</View>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  img: { width: '100%', height: 240, backgroundColor: '#E8E3EE' },
  body: { padding: space.lg, gap: space.md, paddingBottom: 12 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg },
});
