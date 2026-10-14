import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Input } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { BackButton } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { uploadPhoto } from '@/lib/community';
import { cityName, getPlace } from '@/lib/content';
import { couponErr } from '@/lib/coupons';
import { useFeatures } from '@/lib/features';
import { placeReviews, postReview, REVIEW_TAGS, STAR_WORD } from '@/lib/reviews';
import type { Place } from '@/lib/types';
import { brand, font, kindStyle } from '@/theme/tokens';

type Ph = { uri: string; url?: string };

/** «قيّم تجربتك» — نجوم ووسوم ونص وصور (الصور تنراجع قبل النشر) */
export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [p, setP] = useState<Place | null>(null);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<Ph[]>([]);
  const [consent, setConsent] = useState(true);
  const [isEdit, setIsEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const F = useFeatures();

  useEffect(() => {
    getPlace(Number(id)).then(setP).catch(() => {});
    if (user) placeReviews(Number(id)).then((r) => { if (r.mine) { setIsEdit(true); setStars(r.mine.stars); setTags(r.mine.tags); setText(r.mine.text); } }).catch(() => {});
  }, [id, user?.id]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        <BackButton />
        <View style={st.gate}>
          <Icon name="star" color={brand.orange} size={34} />
          <AppText style={{ fontFamily: font.bold, fontSize: 18 }} center>سجّل عشان تقيّم</AppText>
          <AppText variant="small" muted center>تقييمك يطلع باسمك ويساعد اللي بعدك.</AppText>
          <Pressable style={st.loginBtn} onPress={() => router.replace('/login')}><AppText color="#fff" style={{ fontFamily: font.bold }}>سجّل دخولك</AppText></Pressable>
        </View>
      </View>
    );
  }

  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setErr(camera ? 'نحتاج إذن الكاميرا من الإعدادات.' : 'نحتاج إذن الصور من الإعدادات.');
    const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: true, selectionLimit: 6 - photos.length });
    if (!r.canceled) setPhotos((x) => [...x, ...r.assets.map((a) => ({ uri: a.uri }))].slice(0, 6));
  };
  const toggleTag = (t: string) => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t].slice(0, 6)));
  const pts = (isEdit ? 0 : 3) + photos.length * 5;

  const submit = async () => {
    if (!stars) return setErr('اختر عدد النجوم.');
    if (photos.length && !consent) return setErr('وافق على نشر الصور أول.');
    setBusy(true); setErr('');
    try {
      const urls: string[] = [];
      for (const ph of photos) urls.push(ph.url ?? (await uploadPhoto(ph.uri)));
      const r = await postReview(Number(id), { stars, tags, text: text.trim(), photos: urls, consent });
      const msg = [r.points ? `+${r.points} نقاط` : '', r.photosPending ? 'الصور تنراجع وتنزل خلال يوم، ولك 5 نقاط على كل صورة تنقبل.' : ''].filter(Boolean).join('\n');
      Alert.alert(isEdit ? 'انحفظ تقييمك' : 'شكراً على تقييمك!', msg || undefined, [{ text: 'تمام', onPress: () => router.back() }]);
      if (Platform.OS === 'web') router.back();
    } catch (e) { setErr(couponErr(e)); } finally { setBusy(false); }
  };

  const ks = p ? kindStyle[p.kinds[0]] ?? kindStyle.sights : kindStyle.sights;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <View style={st.top}><BackButton /><AppText variant="title" style={{ flex: 1 }}>{isEdit ? 'عدّل تقييمك' : 'قيّم تجربتك'}</AppText></View>
        {p ? (
          <View style={st.place}>
            {p.thumb || p.image ? <Image source={p.thumb || p.image} style={st.thumb} contentFit="cover" /> : <View style={[st.thumb, { backgroundColor: ks.bg }]} />}
            <View style={{ flex: 1 }}>
              <AppText variant="tiny" color={ks.fg} style={{ fontFamily: font.semibold }}>{p.cat} · {cityName(p.city)}</AppText>
              <AppText style={{ fontFamily: font.bold, fontSize: 16 }} numberOfLines={1}>{p.title}</AppText>
            </View>
          </View>
        ) : null}

        <View style={{ alignItems: 'center', marginTop: 22 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => { setStars(n); setErr(''); }} hitSlop={4} accessibilityLabel={`${n} نجوم`}>
                <Icon name="star" size={42} color={brand.orange} fill={n <= stars ? brand.orange : 'none'} strokeWidth={1.5} />
              </Pressable>
            ))}
          </View>
          <AppText style={{ fontFamily: font.bold, fontSize: 15, marginTop: 6 }} color={brand.orangeDeep}>{STAR_WORD[stars] || 'اضغط على النجوم'}</AppText>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <AppText style={{ fontFamily: font.semibold, fontSize: 14, marginBottom: 8 }}>وش عجبك؟ أو ما عجبك؟</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {REVIEW_TAGS.map((t) => {
              const on = tags.includes(t);
              const neg = ['زحمة', 'مواقف صعبة', 'غالي'].includes(t);
              return (
                <Pressable key={t} onPress={() => toggleTag(t)} style={[st.tag, on && { backgroundColor: neg ? brand.pinkDeep : brand.green }]}>
                  <AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={on ? '#fff' : brand.text}>{t}</AppText>
                </Pressable>
              );
            })}
          </View>

          <AppText style={{ fontFamily: font.semibold, fontSize: 14, marginTop: 18, marginBottom: 8 }}>اكتب تجربتك <AppText variant="tiny" muted>(اختياري)</AppText></AppText>
          <Input value={text} onChangeText={setText} multiline maxLength={1200} placeholder="متى رحت؟ وش أكثر شي عجبك؟ نصيحة للي بعدك؟" style={{ minHeight: 110 }} />

          {F.photos ? <AppText style={{ fontFamily: font.semibold, fontSize: 14, marginTop: 18, marginBottom: 8 }}>صورك</AppText> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {photos.map((ph, i) => (
              <View key={ph.uri + i}>
                <Image source={ph.uri} style={st.ph} contentFit="cover" />
                <Pressable style={st.phX} onPress={() => setPhotos(photos.filter((_, k) => k !== i))} accessibilityLabel="شيل الصورة"><Icon name="x" color="#fff" size={14} /></Pressable>
              </View>
            ))}
            {F.photos && photos.length < 6 && Platform.OS !== 'web' ? (
              <>
                <Pressable style={st.add} onPress={() => pick(true)} accessibilityLabel="صوّر"><Icon name="cam" color={brand.link} size={24} /></Pressable>
                <Pressable style={st.add} onPress={() => pick(false)} accessibilityLabel="من الصور"><Icon name="plus" color={brand.link} size={24} /></Pressable>
              </>
            ) : null}
          </View>
          {photos.length ? (
            <Pressable style={st.consent} onPress={() => setConsent(!consent)}>
              <View style={[st.box, consent && { backgroundColor: brand.purple, borderColor: brand.purple }]}>{consent ? <Icon name="check" color="#fff" size={14} strokeWidth={3} /> : null}</View>
              <AppText variant="small" style={{ flex: 1, lineHeight: 21 }}>أوافق إن صوري تنشر في دليل السعودية مع اسمي، وأنا اللي صوّرتها.</AppText>
            </Pressable>
          ) : null}
          {pts ? <View style={st.points}><AppText variant="small" color={brand.orangeInk} style={{ fontFamily: font.semibold }}>بتحصل +{pts} نقطة{photos.length ? ': 3 للتقييم و5 لكل صورة تنقبل' : ''}</AppText></View> : null}
          {err ? <AppText center color={brand.pinkDeep} style={{ marginTop: 12, fontFamily: font.semibold }}>{err}</AppText> : null}
        </View>
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable style={[st.cta, !stars && { opacity: 0.5 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color="#fff">{isEdit ? 'احفظ التعديل' : 'انشر التقييم'}</AppText>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  place: { marginHorizontal: 16, marginTop: 14, backgroundColor: brand.card, borderRadius: 20, padding: 10, flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 60, height: 60, borderRadius: 14 },
  tag: { height: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: brand.card, justifyContent: 'center' },
  ph: { width: 80, height: 80, borderRadius: 14 },
  phX: { position: 'absolute', top: 4, left: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  add: { width: 80, height: 80, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: brand.faint, alignItems: 'center', justifyContent: 'center' },
  consent: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 14 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: brand.faint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  points: { marginTop: 14, backgroundColor: brand.softOrange, borderRadius: 16, padding: 12 },
  gate: { marginTop: 60, backgroundColor: brand.card, borderRadius: 24, padding: 24, alignItems: 'center', gap: 8 },
  loginBtn: { marginTop: 10, backgroundColor: brand.purple, borderRadius: 16, paddingHorizontal: 24, height: 48, justifyContent: 'center' },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 0, paddingTop: 10 },
  cta: { height: 56, borderRadius: 18, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
});
