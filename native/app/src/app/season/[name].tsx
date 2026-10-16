import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Empty, Loading } from '@/components/State';
import { BackButton, Chip, Pill, RoundButton } from '@/components/ui';
import { cityName, getEvents } from '@/lib/content';
import { getSeasonMeta, seasonsFrom, seasonStatus, countEvents, toggleFollow, useFollowed, seasonLabel } from '@/lib/seasons';
import { riyadhDate } from '@/lib/text';
import { useAsync } from '@/lib/useAsync';
import type { EventItem } from '@/lib/types';
import { brand, font, photos } from '@/theme/tokens';
import { isEn, t } from '@/lib/i18n';

const WD = isEn ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ksaKey = (t: number) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10);

/** صفحة الموسم: الصورة واللون، العداد، المناطق، الفعاليات بالأيام، والمستمرة، ومتابعة الموسم */
export default function SeasonScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const title = decodeURIComponent(name);
  const insets = useSafeAreaInsets();
  const { data, loading } = useAsync(getEvents, []);
  const { data: meta, loading: ml } = useAsync(getSeasonMeta, []);
  const followed = useFollowed();
  const [zone, setZone] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

  const s = seasonsFrom(data ?? [], Date.now(), meta ?? []).find((x) => x.name === title);
  if (!s && ml) return <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}><BackButton /><Loading /></View>;
  if (!s) return <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}><BackButton />{loading ? <Loading /> : <Empty title={t('الموسم خلص أو ما لقيناه')} />}</View>;

  const list = zone ? s.events.filter((e) => (e.address || '').startsWith(zone)) : s.events;
  const long = (e: EventItem) => !!e.end && new Date(e.end).getTime() - new Date(e.start).getTime() > 14 * 86400e3;
  const dated = list.filter((e) => !long(e)), ongoing = list.filter(long);
  const groups = new Map<string, EventItem[]>();
  for (const e of dated) { const k = ksaKey(Math.max(new Date(e.start).getTime(), now)); groups.set(k, [...(groups.get(k) ?? []), e]); }
  const until = s.live ? s.end - now : s.start - now;
  const cd = { d: Math.floor(until / 864e5), h: Math.floor((until % 864e5) / 36e5), m: Math.floor((until % 36e5) / 6e4) };
  const isFollowed = followed.includes(s.name);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={[st.hero, { backgroundColor: s.color }]}>
        <Image source={s.cover ? { uri: s.cover } : photos[s.photo]} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(0,0,0,0.05)', s.color + 'F2']} locations={[0.2, 0.95]} style={StyleSheet.absoluteFill} />
        <View style={[st.top, { top: insets.top + 10 }]}>
          <BackButton light />
          <RoundButton icon="share" label={t('مشاركة')} onPress={() => Share.share({ message: t('{name} على دليل السعودية', { name: s.name }) }).catch(() => {})} />
        </View>
        <View style={st.heroTx}>
          <View style={st.live}><View style={[st.liveDot, { backgroundColor: s.live ? '#7CFC9A' : brand.orange }]} /><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{seasonStatus(s, now)}</AppText></View>
          <AppText variant="hero" color="#fff" style={{ fontSize: 36, lineHeight: 48 }}>{seasonLabel(s.name)}</AppText>
          <AppText variant="small" color="#F2ECF8">{s.line}</AppText>
          {s.returning ? null : <AppText variant="small" color="#F2ECF8" style={{ marginTop: 4 }}>{riyadhDate(new Date(s.start).toISOString(), false)} – {riyadhDate(new Date(s.end).toISOString(), false)} · {countEvents(s.events.length)}</AppText>}
        </View>
      </View>

      {/* العداد + المتابعة */}
      <View style={st.panel}>
        {s.returning ? (
          <AppText style={{ fontFamily: font.semibold, lineHeight: 26 }}>{t('الموسم انتهى ويرجع كل سنة')}{s.when ? ` (${t('عادة')} ${s.when})` : ''}{t('. تابعه ونبلغك أول ما تنعلن مواعيده وفعالياته.')}</AppText>
        ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {[[cd.d, t('يوم')], [cd.h, t('ساعة')], [cd.m, t('دقيقة')]].map(([v, l]) => (
            <View key={l} style={[st.cbox, { backgroundColor: s.color + '18' }]}>
              <AppText style={{ fontFamily: font.bold, fontSize: 22, lineHeight: 28 }} color={s.color} center>{String(v).padStart(2, '0')}</AppText>
              <AppText variant="tiny" muted center>{l}</AppText>
            </View>
          ))}
          <AppText variant="small" style={{ flex: 1, fontFamily: font.semibold }}>{s.live ? t('على الختام') : t('على الافتتاح')}</AppText>
        </View>
        )}
        <Pressable onPress={() => toggleFollow(s.name)} style={[st.follow, { backgroundColor: isFollowed ? brand.green : s.color }]}>
          <Icon name={isFollowed ? 'check' : 'bell'} color="#fff" size={18} />
          <AppText style={{ fontFamily: font.bold }} color="#fff">{isFollowed ? t('تتابع الموسم') : t('تابع الموسم')}</AppText>
        </Pressable>
        <AppText variant="tiny" muted center style={{ marginTop: 6 }}>{isFollowed ? t('بنرسل لك الفعاليات الجديدة أول بأول') : t('توصلك فعالياته الجديدة أول ما تنضاف')}</AppText>
        {s.link ? <Pressable onPress={() => WebBrowser.openBrowserAsync(s.link).catch(() => {})} style={{ marginTop: 10 }}><AppText center color={brand.link} style={{ fontFamily: font.bold }}>{t('الموقع الرسمي للموسم ↗')}</AppText></Pressable> : null}
      </View>

      {/* المناطق */}
      {s.zones.length > 1 ? (
        <>
          <AppText variant="section" style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 }}>{t('مناطق الموسم')}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            <Chip label={`${t('الكل')} · ${s.events.length}`} on={!zone} color={s.color} onPress={() => setZone(null)} />
            {s.zones.map((z) => <Chip key={z.name} label={`${z.name} · ${z.n}`} on={zone === z.name} color={s.color} onPress={() => setZone(zone === z.name ? null : z.name)} />)}
          </ScrollView>
        </>
      ) : null}

      {[...groups.entries()].map(([k, evs]) => {
        const d = new Date(k + 'T00:00:00Z');
        return (
          <View key={k}>
            <View style={st.dayHead}><View style={[st.dot, { backgroundColor: s.color }]} /><AppText style={{ fontFamily: font.bold, fontSize: 14 }} color={s.color}>{WD[d.getUTCDay()]} {riyadhDate(k + 'T12:00:00+03:00', false)}</AppText></View>
            <View style={{ gap: 10, paddingHorizontal: 16 }}>
              {evs.map((e) => (
                <Pressable key={e.id} style={st.row} onPress={() => router.push(`/event/${e.id}`)}>
                  <Image source={e.thumb || e.image || photos.fest} style={st.rowImg} contentFit="cover" />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      {(e.cats || []).filter((c) => c !== s.name).slice(0, 1).map((c) => <Pill key={c} label={c} bg={s.color + '18'} fg={s.color} />)}
                      <AppText variant="tiny" muted>{riyadhDate(e.start).split('·')[1]?.trim()}</AppText>
                    </View>
                    <AppText style={{ fontFamily: font.bold, fontSize: 15 }} numberOfLines={2}>{e.title}</AppText>
                    <AppText variant="small" muted numberOfLines={1}>{(e.address || '').startsWith('http') ? (e.city ? cityName(e.city) : '') : e.address}</AppText>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}

      {ongoing.length ? (
        <>
          <View style={st.dayHead}><View style={[st.dot, { backgroundColor: brand.green }]} /><AppText style={{ fontFamily: font.bold, fontSize: 14 }} color={brand.green}>{t('طول الموسم · تزورها أي يوم')}</AppText></View>
          <View style={{ gap: 10, paddingHorizontal: 16 }}>
            {ongoing.map((e) => (
              <Pressable key={e.id} style={st.row} onPress={() => router.push(`/event/${e.id}`)}>
                <Image source={e.thumb || e.image || photos.fest} style={st.rowImg} contentFit="cover" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="tiny" color={brand.green} style={{ fontFamily: font.semibold }}>{t('حتى')} {riyadhDate(e.end, false)}</AppText>
                  <AppText style={{ fontFamily: font.bold, fontSize: 15 }} numberOfLines={2}>{e.title}</AppText>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hero: { height: 380, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden' },
  top: { position: 'absolute', right: 16, left: 16, flexDirection: 'row', justifyContent: 'space-between' },
  heroTx: { position: 'absolute', right: 20, left: 20, bottom: 44 },
  live: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  panel: { marginHorizontal: 16, marginTop: -28, backgroundColor: brand.card, borderRadius: 24, padding: 14 },
  cbox: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, minWidth: 58 },
  follow: { marginTop: 12, height: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: brand.card, borderRadius: 20, padding: 10 },
  rowImg: { width: 80, height: 80, borderRadius: 16 },
});
