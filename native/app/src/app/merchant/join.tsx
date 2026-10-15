import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { pickPhotos } from '@/lib/photos';
import * as Location from 'expo-location';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Field, Input } from '@/components/Form';
import { Icon } from '@/components/Icon';
import { Chip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { uploadPhoto } from '@/lib/community';
import { allCities } from '@/lib/content';
import { BIZ_KINDS, couponErr, myMerchant, saveMerchant, type Merchant } from '@/lib/coupons';
import { brand, font } from '@/theme/tokens';

type Ph = { uri: string; url?: string };

/** «سجّل نشاطك» — الخطوة الأولى في بوابة التجار (وتنفع للتعديل بعدين) */
export default function MerchantJoin() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [m, setM] = useState<Merchant | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [kind, setKind] = useState('restaurant');
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [city, setCity] = useState(user?.city || '');
  const [area, setArea] = useState('');
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [photos, setPhotos] = useState<Ph[]>([]);
  const [hours, setHours] = useState('');
  const [phone, setPhone] = useState('');
  const [cr, setCr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [termsV, setTermsV] = useState('');
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    myMerchant().then((r) => {
      setTermsV(r.termsVersion);
      const x = r.merchant;
      if (x) {
        setM(x); setKind(x.kind); setName(x.name); setNameEn(x.name_en); setCity(x.city); setArea(x.area);
        setGeo(x.lat && x.lng ? { lat: x.lat, lng: x.lng } : null); setPhotos(x.photos.map((u) => ({ uri: u, url: u })));
        setHours(x.hours); setPhone(x.phone); setCr(x.cr); setAgreed(x.termsOk);
      }
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  if (!user) return <Redirect href="/merchant" />;

  const locate = async () => {
    setLocating(true);
    const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (perm?.granted) {
      const pos = await Location.getCurrentPositionAsync({}).catch(() => null);
      if (pos) setGeo({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) });
      else setErr('ما قدرنا نحدد موقعك. جرّب مرة ثانية.');
    } else setErr('نحتاج إذن الموقع من الإعدادات.');
    setLocating(false);
  };
  const addPhoto = async () => {
    const r = await pickPhotos({ camera: false, max: 8 - photos.length });
    if (r.error) return setErr(r.error);
    if (r.uris.length) setPhotos((p) => [...p, ...r.uris.map((uri) => ({ uri }))].slice(0, 8));
  };

  const ready = name.trim().length >= 2 && !!city && agreed && !busy;
  const submit = async () => {
    if (!ready) { setErr(!agreed ? 'لازم توافق على الشروط والأحكام.' : !city ? 'اختر المدينة.' : 'اكتب اسم النشاط.'); return; }
    setBusy(true); setErr('');
    try {
      const urls: string[] = [];
      for (const p of photos) urls.push(p.url ?? (await uploadPhoto(p.uri)));
      await saveMerchant({ kind, name: name.trim(), name_en: nameEn.trim(), city, area: area.trim(), lat: geo?.lat ?? null, lng: geo?.lng ?? null, photos: urls, hours: hours.trim(), phone: phone.trim(), cr: cr.trim(), acceptTerms: agreed ? termsV : undefined });
      if (!m) router.replace('/merchant/coupon?first=1');
      else router.back();
    } catch (e) { setErr(couponErr(e)); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: brand.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
        <View style={[st.head, { paddingTop: insets.top + 10 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable style={st.glass} onPress={() => router.back()} accessibilityLabel="رجوع"><Icon name="back" color="#fff" size={20} /></Pressable>
            <View style={{ flex: 1 }}>
              <AppText variant="small" color="#F9A158" style={{ fontFamily: font.semibold }}>دليل السعودية للأعمال</AppText>
              <AppText variant="title" color="#fff">{m ? 'بيانات نشاطك' : 'سجّل نشاطك'}</AppText>
            </View>
          </View>
          <AppText variant="small" color="#E2DAEE" style={{ marginTop: 10, lineHeight: 22 }}>
            {m ? 'تعديل الاسم أو المدينة أو السجل يرجّع الطلب للمراجعة.' : 'مطعمك أو مقهاك يظهر لزوار مدينتك. التسجيل مجاني الحين، مقابل كوبون واحد لمستخدمي الدليل.'}
          </AppText>
          {!m ? <View style={st.steps}>{[1, 2, 3, 4].map((i) => <View key={i} style={[st.step, i <= 2 && { backgroundColor: brand.orange }]} />)}</View> : null}
        </View>

        {!loaded ? <ActivityIndicator style={{ marginTop: 40 }} color={brand.purple} /> : (
          <View style={{ paddingHorizontal: 16 }}>
            <Field label="نوع النشاط">
              <View style={st.wrap}>{BIZ_KINDS.map(([k, t]) => <Chip key={k} label={t} on={kind === k} color={brand.orangeDeep} onPress={() => setKind(k)} />)}</View>
            </Field>
            <Field label="اسم النشاط" hint="عربي وإنجليزي">
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Input value={name} onChangeText={setName} placeholder="بالعربي" maxLength={80} /></View>
                <View style={{ flex: 1 }}><Input style={{ textAlign: 'left' }} value={nameEn} onChangeText={setNameEn} placeholder="English" maxLength={80} autoCapitalize="words" /></View>
              </View>
            </Field>
            <Field label="المدينة">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {allCities.map((c) => <Chip key={c.id} label={c.name} on={city === c.id} color={brand.purple} onPress={() => setCity(c.id)} />)}
              </ScrollView>
            </Field>
            <Field label="الحي">
              <Input value={area} onChangeText={setArea} placeholder="مثلاً: قباء، العليا، البلد" maxLength={60} />
            </Field>
            <Field label="الموقع" hint="سجّله وأنت في المحل">
              <Pressable style={st.loc} onPress={locate} disabled={locating}>
                <View style={[st.locIcon, geo && { backgroundColor: brand.green }]}>{locating ? <ActivityIndicator color="#fff" /> : <Icon name={geo ? 'check' : 'pin'} color="#fff" size={20} />}</View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontFamily: font.semibold, fontSize: 14 }}>{geo ? 'انحفظ الموقع' : 'استخدم موقعي الحالي'}</AppText>
                  <AppText variant="tiny" muted>{geo ? `${geo.lat}, ${geo.lng} · اضغط للتحديث` : 'فريق الدليل يقدر يعدّله لك بعدين'}</AppText>
                </View>
              </Pressable>
            </Field>
            <Field label="صور النشاط" hint="حتى 8 صور">
              <View style={st.wrap}>
                {photos.map((p, i) => (
                  <View key={p.uri + i}>
                    <Image source={p.uri} style={st.ph} contentFit="cover" />
                    <Pressable style={st.phX} onPress={() => setPhotos(photos.filter((_, k) => k !== i))} accessibilityLabel="شيل الصورة"><Icon name="x" color="#fff" size={14} /></Pressable>
                  </View>
                ))}
                {photos.length < 8 && Platform.OS !== 'web' ? <Pressable style={st.add} onPress={addPhoto}><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.link}>+ صورة</AppText></Pressable> : null}
              </View>
            </Field>
            <Field label="ساعات العمل">
              <Input value={hours} onChangeText={setHours} placeholder="يومياً 7 ص – 1 ص · الجمعة من 1 م" maxLength={120} />
            </Field>
            <Field label="جوال التواصل" hint="للإدارة فقط، ما يظهر للناس">
              <Input value={phone} onChangeText={setPhone} placeholder="05xxxxxxxx" keyboardType="phone-pad" maxLength={15} style={{ textAlign: 'left' }} />
            </Field>
            <Field label="التوثيق" hint="تطلع علامة «موثّق»">
              <Input value={cr} onChangeText={setCr} placeholder="رقم السجل التجاري أو معروف" keyboardType="number-pad" maxLength={15} style={{ textAlign: 'left' }} />
            </Field>
            {!m ? (
              <View style={st.plan}>
                <View style={st.planIcon}><Icon name="ticket" color="#fff" size={20} /></View>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontFamily: font.bold }} color="#fff">الباقة المجانية</AppText>
                  <AppText variant="small" color="#CFC6DE">ظهور في كوبونات المدينة + كوبون واحد فعّال. الخطوة الجاية: كوبونك الأول.</AppText>
                </View>
              </View>
            ) : null}
            <Pressable style={st.agree} onPress={() => setAgreed(!agreed)}>
              <View style={[st.box, agreed && { backgroundColor: brand.purple, borderColor: brand.purple }]}>{agreed ? <Icon name="check" color="#fff" size={14} strokeWidth={3} /> : null}</View>
              <AppText variant="small" style={{ flex: 1, lineHeight: 22 }}>
                قرأت <AppText variant="small" color={brand.link} style={{ fontFamily: font.bold }} onPress={() => router.push('/merchant/terms')}>الشروط والأحكام للتجار</AppText> وأوافق عليها، وأقر بأن دليل السعودية منصة عرض فقط وأني المسؤول عن نشاطي وعروضي وتراخيصها.
              </AppText>
            </Pressable>
            {err ? <AppText center color={brand.pinkDeep} style={{ marginTop: 14, fontFamily: font.semibold }}>{err}</AppText> : null}
          </View>
        )}
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable style={[st.cta, !ready && { opacity: 0.5 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color="#fff">{m ? 'احفظ' : 'التالي: أضف كوبونك'}</AppText>}
        </Pressable>
        <AppText variant="tiny" muted center style={{ marginTop: 6 }}>نراجع الطلب خلال 24 ساعة قبل النشر</AppText>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: brand.purple, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  glass: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  steps: { flexDirection: 'row', gap: 6, marginTop: 14 },
  step: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  loc: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderWidth: 1.5, borderColor: brand.line, borderRadius: 16, padding: 12 },
  locIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  ph: { width: 84, height: 84, borderRadius: 14 },
  phX: { position: 'absolute', top: 4, left: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  add: { width: 84, height: 84, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: brand.faint, alignItems: 'center', justifyContent: 'center' },
  agree: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 18, backgroundColor: brand.card, borderRadius: 16, padding: 12 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: brand.faint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  plan: { marginTop: 18, backgroundColor: '#2B2745', borderRadius: 20, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  planIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: brand.card, paddingHorizontal: 16, paddingTop: 14, borderTopLeftRadius: 26, borderTopRightRadius: 26, shadowColor: '#2B1F45', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 8 },
  cta: { height: 56, borderRadius: 18, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
});
