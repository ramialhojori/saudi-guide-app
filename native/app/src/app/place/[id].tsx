import { useState } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Dimensions, FlatList, Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { HeartButton } from '@/components/HeartButton';
import { Icon, type IconName } from '@/components/Icon';
import { RichText } from '@/components/RichText';
import { Empty, Loading } from '@/components/State';
import { Avatar, BackButton, Badge, Button, Pill, RoundButton } from '@/components/ui';
import { cityName, getPlace, nearby } from '@/lib/content';
import { openDirections } from '@/lib/maps';
import { trip, useTrip } from '@/lib/trip';
import { useAsync } from '@/lib/useAsync';
import { brand, font, kindStyle } from '@/theme/tokens';

const W = Dimensions.get('window').width;

/** صفحة المكان — مثل التصميم: صورة كبيرة، بطاقة المعلومات، نصيحة من أهل الديرة، الخريطة، الأسئلة، القريب منه */
export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: p, loading, error } = useAsync(() => getPlace(Number(id)), [id]);
  const { data: near } = useAsync(() => (p?.lat && p?.lng ? nearby(p.lat, p.lng, 5) : Promise.resolve([])), [p?.id]);
  const { ids } = useTrip();
  const [img, setImg] = useState(0);
  const [more, setMore] = useState(false);

  if (!p) return <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}><BackButton />{loading ? <Loading /> : <Empty title={error ? 'ما قدرنا نفتح المكان' : 'ما لقينا المكان'} />}</View>;

  const ks = kindStyle[p.kinds[0]] ?? kindStyle.sights;
  const images = p.images?.length ? p.images : p.image ? [p.image] : [];
  const saved = ids.includes(p.id);
  const others = (near ?? []).filter((x) => x.id !== p.id && x.thumb).slice(0, 6);

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* الصور */}
        {images.length ? (
          <View style={{ height: 440, backgroundColor: brand.ink }}>
            <FlatList data={images} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(u, i) => u + i}
              onMomentumScrollEnd={(e) => setImg(Math.round(e.nativeEvent.contentOffset.x / W))}
              renderItem={({ item }) => <Image source={item} style={{ width: W, height: 440 }} contentFit="cover" transition={200} />} />
            {images.length > 1 ? (
              <View style={st.thumbs}>
                {images.slice(0, 2).map((u, i) => <Image key={u} source={u} style={[st.thumb, i === img && { borderColor: '#fff' }]} contentFit="cover" />)}
                {images.length > 2 ? <View style={[st.thumb, st.thumbMore]}><AppText style={{ fontFamily: font.bold }} color="#fff">+{images.length - 2}</AppText></View> : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[st.noPhoto, { backgroundColor: ks.bg }]}>
            <View style={st.noPhotoIcon}><Icon name={ks.icon as IconName} color={ks.fg} size={50} strokeWidth={1.8} /></View>
            <AppText style={{ fontFamily: font.semibold, marginTop: 12 }} color={ks.fg} center>ما عندنا صورة لهالمكان للحين</AppText>
            <View style={st.noPhotoBtns}>
              <Pressable style={st.noPhotoBtn} onPress={() => openMaps(p.title, p.lat, p.lng)}><Icon name="map" color={brand.skyDeep} size={18} /><AppText style={{ fontFamily: font.semibold, fontSize: 13 }}>الصور في Google Maps</AppText></Pressable>
              <Pressable style={[st.noPhotoBtn, { backgroundColor: brand.orangeDeep }]} onPress={() => router.push({ pathname: '/ask', params: { kind: 'photo', placeId: String(p.id), place: p.title, city: p.city } })}><Icon name="cam" color="#fff" size={18} /><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color="#fff">عندك صورة؟ أضفها</AppText></Pressable>
            </View>
          </View>
        )}

        <View style={[st.topBtns, { top: insets.top + 10 }]}>
          <BackButton light />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <RoundButton icon="share" label="مشاركة" onPress={() => Share.share({ message: `${p.title} — دليل السعودية\n${p.url || ''}` }).catch(() => {})} />
            <HeartButton id={p.id} size={44} light />
          </View>
        </View>

        {/* البطاقة */}
        <View style={st.sheet}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Pill label={p.cat} bg={ks.bg} fg={ks.fg} />
            {p.cats.slice(1, 3).map((c) => <Pill key={c} label={c} bg={brand.softPurple} fg={brand.purple} />)}
          </View>
          <AppText variant="hero" style={{ marginTop: 8 }}>{p.title}</AppText>
          <AppText variant="small" muted>{cityName(p.city)}{p.title_en ? ` · ${p.title_en}` : ''}</AppText>

          <View style={st.facts}>
            {[
              { v: '4.8', l: '2,140 تقييم', c: brand.orangeDeep },
              { v: 'مفتوح', l: 'حتى 12 م', c: brand.green },
              { v: '2–3', l: 'ساعات زيارة', c: brand.purple },
              { v: 'م', l: 'أفضل وقت', c: brand.pinkDeep },
            ].map((f) => (
              <View key={f.l} style={st.fact}>
                <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color={f.c} center>{f.v}</AppText>
                <AppText variant="tiny" muted center>{f.l}</AppText>
              </View>
            ))}
          </View>

          {p.body ? (
            <View style={{ marginTop: 16 }}>
              <View style={!more ? { maxHeight: 130, overflow: 'hidden' } : undefined}><RichText html={p.body} /></View>
              <Pressable onPress={() => setMore((v) => !v)}><AppText style={{ fontFamily: font.bold, marginTop: 6 }} color={brand.purple}>{more ? 'أقل' : 'اقرأ أكثر'}</AppText></Pressable>
            </View>
          ) : p.summary ? <AppText style={{ marginTop: 16 }}>{p.summary}</AppText> : null}

          {/* نصيحة من أهل الديرة (من المجتمع — تجريبي) */}
          <View style={st.tip}>
            <Avatar t="س" c={brand.orange} size={40} />
            <View style={{ flex: 1 }}>
              <AppText variant="tiny" color="#F9A158" style={{ fontFamily: font.semibold }}>نصيحة من أهل الديرة · سارة، مرشدة موثّقة</AppText>
              <AppText variant="small" color="#fff" style={{ lineHeight: 22 }}>احجز وقتك قبل، وتعال قبل الغروب بساعة عشان تشوف المكان بأحلى ضوء.</AppText>
            </View>
          </View>

          {/* الموقع */}
          {p.lat && p.lng ? (
            <Pressable style={st.mapCard} onPress={() => openDirections(p.lat, p.lng, p.title)}>
              <View style={st.mapArt}>
                <View style={st.mapRoad} /><View style={st.mapRoad2} />
                <View style={st.mapPin} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
                <AppText variant="small" style={{ flex: 1 }} numberOfLines={1}>{p.address || cityName(p.city)}</AppText>
                <View style={st.dirBtn}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={brand.purple}>الاتجاهات</AppText></View>
              </View>
            </Pressable>
          ) : null}

          {/* تواصل */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {p.phone ? <Contact icon="phone" label="اتصال" on={() => Linking.openURL(`tel:${p.phone}`)} /> : null}
            {p.website ? <Contact icon="globe" label="الموقع" on={() => WebBrowser.openBrowserAsync(p.website)} /> : null}
            {p.url ? <Contact icon="link" label="في الموقع" on={() => WebBrowser.openBrowserAsync(p.url)} /> : null}
          </View>
        </View>

        {/* الأسئلة */}
        <View style={st.secRow}><AppText variant="section">أسأل اللي زاروه</AppText><AppText variant="small" muted>24 سؤال</AppText></View>
        <View style={st.qa}>
          <AppText style={{ fontFamily: font.bold }}>هل يناسب الأطفال والعربيات؟</AppText>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Avatar t="ر" c={brand.lilac} size={32} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><AppText style={{ fontFamily: font.bold, fontSize: 13 }}>رامي</AppText><Pill label="مرجع الديرة" bg={brand.purple} fg="#fff" /></View>
              <AppText variant="small" muted>إيه، الممرات مرصوفة وفيه عربيات للإيجار عند البوابة.</AppText>
            </View>
          </View>
        </View>
        <Pressable style={st.ask} onPress={() => router.push({ pathname: '/ask', params: { kind: 'question', placeId: String(p.id), place: p.title, city: p.city } })}>
          <AppText muted style={{ flex: 1 }}>عندك سؤال عن المكان؟</AppText>
          <AppText style={{ fontFamily: font.bold }} color={brand.purple}>اسأل</AppText>
        </Pressable>

        {/* قريب منه */}
        {others.length ? (
          <>
            <View style={st.secRow}><AppText variant="section">قريب منه</AppText></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
              {others.map((o) => (
                <Pressable key={o.id} style={{ width: 150 }} onPress={() => router.push(`/place/${o.id}`)}>
                  <Image source={o.thumb} style={{ width: 150, height: 110, borderRadius: 18 }} contentFit="cover" />
                  <AppText style={{ fontFamily: font.bold, fontSize: 14, marginTop: 6 }} numberOfLines={1}>{o.title}</AppText>
                  <AppText variant="tiny" muted>{o.cat}{o.km != null ? ` · ${o.km < 1 ? Math.round(o.km * 1000) + ' م' : o.km + ' كم'}` : ''}</AppText>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>

      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button label={saved ? '✓ في رحلتي' : 'أضف لرحلتي'} icon={saved ? undefined : 'plus'} style={{ flex: 1.4 }} onPress={() => trip.toggle(p.id)} />
        <Button label="الاتجاهات" bg={brand.ink} style={{ flex: 1 }} onPress={() => openDirections(p.lat, p.lng, p.title)} />
      </View>
    </View>
  );
}

function openMaps(title: string, lat: number | null, lng: number | null) {
  const q = lat && lng ? `${lat},${lng}` : encodeURIComponent(title);
  WebBrowser.openBrowserAsync(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
}

function Contact({ icon, label, on }: { icon: IconName; label: string; on: () => void }) {
  return (
    <Pressable onPress={on} style={st.contact}>
      <Badge icon={icon} bg={brand.softPurple} fg={brand.purple} size={30} r={10} />
      <AppText style={{ fontFamily: font.semibold, fontSize: 13 }}>{label}</AppText>
    </Pressable>
  );
}

const st = StyleSheet.create({
  thumbs: { position: 'absolute', bottom: 46, left: 16, flexDirection: 'row', gap: 8 },
  thumb: { width: 48, height: 48, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  thumbMore: { backgroundColor: 'rgba(43,39,69,0.8)', alignItems: 'center', justifyContent: 'center' },
  noPhoto: { height: 380, paddingTop: 110, alignItems: 'center' },
  noPhotoIcon: { width: 96, height: 96, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  noPhotoBtns: { position: 'absolute', bottom: 48, right: 16, left: 16, flexDirection: 'row', gap: 8 },
  noPhotoBtn: { flex: 1, height: 46, borderRadius: 14, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  topBtns: { position: 'absolute', right: 16, left: 16, flexDirection: 'row', justifyContent: 'space-between' },
  sheet: { marginTop: -30, backgroundColor: brand.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 22 },
  facts: { flexDirection: 'row', gap: 8, marginTop: 16 },
  fact: { flex: 1, backgroundColor: '#fff', borderRadius: 18, paddingVertical: 12 },
  tip: { marginTop: 16, backgroundColor: brand.purple, borderRadius: 22, padding: 14, flexDirection: 'row', gap: 12 },
  mapCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden' },
  mapArt: { height: 110, backgroundColor: '#EEF0EA', alignItems: 'center', justifyContent: 'center' },
  mapRoad: { position: 'absolute', left: 0, right: 0, top: 50, height: 8, backgroundColor: '#fff' },
  mapRoad2: { position: 'absolute', top: 0, bottom: 0, left: 120, width: 8, backgroundColor: '#fff', transform: [{ rotate: '20deg' }] },
  mapPin: { width: 26, height: 26, borderRadius: 13, backgroundColor: brand.orange, borderWidth: 4, borderColor: '#fff' },
  dirBtn: { backgroundColor: brand.chip, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, padding: 8, paddingLeft: 14 },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
  qa: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 22, padding: 14 },
  ask: { marginHorizontal: 16, marginTop: 10, height: 52, borderRadius: 16, borderWidth: 1.5, borderColor: brand.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(244,241,238,0.96)' },
});
