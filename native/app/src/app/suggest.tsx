import { useState } from 'react';
import { Image } from 'expo-image';
import { pickPhotos } from '@/lib/photos';
import * as Location from 'expo-location';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Field, Input } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { BackButton, Chip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { similarPlaces, suggest, uploadPhoto, type Similar } from '@/lib/community';
import { allCities, cityName } from '@/lib/content';
import { couponErr } from '@/lib/coupons';
import { t } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';

const KINDS: [string, string][] = [['sights', t('معلم')], ['heritage', t('تراث')], ['islamic', t('معلم إسلامي')], ['nature', t('طبيعة')], ['food', t('مطعم')], ['cafe', t('مقهى')], ['shopping', t('تسوق')], ['fun', t('ترفيه')]];

/** اقتراح تعديل على مكان، أو إضافة مكان ناقص — يوصل لوحة الإدارة وبعد الموافقة ياخذ نقاط */
export default function Suggest() {
  const insets = useSafeAreaInsets();
  const prm = useLocalSearchParams<{ place?: string; title?: string; q?: string; city?: string; lat?: string; lng?: string }>();
  const { user } = useAuth();
  const isNew = !prm.place;
  const [mode, setMode] = useState<'edit' | 'closed'>('edit');
  const [title, setTitle] = useState(isNew ? prm.q || '' : '');
  const [city, setCity] = useState(prm.city || user?.city || '');
  const [kind, setKind] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(prm.lat && prm.lng ? { lat: +prm.lat, lng: +prm.lng } : null);
  const [photos, setPhotos] = useState<string[]>([]); // مسارات محلية، تنرفع وقت الإرسال
  const [similar, setSimilar] = useState<Similar[] | null>(null); // «هل تقصد…؟»
  const [checked, setChecked] = useState(false);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!user) return <Redirect href="/login" />;

  const locate = async () => {
    setLocating(true);
    const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
    const pos = perm?.granted ? await Location.getCurrentPositionAsync({}).catch(() => null) : null;
    if (pos) setGeo({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) }); else setErr(t('ما قدرنا نحدد موقعك.'));
    setLocating(false);
  };
  const pick = async (camera: boolean) => {
    setErr('');
    const r = await pickPhotos({ camera, edit: true });
    if (r.error) { setErr(r.error); return; }
    if (r.uris[0]) setPhotos((p) => [...p, r.uris[0]].slice(0, 3));
  };
  const submit = async () => {
    setErr('');
    // مكان جديد: نتأكد مرة وحدة إنه مو موجود قبل الإرسال
    if (isNew && !checked && title.trim().length >= 2) {
      setBusy(true);
      const list = await similarPlaces({ title: title.trim(), city, lat: geo?.lat, lng: geo?.lng });
      setBusy(false); setChecked(true);
      if (list.length) { setSimilar(list); return; }
    }
    if (isNew && title.trim().length < 2) return setErr(t('اكتب اسم المكان.'));
    if (isNew && !city) return setErr(t('اختر المدينة.'));
    if (!isNew && mode === 'edit' && !title && !phone && !website && !address && !hours && !note && !geo) return setErr(t('اكتب وش اللي يحتاج يتعدل.'));
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const ph of photos) urls.push(await uploadPhoto(ph));
      const r = await suggest({ type: isNew ? 'new' : mode, placeId: isNew ? undefined : Number(prm.place), data: { title: title.trim(), city, kind, phone, website, address, hours, note: note.trim(), lat: geo?.lat, lng: geo?.lng, photos: urls } });
      if (r.status === 'rejected') { setErr(r.message || t('ما قدرنا نعتمد هالاقتراح.')); return; }
      const bonus = urls.length ? t(' و+{n} للصور', { n: urls.length * 5 }) : '';
      const msg = isNew ? t('بنراجعه ونضيفه للدليل باسمك، ويوصلك إشعار مع +15 نقطة{bonus}.', { bonus }) : t('بنراجعه ويوصلك إشعار مع +5 نقاط{bonus} لو انقبل.', { bonus });
      if (Platform.OS === 'web') router.back(); else Alert.alert(t('شكراً! وصلنا اقتراحك'), msg, [{ text: t('تمام'), onPress: () => router.back() }]);
    } catch (e) { setErr(e && (e as { code?: string }).code === 'empty' ? t('اكتب وش اللي يحتاج يتعدل.') : couponErr(e)); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 140, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <View style={{ flex: 1 }}>
            <AppText variant="title">{isNew ? t('أضف مكان ناقص') : t('اقترح تعديل')}</AppText>
            {!isNew ? <AppText variant="small" muted numberOfLines={1}>{prm.title}</AppText> : null}
          </View>
        </View>
        <View style={st.hint}>
          <Icon name="star" color={brand.orangeDeep} size={18} />
          <AppText variant="small" style={{ flex: 1, lineHeight: 21 }}>{isNew ? t('تعرف مكان يستاهل وما لقيته في الدليل؟ أضفه مع صوره، ولو انقبل ينضاف باسمك وتاخذ +15 نقطة.') : t('ساعدنا نخلي المعلومات صحيحة. لو انقبل تعديلك تاخذ +5 نقاط.')}</AppText>
        </View>

        {!isNew ? (
          <View style={st.seg}>
            {([['edit', 'معلومة غلط أو ناقصة'], ['closed', 'المكان مقفل نهائياً']] as const).map(([k, lbl]) => (
              <Pressable key={k} style={[st.segItem, mode === k && { backgroundColor: brand.purple }]} onPress={() => setMode(k)}>
                <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={mode === k ? '#fff' : brand.muted} center>{t(lbl)}</AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {isNew ? (
          <>
            <Field label={t('اسم المكان')}><Input value={title} onChangeText={setTitle} placeholder={t('مثلاً: مزرعة الحرة')} maxLength={120} /></Field>
            <Field label={t('المدينة')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {allCities.map((c) => <Chip key={c.id} label={c.name} on={city === c.id} color={brand.purple} onPress={() => setCity(c.id)} />)}
              </ScrollView>
            </Field>
            <Field label={t('النوع')}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{KINDS.map(([k, lbl]) => <Chip key={k} label={lbl} on={kind === k} color={brand.orangeDeep} onPress={() => setKind(kind === k ? '' : k)} />)}</View>
            </Field>
          </>
        ) : null}

        {isNew || mode === 'edit' ? (
          <>
            {!isNew ? <Field label={t('الاسم الصحيح')} hint={t('اختياري')}><Input value={title} onChangeText={setTitle} placeholder={t('لو الاسم غلط')} maxLength={120} /></Field> : null}
            <Field label={t('الموقع')} hint={isNew ? t('سجّله وأنت في المكان') : t('لو الدبوس غلط')}>
              <Pressable style={st.loc} onPress={locate} disabled={locating}>
                <View style={[st.locIcon, geo && { backgroundColor: brand.green }]}>{locating ? <ActivityIndicator color="#fff" /> : <Icon name={geo ? 'check' : 'pin'} color="#fff" size={18} />}</View>
                <AppText style={{ flex: 1, fontFamily: font.semibold, fontSize: 14 }}>{geo ? t('انحفظ: {lat}, {lng}', { lat: geo.lat, lng: geo.lng }) : t('استخدم موقعي الحالي')}</AppText>
              </Pressable>
            </Field>
            <Field label={t('الجوال')} hint={t('اختياري')}><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="05xxxxxxxx" maxLength={15} style={{ textAlign: 'left' }} /></Field>
            <Field label={t('ساعات العمل')} hint={t('اختياري')}><Input value={hours} onChangeText={setHours} placeholder={t('مثلاً: يومياً 4 العصر – 12 الليل')} maxLength={120} /></Field>
            <Field label={t('العنوان أو أقرب معلم')} hint={t('اختياري')}><Input value={address} onChangeText={setAddress} placeholder={t('مثلاً: طريق قباء، جنب…')} maxLength={200} /></Field>
            <Field label={t('الموقع الإلكتروني أو حساب إنستقرام')} hint={t('اختياري')}><Input value={website} onChangeText={setWebsite} autoCapitalize="none" placeholder="https://" maxLength={200} style={{ textAlign: 'left' }} /></Field>
          </>
        ) : null}
        {mode !== 'closed' || isNew ? (
          <Field label={t('صور المكان')} hint={isNew ? t('لين 3 صور، كل صورة +5 نقاط') : t('اختياري، كل صورة +5 نقاط')}>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {photos.map((u, i) => (
                <Pressable key={u} onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))} accessibilityLabel={t('شيل الصورة')}>
                  <Image source={{ uri: u }} style={st.thumb} contentFit="cover" />
                  <View style={st.x}><AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 12, lineHeight: 16 }}>✕</AppText></View>
                </Pressable>
              ))}
              {photos.length < 3 ? (
                <>
                  <Pressable style={st.add} onPress={() => pick(true)}><Icon name="cam" color={brand.orangeDeep} size={22} /><AppText variant="tiny" color={brand.orangeDeep} style={{ fontFamily: font.bold }}>{t('صوّر')}</AppText></Pressable>
                  <Pressable style={st.add} onPress={() => pick(false)}><Icon name="plus" color={brand.purple} size={22} /><AppText variant="tiny" color={brand.purple} style={{ fontFamily: font.bold }}>{t('من الصور')}</AppText></Pressable>
                </>
              ) : null}
            </View>
            <AppText variant="tiny" muted style={{ marginTop: 6 }}>{t('صوّر المكان بنفسك. لو انقبل، تطلع الصور باسمك.')}</AppText>
          </Field>
        ) : null}
        <Field label={isNew ? t('ليش يستاهل؟') : mode === 'closed' ? t('متى قفل؟ (اختياري)') : t('ملاحظات')} hint={t('اختياري')}>
          <Input value={note} onChangeText={setNote} multiline maxLength={600} placeholder={isNew ? t('وش يميزه؟ نصيحة للزوار؟') : mode === 'closed' ? t('مثلاً: قفل من شهرين وصار محل ثاني') : t('وش الغلط بالضبط؟')} />
        </Field>
        {err ? <AppText center color={brand.pinkDeep} style={{ marginTop: 12, fontFamily: font.semibold }}>{err}</AppText> : null}
        {similar && similar.length ? (
          <View style={st.similar}>
            <AppText style={{ fontFamily: font.bold }}>{t('هل تقصد واحد من هذي؟')}</AppText>
            <AppText variant="small" muted style={{ marginTop: 2, marginBottom: 8 }}>{t('لقينا أماكن قريبة منه في الدليل. لو هو نفسه، افتحه واقترح عليه تعديل أو أضف صوره.')}</AppText>
            {similar.map((x) => (
              <Pressable key={x.id} style={st.simRow} onPress={() => router.replace({ pathname: '/suggest', params: { place: String(x.id), title: x.title } })}>
                {x.thumb ? <Image source={{ uri: x.thumb }} style={st.simImg} contentFit="cover" /> : <View style={[st.simImg, { backgroundColor: brand.softPurple, alignItems: 'center', justifyContent: 'center' }]}><Icon name="pin" color={brand.purple} size={18} /></View>}
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontFamily: font.bold, fontSize: 14 }} numberOfLines={1}>{x.title}</AppText>
                  <AppText variant="tiny" muted>{[cityName(x.city), x.why].filter(Boolean).join(' · ')}</AppText>
                </View>
                <AppText variant="tiny" color={brand.purple} style={{ fontFamily: font.bold }}>{t('هو نفسه')}</AppText>
              </Pressable>
            ))}
            <Pressable onPress={() => { setSimilar(null); submit(); }} style={{ marginTop: 10 }}><AppText center color={brand.orangeDeep} style={{ fontFamily: font.bold }}>{t('لا، مكان ثاني. أرسل الاقتراح')}</AppText></Pressable>
          </View>
        ) : null}
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable style={st.cta} onPress={submit} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color="#fff">{t('أرسل الاقتراح')}</AppText>}</Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  hint: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 14, backgroundColor: brand.softOrange, borderRadius: 16, padding: 12 },
  seg: { flexDirection: 'row', marginTop: 14, backgroundColor: brand.card, borderRadius: 16, padding: 4 },
  segItem: { flex: 1, height: 42, borderRadius: 12, justifyContent: 'center' },
  loc: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderWidth: 1.5, borderColor: brand.line, borderRadius: 16, padding: 10 },
  locIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 0, paddingTop: 10 },
  cta: { height: 56, borderRadius: 18, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 84, height: 84, borderRadius: 16 },
  x: { position: 'absolute', top: 4, left: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  add: { width: 84, height: 84, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: brand.line, backgroundColor: brand.card, alignItems: 'center', justifyContent: 'center', gap: 4 },
  similar: { marginTop: 16, backgroundColor: brand.card, borderRadius: 20, padding: 14, borderWidth: 1.5, borderColor: brand.orange },
  simRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: brand.line },
  simImg: { width: 48, height: 48, borderRadius: 12 },
});
