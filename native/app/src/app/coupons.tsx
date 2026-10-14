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
import { BIZ_KINDS, cityCoupons, couponErr, myCoupons, toggleSave, type Coupon } from '@/lib/coupons';
import { brand, font } from '@/theme/tokens';

/** كوبونات المدينة: عروض حقيقية من التجار بعد موافقة الإدارة، والمحفظة (المحفوظة) */
export default function Coupons() {
  const insets = useSafeAreaInsets();
  const prm = useLocalSearchParams<{ wallet?: string }>();
  const { user } = useAuth();
  const [city, setCity] = useState<string>(user?.city || 'medina');
  const [pick, setPick] = useState(false);
  const [tab, setTab] = useState<'all' | 'wallet'>(prm.wallet ? 'wallet' : 'all');
  const [kind, setKind] = useState('');
  const [list, setList] = useState<Coupon[] | null>(null);
  const [wallet, setWallet] = useState<Coupon[]>([]);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    try {
      const [a, w] = await Promise.all([cityCoupons(city), user ? myCoupons().catch(() => []) : Promise.resolve([])]);
      setList(a); setWallet(w);
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
    const src = tab === 'wallet' ? wallet : list ?? [];
    return kind ? src.filter((c) => c.biz?.kind === kind) : src;
  }, [tab, wallet, list, kind]);
  const kinds = BIZ_KINDS.filter(([k]) => (list ?? []).some((c) => c.biz?.kind === k));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <View style={[st.head, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable style={st.glass} onPress={() => router.back()} accessibilityLabel="رجوع"><Icon name="back" color="#fff" /></Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => setPick((v) => !v)}>
            <AppText variant="small" color="#FFE6EC">كوبونات</AppText>
            <AppText variant="title" color="#fff">{cityName(city) || 'اختر المدينة'} ▾</AppText>
          </Pressable>
          <Pressable style={st.wallet} onPress={() => setTab(tab === 'wallet' ? 'all' : 'wallet')}>
            <AppText style={{ fontFamily: font.bold, fontSize: 18 }} color="#fff" center>{wallet.length}</AppText>
            <AppText variant="tiny" color="#fff" center>محفظتي</AppText>
          </Pressable>
        </View>
        <AppText variant="small" color="#fff" style={{ marginTop: 12 }}>افتح الكوبون عند الكاشير، ويطلع لك رمز يدخله في جهازه.</AppText>
      </View>

      {pick ? (
        <View style={st.cities}>
          {allCities.map((c) => <Chip key={c.id} label={c.name} on={c.id === city} color={brand.pinkDeep} onPress={() => { setCity(c.id); setPick(false); setList(null); }} />)}
        </View>
      ) : null}

      <View style={st.tabs}>
        {([['all', 'كل العروض'], ['wallet', `محفظتي (${wallet.length})`]] as const).map(([k, t]) => (
          <Pressable key={k} style={[st.tab, tab === k && st.tabOn]} onPress={() => setTab(k)}><AppText style={{ fontFamily: font.bold, fontSize: 14 }} color={tab === k ? '#fff' : brand.muted} center>{t}</AppText></Pressable>
        ))}
      </View>
      {kinds.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 6 }}>
          <Chip label="الكل" on={!kind} color={brand.pinkDeep} onPress={() => setKind('')} />
          {kinds.map(([k, t]) => <Chip key={k} label={t} on={kind === k} color={brand.pinkDeep} onPress={() => setKind(k)} />)}
        </ScrollView>
      ) : null}

      <View style={{ gap: 12, paddingHorizontal: 16, paddingTop: 10 }}>
        {list === null ? <ActivityIndicator color={brand.pinkDeep} style={{ marginTop: 40 }} /> : null}
        {err ? <AppText muted center style={{ marginTop: 30 }}>{err}</AppText> : null}
        {shown.map((c) => <CouponCard key={c.id} c={c} onPress={() => router.push(`/coupon/${c.id}`)} onSave={() => save(c)} />)}
        {list !== null && !shown.length && !err ? (
          <View style={st.empty}>
            <Icon name="ticket" color={brand.pinkDeep} size={34} />
            <AppText style={{ fontFamily: font.bold, fontSize: 16 }} center>{tab === 'wallet' ? 'محفظتك فاضية' : `ما فيه عروض في ${cityName(city)} للحين`}</AppText>
            <AppText variant="small" muted center>{tab === 'wallet' ? 'اضغط القلب على أي كوبون عشان ينحفظ هنا.' : 'المحلات تقدر تضيف عروضها من «سجّل نشاطك». جرّب مدينة ثانية.'}</AppText>
          </View>
        ) : null}
      </View>

      <Pressable style={st.biz} onPress={() => router.push('/merchant')}>
        <View style={st.bizIcon}><Icon name="shop" color="#fff" size={22} /></View>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontFamily: font.bold }} color="#fff">عندك مطعم أو مقهى أو متجر؟</AppText>
          <AppText variant="small" color="#CFC6DE">سجّل نشاطك مجاناً وأضف عرضك لزوار {cityName(city) || 'مدينتك'}.</AppText>
        </View>
        <Icon name="chevron" color="#fff" size={18} />
      </Pressable>
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
  empty: { alignItems: 'center', gap: 8, backgroundColor: brand.white, borderRadius: 22, padding: 24, marginTop: 6 },
  biz: { margin: 16, marginTop: 22, backgroundColor: brand.ink, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bizIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
});
