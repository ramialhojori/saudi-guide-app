import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { CouponCard } from '@/components/CouponCard';
import { Icon } from '@/components/Icon';
import { Chip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { allCities, cityName } from '@/lib/content';
import { useFeatures } from '@/lib/features';
import { BIZ_KINDS, OFFER_KINDS, cityCoupons, cityCouponsMe, couponAlert, setCouponAlert, couponErr, myCoupons, toggleSave, type Coupon, type Me } from '@/lib/coupons';
import { t } from '@/lib/i18n';
import { brand, font } from '@/theme/tokens';

/** كوبونات المدينة: عروض حقيقية من التجار بعد موافقة الإدارة، والمحفظة (المحفوظة) */
export default function Coupons() {
  const insets = useSafeAreaInsets();
  const prm = useLocalSearchParams<{ wallet?: string; tab?: string }>();
  const { user } = useAuth();
  const [city, setCity] = useState<string>(user?.city || 'medina');
  const [pick, setPick] = useState(false);
  const [tab, setTab] = useState<'all' | 'points' | 'wallet'>(prm.wallet ? 'wallet' : prm.tab === 'points' ? 'points' : 'all');
  const [me, setMe] = useState<Me>(null);
  const [kind, setKind] = useState('');
  const [offer, setOffer] = useState('');
  const [list, setList] = useState<Coupon[] | null>(null);
  const [wallet, setWallet] = useState<Coupon[]>([]);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [others, setOthers] = useState<Coupon[]>([]);
  const [alertOn, setAlertOn] = useState(false);
  const F = useFeatures();

  const load = useCallback(async () => {
    setErr('');
    try {
      const [a, w] = await Promise.all([cityCouponsMe(city), user ? myCoupons().catch(() => []) : Promise.resolve([])]);
      setList(a.coupons); setMe(a.me); setWallet(w);
      // مدينته ما فيها عروض؟ نجيب عروض المدن الثانية، ونشوف هل طلب تنبيه
      if (!a.coupons.length) {
        cityCoupons(null).then((all) => setOthers(all.filter((c) => c.biz?.city !== city))).catch(() => setOthers([]));
        if (user) couponAlert(city).then(setAlertOn).catch(() => {});
      } else setOthers([]);
    } catch (e) { setErr(couponErr(e)); setList([]); }
  }, [city, user?.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async (c: Coupon) => {
    if (!user) return router.push('/login');
    const on = !c.saved;
    const flip = (x: Coupon) => (x.id === c.id ? { ...x, saved: on } : x);
    setList((l) => l && l.map(flip));
    setWallet((w) => (on ? [...w, { ...c, saved: true }] : w.filter((x) => x.id !== c.id)));
    try { await toggleSave(c.id); } catch { load(); }
  };
  const shown = useMemo(() => {
    const src = tab === 'wallet' ? wallet : tab === 'points' ? (list ?? []).filter((c) => c.points || c.minLevel) : list ?? [];
    return src.filter((c) => (!kind || c.biz?.kind === kind) && (!offer || c.kind === offer));
  }, [tab, wallet, list, kind, offer]);
  const toggleAlert = async () => {
    if (!user) return router.push('/login');
    const on = !alertOn; setAlertOn(on);
    try { await setCouponAlert(city, on); } catch { setAlertOn(!on); }
  };
  const otherCities = useMemo(() => {
    const m = new Map<string, number>();
    others.forEach((c) => c.biz?.city && m.set(c.biz.city, (m.get(c.biz.city) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [others]);
  const kinds = BIZ_KINDS.filter(([k]) => (list ?? []).some((c) => c.biz?.kind === k));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <View style={[st.head, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable style={st.glass} onPress={() => router.back()} accessibilityLabel={t('رجوع')}><Icon name="back" color="#fff" /></Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => setPick((v) => !v)}>
            <AppText variant="small" color="#FFE6EC">{t('كوبونات')}</AppText>
            <AppText variant="title" color="#fff">{cityName(city) || t('اختر المدينة')} ▾</AppText>
          </Pressable>
          <Pressable style={st.wallet} onPress={() => setTab(tab === 'wallet' ? 'all' : 'wallet')}>
            <AppText style={{ fontFamily: font.bold, fontSize: 18 }} color="#fff" center>{wallet.length}</AppText>
            <AppText variant="tiny" color="#fff" center>{t('محفظتي')}</AppText>
          </Pressable>
        </View>
        <AppText variant="small" color="#fff" style={{ marginTop: 12 }}>{t('افتح الكوبون عند الكاشير، ويطلع لك رمز يدخله في جهازه.')}</AppText>
      </View>

      {pick ? (
        <View style={st.cities}>
          {allCities.map((c) => <Chip key={c.id} label={c.name} on={c.id === city} color={brand.pinkDeep} onPress={() => { setCity(c.id); setPick(false); setList(null); }} />)}
        </View>
      ) : null}

      <View style={st.tabs}>
        {([['all', t('كل العروض')], ...(F.points ? [['points', t('بالنقاط')]] : []), ['wallet', t('محفظتي ({n})', { n: wallet.length })]] as ['all' | 'points' | 'wallet', string][]).map(([k, x]) => (
          <Pressable key={k} style={[st.tab, tab === k && st.tabOn]} onPress={() => setTab(k)}><AppText style={{ fontFamily: font.bold, fontSize: 14 }} color={tab === k ? '#fff' : brand.muted} center>{x}</AppText></Pressable>
        ))}
      </View>
      {tab === 'points' ? (
        <View style={st.bal}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontFamily: font.bold }} color="#fff">{user ? t('رصيدك {n} نقطة', { n: me?.balance ?? 0 }) : t('سجّل دخولك واجمع نقاط')}</AppText>
            <AppText variant="small" color="#E2DAEE">{user ? t('مستواك {n}. اجمع نقاط من الأسئلة والإجابات والتقييمات وختم الجواز، واصرفها هنا.', { n: me?.level ?? 1 }) : t('النقاط تجي من المشاركة في المجتمع والتقييمات وختم الجواز.')}</AppText>
          </View>
          <Icon name="star" color="#F9A158" size={30} />
        </View>
      ) : null}
      {(list ?? []).length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <Chip label={t('كل العروض')} on={!offer} color={brand.orangeDeep} onPress={() => setOffer('')} />
          {OFFER_KINDS.map(([k, x]) => <Chip key={k} label={x} on={offer === k} color={brand.orangeDeep} onPress={() => setOffer(offer === k ? '' : k)} />)}
        </ScrollView>
      ) : null}
      {kinds.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 6 }}>
          <Chip label={t('الكل')} on={!kind} color={brand.pinkDeep} onPress={() => setKind('')} />
          {kinds.map(([k, x]) => <Chip key={k} label={x} on={kind === k} color={brand.pinkDeep} onPress={() => setKind(k)} />)}
        </ScrollView>
      ) : null}

      <View style={{ gap: 12, paddingHorizontal: 16, paddingTop: 10 }}>
        {list === null ? <ActivityIndicator color={brand.pinkDeep} style={{ marginTop: 40 }} /> : null}
        {err ? <AppText muted center style={{ marginTop: 30 }}>{err}</AppText> : null}
        {shown.map((c) => <CouponCard key={c.id} c={c} onPress={() => router.push(`/coupon/${c.id}`)} onSave={() => save(c)} />)}
        {list !== null && !shown.length && !err ? (
          <View style={st.empty}>
            <Icon name="ticket" color={brand.pinkDeep} size={34} />
            <AppText style={{ fontFamily: font.bold, fontSize: 16 }} center>{tab === 'wallet' ? t('محفظتك فاضية') : tab === 'points' ? t('ما فيه عروض بالنقاط للحين') : t('ما فيه عروض في {city} للحين', { city: cityName(city) })}</AppText>
            <AppText variant="small" muted center>{tab === 'wallet' ? t('اضغط القلب على أي كوبون عشان ينحفظ هنا.') : tab === 'points' ? t('أول ما تضيف المحلات عروض تتبادل بالنقاط بتلقاها هنا. خلك تجمع نقاطك.') : t('أول ما يضيف محل عرض هنا نبلغك، وتقدر تشوف عروض المدن الثانية تحت.')}</AppText>
            {tab === 'all' ? (
              <Pressable onPress={toggleAlert} style={[st.alertBtn, alertOn && { backgroundColor: brand.green }]}>
                <Icon name={alertOn ? 'check' : 'bell'} color="#fff" size={16} />
                <AppText color="#fff" style={{ fontFamily: font.bold }}>{alertOn ? t('بنبلغك أول ما ينضاف عرض في {city}', { city: cityName(city) }) : t('نبهني لما ينضاف عرض في {city}', { city: cityName(city) })}</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {tab === 'all' && list !== null && !list.length && others.length ? (
          <>
            <AppText variant="section" style={{ marginTop: 10 }}>{t('عروض في مدن ثانية')}</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {otherCities.map(([c, n]) => <Chip key={c} label={`${cityName(c)} · ${n}`} color={brand.pinkDeep} onPress={() => { setCity(c); setList(null); }} />)}
            </ScrollView>
            {others.slice(0, 6).map((c) => <CouponCard key={c.id} c={c} bizName={c.biz ? `${c.biz.name} · ${cityName(c.biz.city)}` : undefined} onPress={() => router.push(`/coupon/${c.id}`)} onSave={() => save(c)} />)}
          </>
        ) : null}
      </View>

      {F.merchants ? <Pressable style={st.biz} onPress={() => router.push('/merchant')}>
        <View style={st.bizIcon}><Icon name="shop" color="#fff" size={22} /></View>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontFamily: font.bold }} color="#fff">{t('عندك مطعم أو مقهى أو متجر؟')}</AppText>
          <AppText variant="small" color="#CFC6DE">{t('سجّل نشاطك مجاناً وأضف عرضك لزوار {city}.', { city: cityName(city) || t('مدينتك') })}</AppText>
        </View>
        <Icon name="chevron" color="#fff" size={18} />
      </Pressable> : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { backgroundColor: brand.pink, paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  glass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  wallet: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  cities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, paddingBottom: 0 },
  tabs: { flexDirection: 'row', margin: 16, marginBottom: 10, backgroundColor: brand.white, borderRadius: 16, padding: 4 },
  tab: { flex: 1, height: 40, borderRadius: 12, justifyContent: 'center' },
  tabOn: { backgroundColor: brand.pinkDeep },
  bal: { marginHorizontal: 16, marginBottom: 6, backgroundColor: brand.purple, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { alignItems: 'center', gap: 8, backgroundColor: brand.white, borderRadius: 22, padding: 24, marginTop: 6 },
  alertBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: brand.pinkDeep, borderRadius: 16, paddingHorizontal: 16, height: 46, marginTop: 8 },
  biz: { margin: 16, marginTop: 22, backgroundColor: brand.ink, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bizIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
});
