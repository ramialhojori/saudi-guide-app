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
import { CHANNEL, daysLeft, getOffers, OFFER_CATS, OFFER_STYLE, offBadge, offerOpened, type Offer } from '@/lib/offers';
import { brand, font } from '@/theme/tokens';
import { happyMoment } from '@/lib/review';


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
    happyMoment('offer_copy');
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
          {cats.map(([k, x]) => {
            const on = cat === k, c = OFFER_STYLE[k] || OFFER_STYLE.other;
            const n = (list ?? []).filter((o) => o.category === k).length;
            return (
              <Pressable key={k} onPress={() => setCat(on ? '' : k)} style={[st.catChip, on && { backgroundColor: c.color }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Icon name={c.icon as never} size={15} color={on ? '#fff' : c.color} />
                <AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={on ? '#fff' : brand.text}>{x}</AppText>
                <AppText variant="tiny" color={on ? '#fff' : brand.muted}>{n}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={{ gap: 12, paddingHorizontal: 16, paddingTop: 14 }}>
        {list === null ? <ActivityIndicator color={brand.pinkDeep} style={{ marginTop: 40 }} /> : null}
        {shown.map((o) => <OfferCard key={o.id} o={o} open={open === o.id} copied={copied === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)} onCopy={() => copy(o)} onGo={() => go(o)} />)}
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

/** بطاقة العرض بشكل تذكرة: يمين = الخصم بلون التصنيف، يسار = المتجر والعرض، وتحت = الكود وزر العرض في سطر واحد */
function OfferCard({ o, open, copied, onToggle, onCopy, onGo }: { o: Offer; open: boolean; copied: boolean; onToggle: () => void; onCopy: () => void; onGo: () => void }) {
  const left = daysLeft(o), c = OFFER_STYLE[o.category] || OFFER_STYLE.other, badge = offBadge(o);
  const catName = (OFFER_CATS.find(([k]) => k === o.category) || ['', ''])[1];
  const where = [o.city ? cityName(o.city) || o.cityName : t('كل المدن'), CHANNEL[o.channel]].filter(Boolean).join(' · ');
  const soon = left != null && left <= 3;
  return (
    <Pressable style={st.ticket} onPress={onToggle} accessibilityHint={t('اضغط للشروط')}>
      <View style={{ flexDirection: 'row' }}>
        <View style={[st.stub, { backgroundColor: c.color }]}>
          <AppText style={{ fontFamily: font.bold, fontSize: badge.length > 6 ? 13 : 22, lineHeight: badge.length > 6 ? 18 : 28 }} color="#fff" center numberOfLines={2}>{badge}</AppText>
          <AppText variant="tiny" color="rgba(255,255,255,0.85)" center>{o.unit === 'cashback' ? t('كاش باك') : o.unit === 'pct' || o.unit === 'sar' ? t('خصم') : ' '}</AppText>
        </View>
        {/* خط القص بين الجزأين */}
        <View style={st.perf}>
          <View style={[st.notch, { top: -9 }]} /><View style={st.dash} /><View style={[st.notch, { bottom: -9 }]} />
        </View>
        <View style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingEnd: 14, paddingStart: 4, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={c.icon as never} size={13} color={c.color} />
            <AppText variant="tiny" color={c.color} style={{ fontFamily: font.bold }}>{catName}</AppText>
            {o.newOnly ? <View style={st.newTag}><AppText variant="tiny" color={brand.pinkDeep} style={{ fontFamily: font.bold }}>{t('للعملاء الجدد')}</AppText></View> : null}
          </View>
          <AppText style={{ fontFamily: font.bold, fontSize: 16 }} numberOfLines={1}>{o.store}</AppText>
          <AppText style={{ fontSize: 13.5, lineHeight: 20 }} muted numberOfLines={open ? undefined : 2}>{o.title}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
            <AppText variant="tiny" muted numberOfLines={1} style={{ flexShrink: 1 }}>{where}</AppText>
            {left != null ? <AppText variant="tiny" color={soon ? brand.pinkDeep : brand.muted} style={{ fontFamily: soon ? font.bold : font.regular }}>· {left <= 0 ? t('آخر يوم اليوم') : left === 1 ? t('ينتهي بكرة') : t('باقي {n} يوم', { n: left })}</AppText> : null}
          </View>
        </View>
      </View>

      {o.code || o.useUrl ? (
        <View style={st.bottom}>
          {o.code ? (
            <Pressable style={[st.codeBox, copied && { borderColor: brand.green, backgroundColor: brand.softGreen }]} onPress={onCopy} accessibilityLabel={t('انسخ الكود')}>
              <AppText style={{ fontFamily: font.bold, fontSize: 15, letterSpacing: 1.5 }} numberOfLines={1}>{o.code}</AppText>
              <View style={st.copyTag}><Icon name={copied ? 'check' : 'ticket'} size={13} color={copied ? brand.green : brand.purple} /><AppText variant="tiny" color={copied ? brand.green : brand.purple} style={{ fontFamily: font.bold }}>{copied ? t('انتسخ') : t('انسخ')}</AppText></View>
            </Pressable>
          ) : <AppText variant="small" muted style={{ flex: 1 }}>{t('بدون كود · العرض يطبق تلقائياً')}</AppText>}
          {o.useUrl ? (
            <Pressable style={[st.goBtn, { backgroundColor: c.color }]} onPress={onGo} hitSlop={6}>
              <AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>{o.code ? t('استخدمه') : t('افتح العرض')}</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {open ? (
        <View style={st.terms}>
          {o.minOrder || o.maxDiscount ? <AppText variant="small" style={{ fontFamily: font.semibold }}>{[o.minOrder ? t('الحد الأدنى {n} ر.س', { n: o.minOrder }) : '', o.maxDiscount ? t('أقصى خصم {n} ر.س', { n: o.maxDiscount }) : ''].filter(Boolean).join(' · ')}</AppText> : null}
          {o.deliveryApp ? <AppText variant="small" muted>{t('عن طريق {app}', { app: o.deliveryApp })}</AppText> : null}
          {o.terms ? <AppText variant="small" muted style={{ lineHeight: 21 }}>{o.terms}</AppText> : null}
          {o.sourceUrl ? <Pressable onPress={() => Linking.openURL(o.sourceUrl).catch(() => {})}><AppText variant="tiny" color={brand.link} style={{ fontFamily: font.semibold }}>{t('مصدر العرض')}</AppText></Pressable> : null}
        </View>
      ) : o.terms || o.minOrder || o.maxDiscount ? <AppText variant="tiny" color={brand.link} style={{ fontFamily: font.semibold, paddingHorizontal: 14, paddingBottom: 10 }}>{t('الشروط')}</AppText> : null}
    </Pressable>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: brand.pink, paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  glass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  ticket: { backgroundColor: brand.card, borderRadius: 20, overflow: 'hidden' },
  stub: { width: 92, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 14 },
  perf: { width: 14, alignItems: 'center' },
  dash: { flex: 1, width: 0, borderStartWidth: 1.5, borderStyle: 'dashed', borderColor: brand.chip, marginVertical: 10 },
  notch: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: brand.bg },
  newTag: { backgroundColor: brand.softPink, borderRadius: 6, paddingHorizontal: 6 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: brand.chip, paddingHorizontal: 12, paddingVertical: 10 },
  codeBox: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: brand.lilac, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, gap: 8 },
  copyTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goBtn: { borderRadius: 12, paddingHorizontal: 16, height: 40, justifyContent: 'center' },
  terms: { paddingHorizontal: 14, paddingBottom: 12, gap: 4 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: brand.card },
  empty: { alignItems: 'center', gap: 8, backgroundColor: brand.card, borderRadius: 22, padding: 24, marginTop: 6 },
  biz: { margin: 16, marginTop: 22, backgroundColor: brand.ink, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bizIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
});
