import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BannerSlot } from '@/components/Ads';
import { useAds } from '@/lib/ads';
import { useHouseAd } from '@/lib/houseAds';
import { PlaceVideos } from '@/components/PlaceVideos';
import { BookStrip } from '@/components/BookStrip';
import { ActivityIndicator, Alert, Animated, Dimensions, FlatList, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { usePullUpClose } from '@/components/PullUpClose';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { HeartButton } from '@/components/HeartButton';
import { Icon, type IconName } from '@/components/Icon';
import { RichText } from '@/components/RichText';
import { Empty, Loading } from '@/components/State';
import { Avatar, BackButton, Badge, Button, Pill, RoundButton } from '@/components/ui';
import { cityName, getPlace, nearby } from '@/lib/content';
import { useAuth } from '@/lib/auth';
import { ago, answerFact, initial, nAnswers, placeFacts, placeSummary, tint, type CPost, type Fact } from '@/lib/community';
import { useFeatures } from '@/lib/features';
import { track } from '@/lib/track';
import { checkIn, placePosts, placeSocial, type PlaceSocial } from '@/lib/passport';
import { openDirections } from '@/lib/maps';
import { trip, useTrip } from '@/lib/trip';
import { CouponCard } from '@/components/CouponCard';
import { placeCoupons, type Coupon } from '@/lib/coupons';
import { placeReviews, reportReview, type PlaceReviews } from '@/lib/reviews';
import { useAsync } from '@/lib/useAsync';
import { extLink } from '@/lib/text';
import { MapCanvas } from '@/components/MapCanvas';
import { brand, font, kindStyle } from '@/theme/tokens';
import { isEn, t, tr } from '@/lib/i18n';

const W = Dimensions.get('window').width;

/** صفحة المكان — مثل التصميم: صورة كبيرة، بطاقة المعلومات، نصيحة من أهل الديرة، الخريطة، الأسئلة، القريب منه */
export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pull = usePullUpClose({ kind: 'place', id: Number(id), skipTop: 440 });
  const insets = useSafeAreaInsets();
  const { data: p, loading, error } = useAsync(() => getPlace(Number(id)), [id]);
  const houseBanner = useHouseAd('banner', p?.city).ad;
  const adsOn = useAds() || !!houseBanner;
  const { data: near } = useAsync(() => (p?.lat && p?.lng ? nearby(p.lat, p.lng, 5) : Promise.resolve([])), [p?.id]);
  const { ids } = useTrip();
  const [img, setImg] = useState(0);
  const [more, setMore] = useState(false);
  const { user } = useAuth();
  const [social, setSocial] = useState<PlaceSocial | null>(null);
  const [qs, setQs] = useState<CPost[]>([]);
  const [stamping, setStamping] = useState(false);
  const [rv, setRv] = useState<PlaceReviews | null>(null);
  const [cps, setCps] = useState<Coupon[]>([]);
  const [shot, setShot] = useState<string | null>(null);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [ask, setAsk] = useState<{ k: string; q: string } | null>(null);
  const [factMsg, setFactMsg] = useState('');
  const F = useFeatures();
  useEffect(() => { if (id) track('place', Number(id)); }, [id]);
  // «خلاصة الزوار»: Claude يلخص التقييمات وإجابات المجتمع عن المكان
  const [summary, setSummary] = useState<{ text: string; count: number } | null>(null);
  useEffect(() => { if (id) placeSummary(Number(id)).then(setSummary); }, [id]);
  useFocusEffect(useCallback(() => {
    placeSocial(Number(id)).then(setSocial).catch(() => {});
    placePosts(Number(id)).then(setQs).catch(() => {});
    placeReviews(Number(id)).then(setRv).catch(() => {});
    placeCoupons(Number(id)).then(setCps).catch(() => {});
    placeFacts(Number(id)).then((r) => { setFacts(r.facts); setAsk(r.ask); }).catch(() => {});
  }, [id, user?.id]));
  const stamp = async () => {
    if (!user) return router.push('/login');
    setStamping(true);
    const r = await checkIn(Number(id)).catch(() => ({ ok: false as const, msg: t('صار خطأ، جرّب بعد شوي.') }));
    setStamping(false);
    if (!r.ok) return Alert.alert(t('ما انختم'), r.msg);
    if (r.already) return Alert.alert(t('مختوم من قبل'), t('هذا المكان موجود في جوازك.'));
    setSocial((x) => x && { ...x, been: true, visits: x.visits + 1 });
    // مثل قوقل: أول ما يختم نسأله عن تجربته وهو في المكان
    Alert.alert(r.newCity ? t('ختم جديد في جوازك!') : t('انضافت الزيارة'), `${t('+{n} نقطة', { n: r.points ?? 0 })}${r.newCity ? ' · ' + t('مدينة جديدة في جواز السعودية') : ''}\n\n${t('كيف المكان؟ قيّمه الحين وخذ +3')}`, [
      { text: t('بعدين'), style: 'cancel' },
      ...(F.reviews ? [{ text: t('قيّم تجربتك'), onPress: () => router.push({ pathname: '/review/[id]', params: { id: String(id) } }) }] : [{ text: t('افتح الجواز'), onPress: () => router.push('/passport') }]),
    ]);
  };

  if (!p) return <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}><BackButton />{loading ? <Loading /> : <Empty title={error ? t('ما قدرنا نفتح المكان') : t('ما لقينا المكان')} />}</View>;

  const vote = async (v: 0 | 1 | null) => {
    if (!ask) return;
    if (!user) return router.push('/login');
    const k = ask.k;
    if (v === null) { setFacts((f) => f.map((x) => (x.k === k ? { ...x, mine: 0 as const, skip: true } : x))); }
    else {
      setFacts((f) => f.map((x) => (x.k === k ? { ...x, mine: v, yes: x.yes + v, no: x.no + (1 - v) } : x)));
      answerFact(Number(id), k, v).then((r) => { if (r.points) setFactMsg(t('+1 نقطة · شكراً!')); }).catch(() => {});
    }
    // السؤال الجاي
    setFacts((f) => { const next = f.filter((x) => x.mine === null && x.k !== k).sort((a, b) => a.yes + a.no - (b.yes + b.no))[0]; setAsk(next ? { k: next.k, q: next.q } : null); return f; });
  };
  const known = facts.filter((f) => f.yes + f.no >= 1 && f.yes / (f.yes + f.no) >= 0.6);
  const ks = kindStyle[p.kinds[0]] ?? kindStyle.sights;
  const images = p.images?.length ? p.images : p.image ? [p.image] : [];
  const saved = ids.includes(p.id);
  const others = (near ?? []).filter((x) => x.id !== p.id && x.thumb).slice(0, 6);

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: brand.bg }, pull.style]}>
      <ScrollView {...pull.scroll} contentContainerStyle={{ paddingBottom: adsOn ? 190 : 120 }} showsVerticalScrollIndicator={false}>
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
            <AppText style={{ fontFamily: font.semibold, marginTop: 12 }} color={ks.fg} center>{t('ما عندنا صورة لهالمكان للحين')}</AppText>
            <View style={st.noPhotoBtns}>
              <Pressable style={st.noPhotoBtn} onPress={() => openMaps(p.title, p.lat, p.lng)}><Icon name="map" color={brand.skyDeep} size={18} /><AppText style={{ fontFamily: font.semibold, fontSize: 13 }}>{t('الصور في Google Maps')}</AppText></Pressable>
              <Pressable style={[st.noPhotoBtn, { backgroundColor: brand.orangeDeep }]} onPress={() => router.push({ pathname: '/ask', params: { kind: 'photo', placeId: String(p.id), place: p.title, city: p.city } })}><Icon name="cam" color="#fff" size={18} /><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color="#fff">{t('عندك صورة؟ أضفها')}</AppText></Pressable>
            </View>
          </View>
        )}

        <View style={[st.topBtns, { top: insets.top + 10 }]}>
          <BackButton light />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <RoundButton icon="share" label={t('مشاركة')} onPress={() => { track('share', p.id); Share.share({ message: t('{title} — في تطبيق دليل السعودية', { title: p.title }) }).catch(() => {}); }} />
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
              { v: String(social?.visits ?? 0), l: t('زاروه بالدليل'), c: brand.orangeDeep },
              { v: String(social?.posts ?? 0), l: t('سؤال ونصيحة'), c: brand.purple },
              { v: String(images.length), l: images.length === 1 ? t('صورة') : t('صور'), c: brand.skyDeep },
              rv?.avg ? { v: '★ ' + rv.avg, l: t('{n} تقييم', { n: rv.count }), c: brand.orangeDeep } : { v: near?.length ? String(Math.max(0, near.length - 1)) : '—', l: t('مكان قريب'), c: brand.green },
            ].map((f) => (
              <View key={f.l} style={st.fact}>
                <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color={f.c} center>{f.v}</AppText>
                <AppText variant="tiny" muted center>{f.l}</AppText>
              </View>
            ))}
          </View>

          {F.coupons ? cps.map((c) => <View key={c.id} style={{ marginTop: 14 }}><CouponCard c={c} onPress={() => router.push(`/coupon/${c.id}`)} /></View>) : null}

          {p.body ? (
            <View style={{ marginTop: 16 }}>
              <View style={!more ? { maxHeight: 130, overflow: 'hidden' } : undefined}><RichText html={p.body} /></View>
              <Pressable onPress={() => setMore((v) => !v)}><AppText style={{ fontFamily: font.bold, marginTop: 6 }} color={brand.purple}>{more ? t('أقل') : t('اقرأ أكثر')}</AppText></Pressable>
            </View>
          ) : p.summary ? <AppText style={{ marginTop: 16 }}>{p.summary}</AppText> : null}

          {summary ? (
            <View style={st.summary}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="spark" color={brand.purple} size={16} />
                <AppText variant="tiny" color={brand.purple} style={{ fontFamily: font.bold }}>{t('خلاصة الزوار · من {n} تجربة', { n: summary.count })}</AppText>
              </View>
              <AppText variant="small" style={{ lineHeight: 22 }}>{summary.text}</AppText>
            </View>
          ) : null}

          {/* نصيحة من أهل الديرة: أكثر نصيحة انشكرت عن هذا المكان */}
          {social?.tip ? (
            <Pressable style={st.tip} onPress={() => router.push(`/question/${social.tip!.id}`)}>
              <Avatar t={initial(social.tip.name)} c={brand.orange} size={40} />
              <View style={{ flex: 1 }}>
                <AppText variant="tiny" color="#F9A158" style={{ fontFamily: font.semibold }}>{t('نصيحة من أهل الديرة')} · {social.tip.name}{social.tip.badge ? (isEn ? ', ' : '، ') + social.tip.badge : ''}</AppText>
                <AppText variant="small" color="#fff" style={{ lineHeight: 22 }} numberOfLines={4}>{social.tip.text}</AppText>
              </View>
            </Pressable>
          ) : (
            <Pressable style={st.tip} onPress={() => router.push({ pathname: '/ask', params: { kind: 'tip', placeId: String(p.id), place: p.title, city: p.city } })}>
              <Avatar t={isEn ? '?' : '؟'} c={brand.orange} size={40} />
              <View style={{ flex: 1 }}>
                <AppText variant="tiny" color="#F9A158" style={{ fontFamily: font.semibold }}>{t('زرته قبل؟')}</AppText>
                <AppText variant="small" color="#fff" style={{ lineHeight: 22 }}>{t('شارك نصيحة تفيد اللي بعدك، وتطلع هنا باسمك.')}</AppText>
              </View>
            </Pressable>
          )}

          {/* معلومات من الزوار + سؤال سريع (مثل قوقل ماب) */}
          {F.facts && (known.length || ask) ? (
            <View style={st.facts2}>
              {known.length ? (
                <>
                  <AppText variant="small" style={{ fontFamily: font.bold }}>{t('يقول الزوار')}</AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {known.map((f) => <Pill key={f.k} label={'✓ ' + f.q.replace('؟', '').replace(/^فيه /, '').replace(/^مناسب /, 'مناسب ')} bg={brand.softGreen} fg={brand.green} />)}
                  </View>
                </>
              ) : null}
              {ask ? (
                <View style={[known.length ? { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: brand.chip } : null]}>
                  <AppText variant="tiny" color={brand.orangeDeep} style={{ fontFamily: font.bold }}>{t('سؤال سريع · +1 نقطة')}</AppText>
                  <AppText style={{ fontFamily: font.bold, fontSize: 15, marginTop: 2 }}>{ask.q}</AppText>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Pressable style={[st.fbtn, { backgroundColor: brand.softGreen }]} onPress={() => vote(1)}><AppText style={{ fontFamily: font.bold }} color={brand.green}>{t('نعم')}</AppText></Pressable>
                    <Pressable style={[st.fbtn, { backgroundColor: brand.softPink }]} onPress={() => vote(0)}><AppText style={{ fontFamily: font.bold }} color={brand.pinkDeep}>{t('لا')}</AppText></Pressable>
                    <Pressable style={[st.fbtn, { backgroundColor: brand.chip }]} onPress={() => vote(null)}><AppText style={{ fontFamily: font.semibold }} muted>{t('ما أدري')}</AppText></Pressable>
                  </View>
                </View>
              ) : null}
              {factMsg ? <AppText variant="tiny" color={brand.green} style={{ marginTop: 6, fontFamily: font.semibold }}>{factMsg}</AppText> : null}
            </View>
          ) : null}

          {/* جواز السعودية: ختم الزيارة */}
          {F.passport && p.lat && p.lng ? (
            <View style={st.stampCard}>
              <Badge icon="flag" bg={social?.been ? brand.softGreen : brand.softOrange} fg={social?.been ? brand.green : brand.orangeDeep} size={44} r={14} />
              <View style={{ flex: 1 }}>
                <AppText style={{ fontFamily: font.bold }}>{social?.been ? t('مختوم في جوازك ✓') : t('أنت هنا الحين؟')}</AppText>
                <AppText variant="small" muted>{social?.been ? t('زيارتك محسوبة في جواز السعودية') : t('اختم جوازك واكسب نقاط')}</AppText>
              </View>
              {!social?.been ? (
                <Pressable style={st.stampBtn} onPress={stamp} disabled={stamping}>
                  {stamping ? <ActivityIndicator color="#fff" /> : <AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>{t('اختم')}</AppText>}
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* الموقع */}
          {p.lat && p.lng ? (
            <Pressable style={st.mapCard} onPress={() => openDirections(p.lat, p.lng, p.title)}>
              <View style={st.mapArt} pointerEvents="none">
                <MapCanvas lite zoom={0.008} places={[p]} center={{ lat: p.lat, lng: p.lng }} selected={p.id} onSelect={() => {}} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
                <AppText variant="small" style={{ flex: 1 }} numberOfLines={1}>{p.address || cityName(p.city)}</AppText>
                <View style={st.dirBtn}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={brand.purple}>{t('الاتجاهات')}</AppText></View>
              </View>
            </Pressable>
          ) : null}

          {p.addedBy ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
              <Icon name="star" color={brand.orangeDeep} size={16} />
              <AppText variant="small" color={brand.orangeDeep} style={{ fontFamily: font.semibold }}>{t('أضافه للدليل:')} {p.addedBy}</AppText>
            </View>
          ) : null}

          {/* اقتراح تعديل */}
          {F.suggest ? (
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }} onPress={() => (user ? router.push({ pathname: '/suggest', params: { place: String(p.id), title: p.title } }) : router.push('/login'))}>
              <Icon name="edit" color={brand.link} size={16} />
              <AppText variant="small" color={brand.link} style={{ fontFamily: font.semibold }}>{t('معلومة غلط أو المكان مقفل؟ اقترح تعديل')}</AppText>
            </Pressable>
          ) : null}

          {/* تواصل */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {p.phone ? <Contact icon="phone" label={t('اتصال')} on={() => Linking.openURL(`tel:${p.phone}`)} /> : null}
            {extLink(p.website) ? <Contact icon="globe" label={tr('الموقع', 'Website')} on={() => WebBrowser.openBrowserAsync(extLink(p.website))} /> : null}
          </View>
        </View>

        {/* الأسئلة */}
        <View style={st.secRow}><AppText variant="section">{t('أسأل اللي زاروه')}</AppText>{qs.length ? <AppText variant="small" muted>{t('{n} مشاركة', { n: qs.length })}</AppText> : null}</View>
        {qs.slice(0, 3).map((q) => (
          <Pressable key={q.id} style={st.qa} onPress={() => router.push(`/question/${q.id}`)}>
            <AppText style={{ fontFamily: font.bold }} numberOfLines={2}>{q.text}</AppText>
            {q.bestAnswer ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Avatar t={initial(q.bestAnswer.name)} c={brand.lilac} size={32} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><AppText style={{ fontFamily: font.bold, fontSize: 13 }}>{q.bestAnswer.name}</AppText>{q.bestAnswer.badge ? <Pill label={q.bestAnswer.badge} bg={brand.purple} fg="#fff" /> : null}</View>
                  <AppText variant="small" muted numberOfLines={2}>{q.bestAnswer.text}</AppText>
                </View>
              </View>
            ) : (
              <AppText variant="tiny" muted style={{ marginTop: 6 }}>{q.author.name} · {ago(q.created)} · {q.answers ? nAnswers(q.answers) : t('بانتظار أول إجابة')}</AppText>
            )}
          </Pressable>
        ))}
        {!qs.length ? <AppText variant="small" muted style={{ paddingHorizontal: 20, paddingBottom: 4 }}>{t('ما أحد سأل عن المكان للحين. كن أول واحد.')}</AppText> : null}
        <Pressable style={st.ask} onPress={() => router.push({ pathname: '/ask', params: { kind: 'question', placeId: String(p.id), place: p.title, city: p.city } })}>
          <AppText muted style={{ flex: 1 }}>{t('عندك سؤال عن المكان؟')}</AppText>
          <AppText style={{ fontFamily: font.bold }} color={brand.purple}>{t('اسأل')}</AppText>
        </Pressable>
        {/* أسئلة جاهزة بضغطة: تروح لأهل المدينة */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 10 }}>
          {['فيه مواقف قريبة؟', 'زحمة هالأيام؟', 'مناسب للأطفال؟', 'وش أحسن وقت للزيارة؟', 'الأسعار غالية؟'].map((q) => t(q)).map((q) => (
            <Pressable key={q} style={st.quickQ} onPress={() => router.push({ pathname: '/ask', params: { kind: 'question', placeId: String(p.id), place: p.title, city: p.city, text: q } })}>
              <AppText variant="small" color={brand.purple} style={{ fontFamily: font.semibold }}>{q}</AppText>
            </Pressable>
          ))}
        </ScrollView>

        {/* فيديوهات الزوار */}
        {F.photos ? <PlaceVideos placeId={p.id} /> : null}

        {/* الحجز بالعمولة: فنادق قريبة وجولات */}
        <BookStrip city={p.city} lat={p.lat ?? undefined} lng={p.lng ?? undefined} place={p.title} kinds={['hotels', 'tours']} title={t('تبي تقعد قريب؟')} />

        {/* التقييمات وصور الزوار */}
        {F.reviews ? (<>
        <View style={st.secRow}>
          <AppText variant="section">{t('التقييمات')}</AppText>
          {rv?.count ? <AppText variant="small" muted>{t('{n} تقييم', { n: rv.count })}</AppText> : null}
        </View>
        {rv?.count ? (
          <View style={st.rvHead}>
            <View style={{ alignItems: 'center', width: 86 }}>
              <AppText style={{ fontFamily: font.bold, fontSize: 34, lineHeight: 44 }} color={brand.orangeDeep}>{rv.avg}</AppText>
              <AppText variant="small" color={brand.orange}>{'★'.repeat(Math.floor(rv.avg ?? 0))}</AppText>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              {[5, 4, 3, 2, 1].map((n) => (
                <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppText variant="tiny" muted style={{ width: 10 }}>{n}</AppText>
                  <View style={st.rvTrack}><View style={[st.rvFill, { width: `${((rv.dist[n] ?? 0) / rv.count) * 100}%` }]} /></View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {rv?.tags.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginTop: 10 }}>
            {rv.tags.map((g) => <Pill key={g.t} label={`${g.t} · ${g.n}`} bg={brand.softGreen} fg={brand.green} />)}
          </View>
        ) : null}
        {F.photos && rv?.photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
            {rv.photos.map((ph) => (
              <Pressable key={ph.id} onPress={() => setShot(ph.url)}>
                <Image source={ph.url} style={{ width: 110, height: 110, borderRadius: 16 }} contentFit="cover" />
                <AppText variant="tiny" muted numberOfLines={1} style={{ width: 110, marginTop: 2 }}>{ph.name}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {(rv?.reviews ?? []).slice(0, 4).map((r) => (
          <View key={r.id} style={st.qa}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar t={initial(r.author.name)} c={tint(r.author.id)} size={34} />
              <View style={{ flex: 1 }}>
                <AppText style={{ fontFamily: font.bold, fontSize: 14 }}>{r.author.name}{r.mine ? t(' (أنت)') : ''}</AppText>
                <AppText variant="tiny" muted>{ago(r.updated)}{r.author.city ? ` · ${cityName(r.author.city)}` : ''}</AppText>
              </View>
              <AppText color={brand.orange} style={{ fontSize: 14 }}>{'★'.repeat(r.stars)}<AppText color={brand.line} style={{ fontSize: 14 }}>{'★'.repeat(5 - r.stars)}</AppText></AppText>
            </View>
            {r.tags.length ? <AppText variant="tiny" color={brand.green} style={{ marginTop: 6, fontFamily: font.semibold }}>{r.tags.join(' · ')}</AppText> : null}
            {r.text ? <AppText variant="small" style={{ marginTop: 6, lineHeight: 22 }}>{r.text}</AppText> : null}
            {r.photos.length ? (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                {r.photos.slice(0, 3).map((u) => <Pressable key={u} onPress={() => setShot(u)}><Image source={u} style={{ width: 70, height: 70, borderRadius: 12 }} contentFit="cover" /></Pressable>)}
              </View>
            ) : null}
            {!r.mine && user ? (
              <Pressable hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => Alert.alert(t('بلاغ عن التقييم'), t('التقييم فيه إساءة أو كلام غير لائق؟'), [{ text: t('إلغاء'), style: 'cancel' }, { text: t('بلّغ'), style: 'destructive', onPress: () => reportReview(r.id).then(() => Alert.alert(t('وصلنا البلاغ'), t('نراجعه في أقرب وقت. شكراً لك.'))).catch(() => {}) }])}>
                <AppText variant="tiny" muted>{t('بلاغ')}</AppText>
              </Pressable>
            ) : null}
          </View>
        ))}
        {rv && !rv.count ? <AppText variant="small" muted style={{ paddingHorizontal: 20 }}>{t('ما أحد قيّم المكان للحين. زرته؟ كن أول واحد.')}</AppText> : null}
        {rv?.myPending ? <AppText variant="tiny" color={brand.orangeDeep} style={{ paddingHorizontal: 20, marginTop: 8 }}>{rv.myPending === 1 ? tr('عندك صورة تنراجع الحين، وتنزل هنا بعد الموافقة.', 'Your photo is being reviewed and will show here once approved.') : tr(`عندك ${rv.myPending} صور تنراجع الحين، وتنزل هنا بعد الموافقة.`, `Your ${rv.myPending} photos are being reviewed and will show here once approved.`)}</AppText> : null}
        <Pressable style={[st.ask, { borderColor: brand.orange }]} onPress={() => router.push({ pathname: '/review/[id]', params: { id: String(p.id) } })}>
          <Icon name="star" color={brand.orange} size={20} />
          <AppText muted style={{ flex: 1, marginHorizontal: 8 }}>{rv?.mine ? `${t('تقييمك:')} ${'★'.repeat(rv.mine.stars)}` : t('زرته؟ قيّم تجربتك وأضف صورك')}</AppText>
          <AppText style={{ fontFamily: font.bold }} color={brand.orangeDeep}>{rv?.mine ? t('عدّل') : t('قيّم')}</AppText>
        </Pressable>
        </>) : null}

        {/* قريب منه */}
        {others.length ? (
          <>
            <View style={st.secRow}><AppText variant="section">{t('قريب منه')}</AppText></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
              {others.map((o) => (
                <Pressable key={o.id} style={{ width: 150 }} onPress={() => router.push(`/place/${o.id}`)}>
                  <Image source={o.thumb} style={{ width: 150, height: 110, borderRadius: 18 }} contentFit="cover" />
                  <AppText style={{ fontFamily: font.bold, fontSize: 14, marginTop: 6 }} numberOfLines={1}>{o.title}</AppText>
                  <AppText variant="tiny" muted>{o.cat}{o.km != null ? ` · ${o.km < 1 ? t('{n} م', { n: Math.round(o.km * 1000) }) : t('{n} كم', { n: o.km })}` : ''}</AppText>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
        {pull.footer}
      </ScrollView>

      <Modal visible={!!shot} transparent animationType="fade" onRequestClose={() => setShot(null)}>
        <Pressable style={st.viewer} onPress={() => setShot(null)}>
          {shot ? <Image source={shot} style={{ width: '100%', height: '80%' }} contentFit="contain" /> : null}
          <AppText variant="small" color="#fff" style={{ marginTop: 10 }}>{t('اضغط للإغلاق')}</AppText>
        </Pressable>
      </Modal>
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label={saved ? t('✓ في رحلتي') : t('أضف لرحلتي')} icon={saved ? undefined : 'plus'} style={{ flex: 1.4 }} onPress={() => { if (!saved) track('trip_add', p.id); trip.toggle(p.id); }} />
          <Button label={t('الاتجاهات')} bg={brand.ink} style={{ flex: 1 }} onPress={() => { track('directions', p.id); openDirections(p.lat, p.lng, p.title); }} />
        </View>
        {/* بانر ثابت تحت الأزرار، بمسافة كافية عنها عشان ما ينضغط بالغلط (سياسة AdMob) */}
        <BannerSlot sticky city={p.city} />
      </View>
    </Animated.View>
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
  summary: { marginTop: 4, backgroundColor: brand.softPurple, borderRadius: 18, padding: 14, gap: 6 },
  quickQ: { borderRadius: 999, borderWidth: 1.5, borderColor: brand.softPurple, backgroundColor: brand.card, paddingHorizontal: 14, paddingVertical: 8 },
  stampCard: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderRadius: 20, padding: 12, borderWidth: 1.5, borderColor: brand.line },
  stampBtn: { backgroundColor: brand.orange, borderRadius: 12, paddingHorizontal: 18, height: 38, justifyContent: 'center', minWidth: 64, alignItems: 'center' },
  thumbs: { position: 'absolute', bottom: 46, left: 16, flexDirection: 'row', gap: 8 },
  thumb: { width: 48, height: 48, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  thumbMore: { backgroundColor: 'rgba(43,39,69,0.8)', alignItems: 'center', justifyContent: 'center' },
  noPhoto: { height: 380, paddingTop: 110, alignItems: 'center' },
  noPhotoIcon: { width: 96, height: 96, borderRadius: 32, backgroundColor: brand.card, alignItems: 'center', justifyContent: 'center' },
  noPhotoBtns: { position: 'absolute', bottom: 48, right: 16, left: 16, flexDirection: 'row', gap: 8 },
  noPhotoBtn: { flex: 1, height: 46, borderRadius: 14, backgroundColor: brand.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  topBtns: { position: 'absolute', right: 16, left: 16, flexDirection: 'row', justifyContent: 'space-between' },
  sheet: { marginTop: -30, backgroundColor: brand.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 22 },
  facts: { flexDirection: 'row', gap: 8, marginTop: 16 },
  fact: { flex: 1, backgroundColor: brand.card, borderRadius: 18, paddingVertical: 12 },
  tip: { marginTop: 16, backgroundColor: brand.purple, borderRadius: 22, padding: 14, flexDirection: 'row', gap: 12 },
  mapCard: { marginTop: 14, backgroundColor: brand.card, borderRadius: 22, overflow: 'hidden' },
  mapArt: { height: 150, backgroundColor: '#EEF0EA', overflow: 'hidden' },
  mapRoad: { position: 'absolute', left: 0, right: 0, top: 50, height: 8, backgroundColor: brand.card },
  mapRoad2: { position: 'absolute', top: 0, bottom: 0, left: 120, width: 8, backgroundColor: brand.card, transform: [{ rotate: '20deg' }] },
  mapPin: { width: 26, height: 26, borderRadius: 13, backgroundColor: brand.orange, borderWidth: 4, borderColor: '#fff' },
  dirBtn: { backgroundColor: brand.chip, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: brand.card, borderRadius: 14, padding: 8, paddingLeft: 14 },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
  qa: { marginHorizontal: 16, marginBottom: 10, backgroundColor: brand.card, borderRadius: 22, padding: 14 },
  ask: { marginHorizontal: 16, marginTop: 10, height: 52, borderRadius: 16, borderWidth: 1.5, borderColor: brand.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  facts2: { marginTop: 14, backgroundColor: brand.card, borderRadius: 20, padding: 14 },
  fbtn: { flex: 1, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rvHead: { marginHorizontal: 16, backgroundColor: brand.card, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rvTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: brand.chip },
  rvFill: { height: '100%', borderRadius: 3, backgroundColor: brand.orange },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: brand.bg },
});
