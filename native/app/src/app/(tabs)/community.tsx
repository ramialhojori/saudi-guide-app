import { useState } from 'react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Avatar, Chip, Pill } from '@/components/ui';
import { challenge, champions, me, posts, type Post } from '@/lib/mock';
import { brand, font, photos } from '@/theme/tokens';

const CITIES = ['كل المدن', 'المدينة', 'الرياض', 'جدة', 'العلا', 'أبها'];

/** المجتمع — محتوى تجريبي لين يجهز سيرفر المجتمع (المرحلة 2) */
export default function Community() {
  const insets = useSafeAreaInsets();
  const [city, setCity] = useState(0);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 130 }}>
      <View style={[st.head, { paddingTop: insets.top + 14 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <AppText variant="title" color="#fff" style={{ fontSize: 26, lineHeight: 36 }}>مجتمع الدليل</AppText>
            <AppText variant="small" color="#E2DAEE">اسأل أهل الديرة، وشارك اللي تعرفه</AppText>
          </View>
          <Pressable style={st.glass} onPress={() => router.push('/inbox')} accessibilityLabel="الإشعارات"><Icon name="bell" color="#fff" /></Pressable>
        </View>
        <Pressable style={st.ask} onPress={() => router.push('/ask')}>
          <Avatar t={me.initial} c={brand.lilac} size={36} />
          <AppText muted style={{ flex: 1 }}>وش تبي تعرف عن السعودية؟</AppText>
          <View style={st.camBtn}><Icon name="cam" color={brand.pinkDeep} size={18} /></View>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16 }}>
        {CITIES.map((c, i) => <Chip key={c} label={c} on={i === city} color={brand.ink} onPress={() => setCity(i)} />)}
      </ScrollView>

      {/* تحدي الأسبوع */}
      <Pressable style={st.challenge}>
        <View style={{ flex: 1, padding: 16, gap: 4 }}>
          <View style={st.chTag}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{challenge.tag}</AppText></View>
          <AppText style={{ fontFamily: font.bold, fontSize: 18, lineHeight: 28 }} color="#fff">{challenge.title}</AppText>
          <AppText variant="small" color="#FFF1E4">{challenge.prize}</AppText>
          <AppText variant="tiny" color="#FFE2C8">{challenge.left}</AppText>
        </View>
        <Image source={photos[challenge.photo]} style={{ width: 130 }} contentFit="cover" />
      </Pressable>

      <View style={{ gap: 14, paddingHorizontal: 16, paddingTop: 16 }}>
        {posts.map((p) => <PostCard key={p.id} p={p} />)}
      </View>

      {/* أبطال المدينة */}
      <View style={st.champs}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText style={{ fontFamily: font.bold, fontSize: 17 }} color="#fff">أبطال المدينة هالشهر</AppText>
          <AppText variant="small" color="#F9A158">أكتوبر</AppText>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', marginTop: 16 }}>
          {champions.map((c) => (
            <View key={c.n} style={{ alignItems: 'center', gap: 6 }}>
              <View style={c.rank === 1 ? st.ring1 : null}><Avatar t={c.av} c={c.c} size={c.rank === 1 ? 64 : 50} /></View>
              <AppText style={{ fontFamily: font.bold }} color="#fff">{c.n}</AppText>
              <AppText variant="tiny" color={c.rank === 1 ? '#F9A158' : '#CFC6DE'}>{c.rank} · {c.s}</AppText>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function PostCard({ p }: { p: Post }) {
  return (
    <Pressable style={st.post} onPress={() => router.push(`/question/${p.id}`)}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, paddingBottom: 8 }}>
        <Avatar t={p.av} c={p.c} size={40} />
        <View style={{ flex: 1 }}>
          <AppText style={{ fontFamily: font.bold, fontSize: 14.5 }}>{p.who} <AppText variant="small" muted>· {p.where}</AppText></AppText>
          <AppText variant="tiny" color={brand.skyDeep}>{p.kind === 'question' ? 'سؤال عن المدينة المنورة' : p.when}</AppText>
        </View>
        {p.badge ? <Pill label={p.badge} bg={brand.softPink} fg={brand.pinkDeep} /> : null}
      </View>
      {p.photo ? <Image source={photos[p.photo]} style={{ height: 220 }} contentFit="cover" /> : null}
      <AppText style={{ fontFamily: p.kind === 'question' ? font.bold : font.regular, fontSize: p.kind === 'question' ? 16.5 : 14.5, lineHeight: 28, paddingHorizontal: 14, paddingTop: 10 }}>{p.text}</AppText>
      {p.best ? (
        <View style={st.best}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <AppText style={{ fontFamily: font.bold, fontSize: 13.5 }}>{p.best.who}</AppText>
            <Pill label={p.best.badge} bg={brand.purple} fg="#fff" />
            <AppText variant="tiny" color={brand.green} style={{ fontFamily: font.bold }}>· أفضل إجابة</AppText>
          </View>
          <AppText variant="small" style={{ lineHeight: 22, marginTop: 4 }}>{p.best.text}</AppText>
        </View>
      ) : null}
      <View style={st.actions}>
        {p.thanks ? <AppText variant="small" color={brand.pinkDeep} style={{ fontFamily: font.bold }}>شكراً · {p.thanks}</AppText> : null}
        {p.answers ? <AppText variant="small" muted>{p.answers} إجابات</AppText> : null}
        <AppText variant="small" muted>حفظ</AppText>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: brand.purple, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  glass: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  ask: { marginTop: 16, height: 60, backgroundColor: '#fff', borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  camBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: brand.softPink, alignItems: 'center', justifyContent: 'center' },
  challenge: { marginHorizontal: 16, height: 150, borderRadius: 24, overflow: 'hidden', backgroundColor: brand.orange, flexDirection: 'row' },
  chTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  post: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden' },
  best: { margin: 14, marginTop: 10, backgroundColor: brand.bg, borderRadius: 16, padding: 12, borderRightWidth: 3, borderRightColor: brand.purple },
  actions: { flexDirection: 'row', gap: 18, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  champs: { margin: 16, marginTop: 18, backgroundColor: brand.ink, borderRadius: 26, padding: 18 },
  ring1: { borderWidth: 3, borderColor: brand.orange, borderRadius: 40, padding: 2 },
});

