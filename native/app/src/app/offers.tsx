import { useCallback, useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Chip } from '@/components/ui';
import { allCities, cityName } from '@/lib/content';
import { useFeatures } from '@/lib/features';
import { t } from '@/lib/i18n';
import { CHANNEL, daysLeft, getOffers, OFFER_CATS, offBadge, offerOpened, type Offer } from '@/lib/offers';
import { brand, font } from '@/theme/tokens';

const CAT_COLOR: Record<string, string> = { food: brand.orange, cafe: '#8E65AB', hotel: brand.purple, fun: brand.pinkDeep, shop: '#2E86B8', other: brand.orangeDeep };

/** العروض والكوبونات: عروض البنوك والمتاجر وتطبيقات التوصيل (من مصادرها الرسمية) + رابط لكوبونات المحلات */
export default function Offers() {
  const insets = useSafeAreaInsets();
  const F = useFeatures();
  const [city, setCity] = useState('');
  const [cat, setCat] = useState('');
  const [list, setList] = useState<Offer[] | null>(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setErr(false);
    try { setList(await getOffers(city || undefined)); } catch { setErr(true); setList((l) => l ?? []); }
  }, [city]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cats = OFFER_CATS.filter(([k]) => (list ?? []).some((o) => o.category === k));
  const shown = useMemo(() => (list ?? []).filter((o) => !cat || o.category === cat), [list, cat]);

  const copy = async (o: Offer) => {
    await Clipboard.setStringAsync(o.code).catch(() => {});
    setCopied(o.id); setTimeout(() => setCopied((x) => (x === o.id ? null : x)), 2000);
    offerOpened(o.id, 'copy');
  };
  const go = (o: Offer) => { if (!o.useUrl) return; offerOpened(o.id, 'open'); Linking.openURL(o.useUrl).catch(() => {}); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <View style={[st.head, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable style={st.glass} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel={t('رجوع')}><Icon name="back" color="#fff" /></Pressable>
          <View style={{ flex: 1 }}>
            <AppText variant="small" color="#FFE6EC">{t('عروض البنوك والمتاجر')}</AppText>
            <AppText variant="title" color="#fff">{t('العروض والكوبونات')}</AppText>
          </View>
          <Icon name="ticket" color="#fff" size={28} />
        </View>
        <AppText variant="small" color="#fff" style={{ marginTop: 10, lineHeight: 21 }}>{t('عروض شغّالة الحين من البنوك والمتاجر وتطبيقات التوصيل. انسخ الكود أو افتح العرض من مصدره.')}</AppText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 14 }}>
        <Chip label={t('كل المدن')} on={!city} color={brand.pinkDeep} onPress={() => { setCity(''); setList(null); }} />
        {allCities.map((c) => <Chip key={c.id} label={c.name} on={city === c.id} color={brand.pinkDeep} onPress={() => { setCity(c.id); setList(null); }} />)}
      </ScrollView>
      {cats.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 10 }}>
          <Chip label={t('الكل')} on={!cat} color={brand.orangeDeep} onPress={() => setCat('')} />
          {cats.map(([k, x]) => <Chip key={k} label={x} on={cat === k} color={brand.orangeDeep} onPress={() => setCat(cat === k ? '' : k)} />)}
        </ScrollView>
      ) : null}

      <View style={{ gap: 12, paddingHorizontal: 16, paddingTop: 14 }}>
        {list === null ? <ActivityIndicator color={brand.pinkDeep} style={{ marginTop: 40 }} /> : null}
        {shown.map((o) => {
          const left = daysLeft(o), color = CAT_COLOR[o.category] || brand.orange, isOpen = open === o.id;
          const badge = offBadge(o);
          return (
            <Pressable key={o.id} style={st.card} onPress={() => setOpen(isOpen ? null : o.id)}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[st.off, { backgroundColor: color }]}>
                  <AppText style={{ fontFamily: font.bold, fontSize: badge.length > 6 ? 12 : 18, lineHeight: badge.length > 6 ? 16 : 24 }} color="#fff" center numberOfLines={2}>{badge}</AppText>
                  {o.unit === 'cashback' && o.value ? <AppText variant="tiny" color="#fff" center>{t('كاش باك')}</AppText> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText style={{ fontFamily: font.bold, fontSize: 15 }} numberOfLines={1}>{o.store}</AppText>
                  <AppText style={{ fontSize: 14, lineHeight: 21 }} numberOfLines={isOpen ? undefined : 2}>{o.title}</AppText>
                  <AppText variant="tiny" muted style={{ marginTop: 2 }}>
                    {[o.city ? cityName(o.city) || o.cityName : t('كل المدن'), CHANNEL[o.channel], o.newOnly ? t('للعملاء الجدد') : ''].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
              </View>

              <View style={st.metaRow}>
                {left != null ? (
                  <View style={[st.pill, left <= 3 && { backgroundColor: brand.softPink }]}>
                    <AppText variant="tiny" color={left <= 3 ? brand.pinkDeep : brand.muted} style={{ fontFamily: font.semibold }}>{left <= 0 ? t('آخر يوم اليوم') : left === 1 ? t('ينتهي بكرة') : t('باقي {n} يوم', { n: left })}</AppText>
                  </View>
                ) : null}
                {o.minOrder ? <View style={st.pill}><AppText variant="tiny" muted>{t('الحد الأدنى {n} ر.س', { n: o.minOrder })}</AppText></View> : null}
                {o.maxDiscount ? <View style={st.pill}><AppText variant="tiny" muted>{t('أقصى خصم {n} ر.س', { n: o.maxDiscount })}</AppText></View> : null}
              </View>

              {o.code ? (
                <View style={st.codeRow}>
                  <View style={st.code}><AppText style={{ fontFamily: font.bold, fontSize: 16, letterSpacing: 1 }} selectable>{o.code}</AppText></View>
                  <Pressable style={[st.copy, copied === o.id && { backgroundColor: brand.green }]} onPress={() => copy(o)} accessibilityLabel={t('انسخ الكود')}>
                    <Icon name={copied === o.id ? 'check' : 'ticket'} color="#fff" size={16} />
                    <AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>{copied === o.id ? t('انتسخ') : t('انسخ')}</AppText>
                  </Pressable>
                </View>
              ) : null}

              {isOpen && o.terms ? <AppText variant="small" muted style={{ lineHeight: 21, marginTop: 10 }}>{o.terms}</AppText> : null}
              {isOpen && o.deliveryApp ? <AppText variant="small" muted style={{ marginTop: 4 }}>{t('عن طريق {app}', { app: o.deliveryApp })}</AppText> : null}

              <View style={st.acts}>
                {o.useUrl ? (
                  <Pressable style={st.goBtn} onPress={() => go(o)}>
                    <AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>{o.channel === 'store' ? t('تفاصيل العرض') : t('روح للعرض')}</AppText>
                  </Pressable>
                ) : null}
                <AppText variant="tiny" color={brand.link} style={{ fontFamily: font.semibold }}>{isOpen ? t('أقل') : o.terms ? t('الشروط') : ''}</AppText>
              </View>
            </Pressable>
          );
        })}
        {list !== null && !shown.length ? (
          <View style={st.empty}>
            <Icon name="ticket" color={brand.pinkDeep} size={34} />
            <AppText style={{ fontFamily: font.bold, fontSize: 16 }} center>{err ? t('ما قدرنا نجيب العروض') : t('ما فيه عروض هنا للحين')}</AppText>
            <AppText variant="small" muted center>{err ? t('تأكد من النت واسحب الصفحة لتحت.') : t('نضيف عروض جديدة كل كم يوم، ارجع لنا قريب.')}</AppText>
          </View>
        ) : null}
        {shown.length ? <AppText variant="tiny" muted center style={{ marginTop: 6, lineHeight: 18 }}>{t('العروض من مصادرها الرسمية، والشروط النهائية حسب الجهة صاحبة العرض.')}</AppText> : null}
      </View>

      {F.coupons ? (
        <Pressable style={st.biz} onPress={() => router.push('/coupons')}>
          <View style={st.bizIcon}><Icon name="shop" color="#fff" size={22} /></View>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontFamily: font.bold }} color="#fff">{t('كوبونات المحلات')}</AppText>
            <AppText variant="small" color="#CFC6DE">{t('عروض حصرية لمستخدمي الدليل من مطاعم ومقاهي مدينتك')}</AppText>
          </View>
          <Icon name="chevron" color="#fff" size={18} />
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: brand.pink, paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  glass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: brand.card, borderRadius: 22, padding: 14 },
  off: { width: 70, minHeight: 70, borderRadius: 18, alignItems: 'center', justifyContent: 'center', padding: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  pill: { backgroundColor: brand.chip, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  codeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  code: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: brand.orange, alignItems: 'center', justifyContent: 'center', direction: 'ltr' },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: brand.purple, borderRadius: 12, paddingHorizontal: 14, height: 44 },
  acts: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  goBtn: { backgroundColor: brand.orange, borderRadius: 12, paddingHorizontal: 16, height: 38, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, backgroundColor: brand.card, borderRadius: 22, padding: 24, marginTop: 6 },
  biz: { margin: 16, marginTop: 22, backgroundColor: brand.ink, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bizIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
});
