import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Empty, Loading } from '@/components/State';
import { BackButton, Button, Pill } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { cityName } from '@/lib/content';
import { bizKind, couponColor, couponErr, dayLabel, getCouponMe, toggleSave, type Coupon, type Me } from '@/lib/coupons';
import { openDirections } from '@/lib/maps';
import { brand, font } from '@/theme/tokens';

/** تفاصيل الكوبون: العرض والشروط والمحل، و«استخدمه الحين» يفتح الرمز */
export default function CouponDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [c, setC] = useState<Coupon | null>(null);
  const [me, setMe] = useState<Me>(null);
  const [err, setErr] = useState('');
  useFocusEffect(useCallback(() => { getCouponMe(Number(id)).then((r) => { setC(r.coupon); setMe(r.me); }).catch((e) => setErr(couponErr(e))); }, [id, user?.id]));

  if (!c) return <View style={{ flex: 1, backgroundColor: brand.bg, paddingTop: insets.top + 10, paddingHorizontal: 16 }}><BackButton />{err ? <Empty title="الكوبون انتهى أو خلص" sub={err} /> : <Loading />}</View>;
  const bg = couponColor(c.biz?.kind);
  const used = !!c.usedByMe && c.perUser;
  const rows: [string, string][] = [
    ...(c.points ? [['يتبادل بـ', `${c.points} نقطة من رصيدك`] as [string, string]] : []),
    ...(c.minLevel ? [['حصري لـ', `المستوى ${c.minLevel} «${c.levelName}» وأعلى`] as [string, string]] : []),
    ...(c.minOrder ? [['الحد الأدنى للطلب', `${c.minOrder} ر.س`] as [string, string]] : []),
    ['الاستخدام', c.perUser ? 'مرة وحدة لكل شخص' : 'تقدر تستخدمه أكثر من مرة'],
    ...(c.hours ? [['الأوقات', c.hours] as [string, string]] : []),
    ['المدة', c.start || c.end ? `${c.start ? 'من ' + dayLabel(c.start) + ' ' : ''}${c.end ? 'حتى ' + dayLabel(c.end) : ''}` : 'مستمر'],
    ...(c.left != null ? [['المتبقي', `${c.left} من ${c.qty}`] as [string, string]] : []),
  ];
  const save = async () => { if (!user) return router.push('/login'); const s = await toggleSave(c.id).catch(() => c.saved); setC({ ...c, saved: s }); };

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={[st.head, { backgroundColor: bg, paddingTop: insets.top + 10 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <BackButton light />
            <Pressable style={st.glass} onPress={save} accessibilityLabel="احفظ في المحفظة"><Icon name={c.saved ? 'heartFill' : 'heart'} color="#fff" size={22} /></Pressable>
          </View>
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            {c.biz?.photo ? <Image source={c.biz.photo} style={st.logo} contentFit="cover" /> : <View style={[st.logo, { alignItems: 'center', justifyContent: 'center' }]}><Icon name="shop" color={bg} size={30} /></View>}
            <AppText color="#fff" center style={{ marginTop: 10, fontFamily: font.semibold }}>{c.biz?.name}{c.biz?.verified ? ' ✓' : ''}</AppText>
            <AppText style={{ fontFamily: font.bold, fontSize: 36, lineHeight: 50 }} color="#fff" center>{c.off}</AppText>
            <AppText color="#fff" center>{c.title}</AppText>
          </View>
        </View>

        <View style={st.card}>
          {rows.map(([l, v], i) => (
            <View key={l} style={[st.row, i < rows.length - 1 && st.rowLine]}>
              <AppText variant="small" muted style={{ flex: 1 }}>{l}</AppText>
              <AppText style={{ fontFamily: font.semibold, fontSize: 14 }}>{v}</AppText>
            </View>
          ))}
        </View>
        {c.terms ? (
          <View style={st.card}>
            <AppText style={{ fontFamily: font.bold, marginBottom: 4 }}>الشروط</AppText>
            <AppText variant="small" style={{ lineHeight: 24 }}>{c.terms}</AppText>
          </View>
        ) : null}

        {c.biz ? (
          <View style={st.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText style={{ fontFamily: font.bold, flex: 1 }}>{c.biz.name}</AppText>
              {c.biz.verified ? <Pill label="موثّق" bg={brand.softGreen} fg={brand.green} /> : null}
            </View>
            <AppText variant="small" muted>{bizKind(c.biz.kind)} · {cityName(c.biz.city)}{c.biz.area ? ` · ${c.biz.area}` : ''}</AppText>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {c.biz.placeId ? <Pressable style={st.mini} onPress={() => router.push(`/place/${c.biz!.placeId}`)}><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.purple}>صفحة المكان</AppText></Pressable> : null}
              {c.biz.lat && c.biz.lng ? <Pressable style={st.mini} onPress={() => openDirections(c.biz!.lat, c.biz!.lng, c.biz!.name)}><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.purple}>الاتجاهات</AppText></Pressable> : null}
            </View>
          </View>
        ) : null}
        <AppText variant="tiny" muted center style={{ marginTop: 14, paddingHorizontal: 30 }}>العرض مقدّم من المحل نفسه، ودليل السعودية يراجعه قبل النشر.</AppText>
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {used ? <Button label="استخدمته ✓" bg={brand.green} />
          : user && me && c.minLevel && me.level < c.minLevel ? <Button label={`يحتاج المستوى ${c.minLevel} · مستواك ${me.level}`} bg={brand.faint} />
          : user && me && c.points && me.balance < c.points ? <Button label={`تحتاج ${c.points - me.balance} نقطة زيادة`} bg={brand.faint} onPress={() => router.push('/community')} />
          : <Button label={user ? 'استخدمه الحين' : 'سجّل دخولك عشان تستخدمه'} bg={bg} onPress={() => (user ? router.push({ pathname: '/coupon/use', params: { id: String(c.id) } }) : router.push('/login'))} />}
        <AppText variant="tiny" muted center style={{ marginTop: 6 }}>{c.points && user && me ? `رصيدك ${me.balance} نقطة · تنخصم ${c.points} لما يأكد الكاشير` : 'افتحه وأنت عند الكاشير. الرمز يتغير كل 30 ثانية.'}</AppText>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingBottom: 26, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  glass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 80, height: 80, borderRadius: 24, borderWidth: 3, borderColor: '#fff', backgroundColor: brand.card },
  card: { marginHorizontal: 16, marginTop: 14, backgroundColor: brand.white, borderRadius: 22, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: brand.chip },
  mini: { backgroundColor: brand.softPurple, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: brand.bg },
});
