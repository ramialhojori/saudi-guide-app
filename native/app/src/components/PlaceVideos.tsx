import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { alert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { useAsync } from '@/lib/useAsync';
import { getPlaceVideos, pickAndUpload, playerAvailable, type PlaceVideo } from '@/lib/videos';
import { brand, font } from '@/theme/tokens';

/* eslint-disable @typescript-eslint/no-require-imports */
/** مشغّل الفيديو (expo-video) — ينحمّل بس لو موجود في النسخة المثبتة */
function Player({ url }: { url: string }) {
  const { useVideoPlayer, VideoView } = require('expo-video');
  const player = useVideoPlayer(url, (p: { play: () => void; loop: boolean }) => { p.loop = true; p.play(); });
  return <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls allowsFullscreen />;
}

/** «فيديوهات الزوار» في صفحة المكان: المقاطع المعتمدة + زر «أضف فيديو قصير» */
export function PlaceVideos({ placeId }: { placeId: number }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data } = useAsync(() => getPlaceVideos(placeId).catch(() => []), [placeId]);
  const [playing, setPlaying] = useState<PlaceVideo | null>(null);
  const [busy, setBusy] = useState('');

  const open = (v: PlaceVideo) => (playerAvailable() ? setPlaying(v) : WebBrowser.openBrowserAsync(v.url).catch(() => {}));
  const add = () => {
    if (!user) return router.push('/login');
    alert(t('أضف فيديو قصير'), t('مقطع لين دقيقة عن المكان نفسه (الجلسات، الأكل، الإطلالة). تجنّب وجوه الناس بدون إذنهم. نراجعه قبل النشر وتاخذ +20 نقطة.'), [
      { text: t('إلغاء'), style: 'cancel' },
      { text: t('من الاستديو'), onPress: () => upload(false) },
      { text: t('صوّر الحين'), onPress: () => upload(true) },
    ]);
  };
  const upload = async (camera: boolean) => {
    setBusy(t('لحظة…'));
    const err = await pickAndUpload(placeId, camera, setBusy);
    setBusy('');
    if (err === null) alert(t('وصلنا الفيديو، شكراً!'), t('نراجعه ويطلع هنا خلال يوم، ويوصلك إشعار.'));
    else if (err) alert(t('ما انرفع'), err);
  };

  return (
    <View style={{ marginTop: 18 }}>
      <View style={st.head}>
        <AppText variant="section" style={{ flex: 1 }}>{t('فيديوهات الزوار')}</AppText>
        <Pressable style={st.add} onPress={add} disabled={!!busy}>
          {busy ? <ActivityIndicator color={brand.purple} size="small" /> : <Icon name="cam" color={brand.purple} size={16} />}
          <AppText variant="small" color={brand.purple} style={{ fontFamily: font.bold }}>{busy || t('أضف فيديو')}</AppText>
        </Pressable>
      </View>
      {data?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
          {data.map((v, i) => (
            <Pressable key={v.id} style={[st.card, { backgroundColor: [brand.purple, brand.pinkDeep, brand.orangeDeep, brand.skyDeep][i % 4] }]} onPress={() => open(v)}>
              <View style={st.play}><Icon name="play" color="#fff" size={22} /></View>
              <View style={{ position: 'absolute', bottom: 10, right: 10, left: 10 }}>
                {v.caption ? <AppText variant="small" color="#fff" numberOfLines={2} style={{ fontFamily: font.bold }}>{v.caption}</AppText> : null}
                <AppText variant="tiny" color="rgba(255,255,255,0.85)">{v.name}{v.duration ? ` · ${Math.round(v.duration)} ${t('ث')}` : ''}</AppText>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : <AppText variant="small" muted style={{ paddingHorizontal: 16 }}>{t('كن أول واحد يصوّر المكان للزوار.')}</AppText>}
      <Modal visible={!!playing} animationType="slide" onRequestClose={() => setPlaying(null)} presentationStyle="fullScreen">
        <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top }}>
          <Pressable style={st.close} onPress={() => setPlaying(null)} accessibilityLabel={t('إغلاق')}><Icon name="x" color="#fff" size={22} /></Pressable>
          {playing ? <Player url={playing.url} /> : null}
          {playing ? <AppText color="#fff" style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>{playing.caption ? `${playing.caption} · ` : ''}{playing.name}</AppText> : null}
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: brand.chip, borderRadius: 14, paddingHorizontal: 12, height: 34 },
  card: { width: 130, height: 200, borderRadius: 18, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  play: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', top: 50, right: 16, zIndex: 3, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
});
