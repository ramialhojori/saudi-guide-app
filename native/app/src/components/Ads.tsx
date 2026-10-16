import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { adsLib, rewardedAvailable, unitId, useAdFreeUntil, useAds, watchForAdFree } from '@/lib/ads';
import { Icon } from './Icon';
import { alert } from '@/lib/alert';
import { t } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** إعلان مدمج بنفس شكل بطاقة المكان: صورة، عنوان، سطر، زر — ومكتوب عليه «إعلان». يختفي لو ما وصل إعلان */
export function NativeAdCard({ style }: { style?: object }) {
  const on = useAds();
  const [ad, setAd] = useState<any>(null);
  useEffect(() => {
    if (!on) return;
    let alive = true, cur: any = null;
    adsLib().NativeAd.createForAdRequest(unitId('native'), { requestNonPersonalizedAdsOnly: false })
      .then((a: any) => { if (alive) { cur = a; setAd(a); } else a.destroy(); })
      .catch(() => {});
    return () => { alive = false; cur?.destroy?.(); };
  }, [on]);
  if (!on || !ad) return null;
  const L = adsLib();
  const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = L;
  const img = ad.images?.[0]?.url || ad.icon?.url;
  return (
    <View style={style}>
    <NativeAdView nativeAd={ad} style={st.card}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {img ? <NativeMediaView style={st.media} resizeMode="cover" /> : null}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={st.tag}><AppText style={st.tagTx}>{t('إعلان')}</AppText></View>
            {ad.advertiser ? <NativeAsset assetType={NativeAssetType.ADVERTISER}><AppText variant="tiny" muted numberOfLines={1} style={{ flexShrink: 1 }}>{ad.advertiser}</AppText></NativeAsset> : null}
          </View>
          <NativeAsset assetType={NativeAssetType.HEADLINE}><AppText style={{ fontFamily: font.bold, fontSize: 15 }} numberOfLines={1}>{ad.headline}</AppText></NativeAsset>
          {ad.body ? <NativeAsset assetType={NativeAssetType.BODY}><AppText variant="small" muted numberOfLines={2}>{ad.body}</AppText></NativeAsset> : null}
        </View>
      </View>
      {ad.callToAction ? (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <View style={st.cta}><AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>{ad.callToAction}</AppText></View>
        </NativeAsset>
      ) : null}
    </NativeAdView>
    <View style={{ alignItems: 'center', paddingTop: 6 }}><HideAdsLink /></View>
    </View>
  );
}

/** بانر صغير يتكيّف مع عرض الشاشة (آخر الخبر وصفحة المكان بس) */
export function BannerSlot({ style }: { style?: object }) {
  const on = useAds();
  const [failed, setFailed] = useState(false);
  if (!on || failed) return null;
  const { BannerAd, BannerAdSize } = adsLib();
  return (
    <View style={[{ alignItems: 'center', marginVertical: 10 }, style]}>
      <AppText variant="tiny" muted style={{ marginBottom: 4 }}>{t('إعلان')}</AppText>
      <BannerAd unitId={unitId('banner')} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} onAdFailedToLoad={() => setFailed(true)} />
    </View>
  );
}

/** «أخفِ الإعلانات ساعة» (رابط صغير تحت الإعلان) */
function HideAdsLink() {
  const [busy, setBusy] = useState(false);
  if (!rewardedAvailable()) return null;
  return (
    <Pressable onPress={async () => { setBusy(true); const ok = await watchForAdFree(); setBusy(false); if (!ok) alert(t('ما اكتمل الإعلان'), t('لازم تشاهد الإعلان للنهاية عشان تنخفي الإعلانات.')); }} hitSlop={6} disabled={busy}>
      <AppText variant="tiny" color={brand.purple} style={{ fontFamily: font.bold }}>{busy ? t('لحظة…') : t('شاهد إعلان قصير وأخفِ الإعلانات ساعة')}</AppText>
    </Pressable>
  );
}

/** بطاقة «بدون إعلانات لمدة ساعة» (صفحة المزيد): زر مشاهدة إعلان، أو كم باقي من الساعة */
export function AdFreeCard({ style }: { style?: object }) {
  const on = useAds();
  const until = useAdFreeUntil();
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  useEffect(() => { if (!until) return; const i = setInterval(() => force((x) => x + 1), 30000); return () => clearInterval(i); }, [until]);
  if (until) {
    const m = Math.max(1, Math.round((until - Date.now()) / 60000));
    return (
      <View style={[st.free, style]}>
        <View style={[st.freeIc, { backgroundColor: brand.green }]}><Icon name="check" color="#fff" size={20} /></View>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontFamily: font.bold }}>{t('التطبيق بدون إعلانات')}</AppText>
          <AppText variant="small" muted>{t('باقي {n} دقيقة', { n: m })}</AppText>
        </View>
      </View>
    );
  }
  if (!on || !rewardedAvailable()) return null;
  return (
    <Pressable style={[st.free, style]} disabled={busy} onPress={async () => { setBusy(true); const ok = await watchForAdFree(); setBusy(false); if (!ok) alert(t('ما اكتمل الإعلان'), t('لازم تشاهد الإعلان للنهاية عشان تنخفي الإعلانات.')); }}>
      <View style={st.freeIc}>{busy ? <ActivityIndicator color="#fff" /> : <Icon name="cam" color="#fff" size={20} />}</View>
      <View style={{ flex: 1 }}>
        <AppText style={{ fontFamily: font.bold }}>{t('ساعة بدون إعلانات')}</AppText>
        <AppText variant="small" muted>{t('شاهد إعلان قصير، ونخفي كل الإعلانات ساعة كاملة')}</AppText>
      </View>
      <Icon name="chevron" color={brand.muted} size={18} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  free: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderRadius: 18, padding: 12, marginBottom: 12 },
  freeIc: { width: 40, height: 40, borderRadius: 13, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: brand.card, borderRadius: 20, padding: 10, gap: 10 },
  media: { width: 86, height: 86, borderRadius: 14, backgroundColor: brand.chip, overflow: 'hidden' },
  tag: { backgroundColor: brand.chip, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  tagTx: { fontSize: 10.5, fontFamily: font.bold, color: brand.muted },
  cta: { backgroundColor: brand.purple, borderRadius: 12, height: 38, alignItems: 'center', justifyContent: 'center' },
});
