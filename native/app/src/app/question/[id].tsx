import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Avatar, BackButton, Pill } from '@/components/ui';
import { brand, font, START } from '@/theme/tokens';

const ANSWERS = [
  { av: 'ر', c: brand.lilac, n: 'رامي', badge: 'مرشد موثّق', best: true, t: 'جرّبوا فطور قباء الشعبي بعد صلاة الفجر، الفول والتميس عندهم ممتاز. وبعدها امشوا لمسجد قباء، قريب.', useful: 42, mention: 'فطور قباء الشعبي' },
  { av: 'م', c: brand.sky, n: 'منيرة', t: 'لو تبون جلسة عائلية هادية، «بيت الحجاز» عندهم قسم عائلات وكوبون خصم في الدليل هالأسبوع.', useful: 18 },
  { av: 'خ', c: brand.pink, n: 'خالد', t: 'الفنادق القريبة من باب السلام عندها بوفيه فطور مفتوح للزوار، بس سعره أعلى.', useful: 6 },
];

/** سؤال في المجتمع — تجريبي لين يجهز سيرفر المجتمع */
export default function Question() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
          <BackButton />
          <View><AppText variant="title">سؤال</AppText><AppText variant="small" muted>المدينة المنورة · 7 إجابات</AppText></View>
        </View>
        <View style={st.q}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Avatar t="ن" c={brand.sky} size={40} />
            <View><AppText style={{ fontFamily: font.bold }}>نورة</AppText><AppText variant="tiny" muted>زائرة من الكويت · قبل 3 ساعات</AppText></View>
          </View>
          <AppText style={{ fontFamily: font.bold, fontSize: 18, lineHeight: 30, marginTop: 10 }}>أول مرة أزور المدينة مع عائلتي، وش أحسن مكان نفطر فيه قريب من الحرم؟</AppText>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}><Pill label="مطاعم" bg={brand.softOrange} fg={brand.orangeDeep} /><Pill label="مع العائلة" bg={brand.softPurple} fg={brand.purple} /></View>
        </View>
        <View style={{ gap: 12, paddingHorizontal: 16, marginTop: 12 }}>
          {ANSWERS.map((a) => (
            <View key={a.n} style={[st.a, a.best && { borderWidth: 2, borderColor: brand.green }]}>
              {a.best ? <AppText variant="tiny" color={brand.green} style={{ fontFamily: font.bold, marginBottom: 6 }}>✓ أفضل إجابة</AppText> : null}
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Avatar t={a.av} c={a.c} size={36} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><AppText style={{ fontFamily: font.bold, fontSize: 14 }}>{a.n}</AppText>{a.badge ? <Pill label={a.badge} bg={brand.purple} fg="#fff" /> : null}</View>
                  <AppText variant="tiny" muted>من المدينة المنورة · قبل ساعتين</AppText>
                </View>
              </View>
              <AppText style={{ marginTop: 8, lineHeight: 26 }}>{a.t}</AppText>
              {a.mention ? (
                <View style={st.mention}>
                  <View style={{ flex: 1 }}><AppText variant="tiny" muted>مذكور في الإجابة</AppText><AppText style={{ fontFamily: font.bold, fontSize: 14 }}>{a.mention}</AppText></View>
                  <Pressable style={st.addTrip} onPress={() => router.push({ pathname: '/search', params: { q: 'فطور' } })}><AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>+ رحلتي</AppText></Pressable>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 18, marginTop: 10 }}>
                <AppText variant="small" color={brand.pinkDeep} style={{ fontFamily: font.bold }}>مفيد · {a.useful}</AppText>
                <AppText variant="small" muted>رد</AppText>
                <AppText variant="small" muted>إبلاغ</AppText>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[st.reply, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Avatar t="ر" c={brand.lilac} size={36} />
        <TextInput value={text} onChangeText={setText} placeholder="اكتب إجابتك..." placeholderTextColor={brand.faint} style={st.input} />
        <Pressable onPress={() => { setText(''); router.push('/login'); }} style={st.send}><AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>إرسال</AppText></Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  q: { margin: 16, marginBottom: 0, backgroundColor: '#fff', borderRadius: 24, padding: 16 },
  a: { backgroundColor: '#fff', borderRadius: 22, padding: 14 },
  mention: { marginTop: 10, backgroundColor: brand.bg, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  addTrip: { backgroundColor: brand.orange, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  reply: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: brand.line },
  input: { flex: 1, minWidth: 0, height: 44, backgroundColor: brand.bg, borderRadius: 14, paddingHorizontal: 12, fontFamily: font.regular, fontSize: 14.5, color: brand.ink, textAlign: START },
  send: { backgroundColor: brand.purple, borderRadius: 12, paddingHorizontal: 14, height: 40, justifyContent: 'center' },
});
