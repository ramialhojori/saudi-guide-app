import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { RichText } from '@/components/RichText';
import { Empty, Loading } from '@/components/State';
import { Avatar, BackButton, Badge, Button, Pill, RoundButton } from '@/components/ui';
import { cityName, getEvent } from '@/lib/content';
import { api } from '@/lib/api';
import { session, useAuth } from '@/lib/auth';
import { initial, tint } from '@/lib/community';
import { openDirections } from '@/lib/maps';
import { extLink, riyadhDate } from '@/lib/text';
import { useAsync } from '@/lib/useAsync';
import { env } from '@/config/env';
import { brand, font, photos } from '@/theme/tokens';
import { track } from '@/lib/track';

const WD = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** صفحة الفعالية — مثل التصميم: عدّاد تنازلي، الموعد، المكان، التذاكر، رايحين */
export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => { if (id) track('event', Number(id)); }, [id]);
  const insets = useSafeAreaInsets();
  const { data: e, loading } = useAsync(() => getEvent(Number(id)), [id]);
  const [going, setGoing] = useState(false);
  const { user } = useAuth();
  const [goers, setGoers] = useState<{ count: number; who: { id: string; name: string }[] }>({ count: 0, who: [] });
  const loadGoing = useCallback(() => {
    api<{ count: number; going: boolean; who: { id: string; name: string }[] }>(`/v1/events/${id}/going`, { token: session().token })
      .then((r) => { setGoing(r.going); setGoers(r); }).catch(() => {});
  }, [id, user?.id]);
  useFocusEffect(loadGoing);
  const toggleGoing = async () => {
    if (!user) return router.push('/login');
    setGoing((v) => !v); setGoers((g) => ({ ...g, count: g.count + (going ? -1 : 1) }));
    await api(`/v1/events/${id}/going`, { method: 'POST', token: session().token }).catch(() => {});
    loadGoing();
  };
  const left = useCountdown(e?.start);

  if (!e) return <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}><BackButton />{loading ? <Loading /> : <Empty title="ما لقينا الفعالية" />}</View>;
  const d = new Date(new Date(e.start).getTime() + 3 * 3600e3);
  const ticket = extLink(e.tickets?.startsWith('http') ? e.tickets : '') || extLink(e.link);

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ height: 420, backgroundColor: brand.ink }}>
          <Image source={e.image || e.thumb || photos.fest} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(32,22,54,0.2)', 'rgba(32,22,54,0.92)']} style={StyleSheet.absoluteFill} />
          <View style={[st.top, { top: insets.top + 10 }]}>
            <BackButton light />
            <RoundButton icon="share" label="مشاركة" onPress={() => Share.share({ message: `${e.title} — في تطبيق دليل السعودية${extLink(e.tickets?.startsWith('http') ? e.tickets : e.link) ? '\n' + extLink(e.tickets?.startsWith('http') ? e.tickets : e.link) : ''}` }).catch(() => {})} />
          </View>
          {left ? (
            <View style={st.count}>
              {[[left.d, 'يوم'], [left.h, 'ساعة'], [left.m, 'دقيقة']].map(([v, l]) => (
                <View key={l} style={st.cbox}><AppText style={{ fontFamily: font.bold, fontSize: 24, lineHeight: 30 }} color="#fff" center>{String(v).padStart(2, '0')}</AppText><AppText variant="tiny" color="#E2DAEE" center>{l}</AppText></View>
              ))}
              <AppText variant="small" color="#fff" style={{ fontFamily: font.semibold }}>على البداية</AppText>
            </View>
          ) : null}
        </View>

        <View style={st.sheet}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(e.cats?.length ? e.cats : ['فعالية']).slice(0, 3).map((c, i) => <Pill key={c} label={c} bg={[brand.softPink, brand.softPurple, brand.softGreen][i]} fg={[brand.pinkDeep, brand.purple, brand.green][i]} />)}
          </View>
          <AppText variant="hero" style={{ marginTop: 8, fontSize: 26, lineHeight: 38 }}>{e.title}</AppText>

          <Pressable style={st.info} onPress={() => Linking.openURL(`${env.apiUrl}/v1/events/${e.id}.ics`).catch(() => {})} accessibilityLabel="أضف للتقويم">
            <Badge icon="cal" bg={brand.softPink} fg={brand.pinkDeep} size={44} r={14} />
            <View style={{ flex: 1 }}>
              <AppText style={{ fontFamily: font.bold }}>{WD[d.getUTCDay()]} {riyadhDate(e.start)}</AppText>
              <AppText variant="small" muted>{e.end ? `حتى ${riyadhDate(e.end, false)} · ` : ''}بتوقيت مكة</AppText>
            </View>
            {e.start ? <View style={st.dir}><AppText variant="small" color={brand.pinkDeep} style={{ fontFamily: font.bold }}>ذكّرني</AppText></View> : null}
          </Pressable>
          <Pressable style={st.info} onPress={() => openDirections(e.lat, e.lng, e.title)}>
            <Badge icon="pin" bg={brand.softSky} fg={brand.skyDeep} size={44} r={14} />
            <View style={{ flex: 1 }}>
              <AppText style={{ fontFamily: font.bold }} numberOfLines={1}>{e.address || (e.city ? cityName(e.city) : 'الموقع')}</AppText>
              <AppText variant="small" muted>{e.city ? cityName(e.city) : ''}</AppText>
            </View>
            {e.lat && e.lng ? <View style={st.dir}><AppText variant="small" color={brand.purple} style={{ fontFamily: font.bold }}>الاتجاهات</AppText></View> : null}
          </Pressable>

          {e.body ? <View style={{ marginTop: 16 }}><RichText html={e.body} /></View> : e.summary ? <AppText style={{ marginTop: 16 }}>{e.summary}</AppText> : null}

          <View style={st.going}>
            <View style={{ flexDirection: 'row' }}>
              {goers.who.map((w, i) => <View key={w.id} style={{ marginRight: i ? -10 : 0 }}><Avatar t={initial(w.name)} c={tint(w.id)} size={32} /></View>)}
            </View>
            <AppText variant="small" style={{ flex: 1 }}>{goers.count ? <><AppText variant="small" style={{ fontFamily: font.bold }} color={brand.purple}>{goers.count.toLocaleString('en')}</AppText> {goers.count === 1 ? 'شخص رايح' : 'رايحين من الدليل'}</> : 'كن أول واحد رايح'}</AppText>
            <Pressable onPress={toggleGoing} style={[st.goBtn, going && { backgroundColor: brand.green }]}>
              <AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>{going ? '✓ رايح' : 'أنا رايح'}</AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {ticket ? (
        <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button label={extLink(e.tickets?.startsWith('http') ? e.tickets : '') ? 'احجز تذكرتك' : 'الموقع الرسمي للفعالية'} style={{ flex: 1 }}
            onPress={() => { WebBrowser.openBrowserAsync(ticket).catch(() => {}); }} />
        </View>
      ) : null}
    </View>
  );
}

function useCountdown(start?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  if (!start) return null;
  const ms = new Date(start).getTime() - now;
  if (ms <= 0) return null;
  return { d: Math.floor(ms / 864e5), h: Math.floor((ms % 864e5) / 36e5), m: Math.floor((ms % 36e5) / 6e4) };
}

const st = StyleSheet.create({
  top: { position: 'absolute', right: 16, left: 16, flexDirection: 'row', justifyContent: 'space-between' },
  count: { position: 'absolute', bottom: 50, right: 20, left: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cbox: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, minWidth: 62 },
  sheet: { marginTop: -30, backgroundColor: brand.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 22 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderRadius: 20, padding: 12, marginTop: 12 },
  dir: { backgroundColor: brand.chip, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  going: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderRadius: 20, padding: 12, marginTop: 16 },
  goBtn: { backgroundColor: brand.pink, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, backgroundColor: brand.bg },
});
