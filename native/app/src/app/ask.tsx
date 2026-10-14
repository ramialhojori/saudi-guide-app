import { useState } from 'react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { Avatar, BackButton, Chip } from '@/components/ui';
import { env } from '@/config/env';
import { useAuth } from '@/lib/auth';
import { createPost, errText, initial, tint, uploadPhoto } from '@/lib/community';
import { brand, font, START, INPUT_START } from '@/theme/tokens';

type Kind = 'question' | 'tip' | 'photo';
const KINDS: [Kind, string, IconName, string][] = [
  ['question', 'سؤال', 'chat', 'وش تبي تعرف؟ مثلاً: وين أحسن مكان نفطر فيه قريب من الحرم؟'],
  ['tip', 'نصيحة', 'star', 'شارك شي تعرفه: وقت زحمة، مكان مخفي، تجربة تفيد غيرك…'],
  ['photo', 'صورة', 'cam', 'اكتب كلمتين عن الصورة: وين صوّرتها ووش يميز المكان؟'],
];
const CITIES: [string, string][] = [['medina', 'المدينة'], ['riyadh', 'الرياض'], ['jeddah', 'جدة'], ['makkah-region', 'مكة'], ['alula', 'العلا'], ['abha', 'أبها'], ['taif', 'الطائف'], ['eastern-region', 'الشرقية'], ['tabuk-region', 'تبوك'], ['hail', 'حائل']];

/** النشر في المجتمع: سؤال أو نصيحة أو صورة */
export default function Ask() {
  const insets = useSafeAreaInsets();
  const prm = useLocalSearchParams<{ kind?: Kind; placeId?: string; place?: string; city?: string; text?: string }>();
  const { user } = useAuth();
  const [kind, setKind] = useState<Kind>(prm.kind && KINDS.some((k) => k[0] === prm.kind) ? prm.kind : 'question');
  const [city, setCity] = useState<string | null>(prm.city || user?.city || null);
  const [text, setText] = useState(prm.text || '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        <BackButton />
        <View style={st.gate}>
          <View style={st.gateIcon}><Icon name="chat" color={brand.purple} size={30} /></View>
          <AppText style={{ fontFamily: font.bold, fontSize: 18 }} center>سجّل عشان تسأل وتشارك</AppText>
          <AppText variant="small" muted center>عشان يعرف الناس مين يكلمهم، وتوصلك إجاباتهم.</AppText>
          <Pressable style={st.send} onPress={() => router.replace('/login')}><AppText color="#fff" style={{ fontFamily: font.bold }}>سجّل دخولك</AppText></Pressable>
        </View>
      </View>
    );
  }

  const pick = async (camera: boolean) => {
    setErr('');
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setErr(camera ? 'نحتاج إذن الكاميرا من الإعدادات.' : 'نحتاج إذن الصور من الإعدادات.'); return; }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [4, 3] };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled && r.assets[0]) { setPhoto(r.assets[0].uri); if (kind === 'question' && !text) setKind('photo'); }
  };

  const ready = text.trim().length >= 8 && (kind !== 'photo' || !!photo) && !busy;
  const submit = async () => {
    if (!ready) return;
    setBusy(true); setErr('');
    try {
      const url = photo ? await uploadPhoto(photo) : undefined;
      const r = await createPost({ kind, city, text: text.trim(), photo: url, placeId: prm.placeId ? Number(prm.placeId) : undefined });
      router.replace(`/question/${r.id}`);
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  const hint = KINDS.find((k) => k[0] === kind)![3];
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={st.top}>
          <BackButton />
          <AppText variant="title" style={{ flex: 1 }}>{kind === 'question' ? 'سؤال جديد' : kind === 'tip' ? 'نصيحة جديدة' : 'شارك صورة'}</AppText>
          <Pressable onPress={submit} disabled={!ready} style={[st.post, !ready && { opacity: 0.4 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : <AppText color="#fff" style={{ fontFamily: font.bold }}>انشر</AppText>}
          </Pressable>
        </View>

        <View style={st.kinds}>
          {KINDS.map(([k, label, icon]) => (
            <Pressable key={k} onPress={() => setKind(k)} style={[st.kind, kind === k && { backgroundColor: brand.purple }]}>
              <Icon name={icon} size={18} color={kind === k ? '#fff' : brand.purple} />
              <AppText style={{ fontFamily: font.bold, fontSize: 14 }} color={kind === k ? '#fff' : brand.ink}>{label}</AppText>
            </Pressable>
          ))}
        </View>

        <View style={st.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar t={initial(user.name || '؟')} c={tint(user.id)} size={40} />
            <View style={{ flex: 1 }}>
              <AppText style={{ fontFamily: font.bold }}>{user.name || 'مستخدم الدليل'}</AppText>
              {prm.place ? <AppText variant="tiny" color={brand.skyDeep}>عن: {prm.place}</AppText> : <AppText variant="tiny" muted>ينشر باسمك للكل</AppText>}
            </View>
          </View>
          <TextInput value={text} onChangeText={setText} placeholder={hint} placeholderTextColor={brand.faint} multiline maxLength={1500} autoFocus={kind !== 'photo'}
            style={st.input} />
          <AppText variant="tiny" muted style={{ textAlign: 'left' }}>{text.length}/1500</AppText>

          {photo ? (
            <View style={st.photoWrap}>
              <Image source={{ uri: photo }} style={{ width: '100%', height: 220 }} contentFit="cover" />
              <Pressable onPress={() => setPhoto(null)} style={st.photoX} accessibilityLabel="شيل الصورة"><Icon name="x" color="#fff" size={18} /></Pressable>
            </View>
          ) : null}
          {Platform.OS !== 'web' ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Pressable style={st.media} onPress={() => pick(false)}><Icon name="plus" color={brand.pinkDeep} size={18} /><AppText variant="small" style={{ fontFamily: font.bold }}>من الصور</AppText></Pressable>
              <Pressable style={st.media} onPress={() => pick(true)}><Icon name="cam" color={brand.pinkDeep} size={18} /><AppText variant="small" style={{ fontFamily: font.bold }}>الكاميرا</AppText></Pressable>
            </View>
          ) : null}
        </View>

        <AppText variant="section" style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 }}>عن أي مدينة؟</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {CITIES.map(([id, n]) => <Chip key={id} label={n} on={city === id} color={brand.ink} onPress={() => setCity(city === id ? null : id)} />)}
        </ScrollView>

        {err ? <AppText center color={brand.pinkDeep} style={{ marginTop: 16 }}>{err}</AppText> : null}

        <View style={st.rules}>
          <AppText variant="small" style={{ fontFamily: font.bold }}>قبل لا تنشر</AppText>
          <AppText variant="small" muted style={{ lineHeight: 22 }}>احترم الناس، وبدون إعلانات أو أرقام جوالات. أي مشاركة يبلّغ عنها ٣ أشخاص تختفي لين نراجعها.</AppText>
          <AppText variant="tiny" muted style={{ marginTop: 4 }}>
            بالنشر توافق على <AppText variant="tiny" color={brand.purple} onPress={() => WebBrowser.openBrowserAsync(`${env.siteUrl}/terms`)}>شروط المجتمع</AppText>
          </AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  post: { backgroundColor: brand.orange, borderRadius: 14, paddingHorizontal: 20, height: 42, justifyContent: 'center', minWidth: 76, alignItems: 'center' },
  kinds: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 18 },
  kind: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 16, backgroundColor: '#fff' },
  card: { margin: 16, marginBottom: 0, backgroundColor: '#fff', borderRadius: 24, padding: 14 },
  input: { minHeight: 130, marginTop: 12, fontFamily: font.regular, fontSize: 16, lineHeight: 28, color: brand.ink, textAlign: INPUT_START, textAlignVertical: 'top' },
  photoWrap: { marginTop: 10, borderRadius: 18, overflow: 'hidden' },
  photoX: { position: 'absolute', top: 10, left: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  media: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 14, backgroundColor: brand.softPink },
  rules: { margin: 16, marginTop: 22, backgroundColor: brand.softPurple, borderRadius: 18, padding: 14, gap: 2 },
  gate: { marginTop: 60, backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', gap: 8 },
  gateIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: brand.softPurple, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  send: { marginTop: 10, backgroundColor: brand.purple, borderRadius: 16, paddingHorizontal: 24, height: 48, justifyContent: 'center' },
});
