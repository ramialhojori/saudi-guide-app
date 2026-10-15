import { useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { brand, font, photos } from '@/theme/tokens';

/**
 * صفحة اشتراك «دليل+».
 * الأسعار هنا للعرض فقط. لما نربط اشتراكات آبل (RevenueCat) تنقرأ الأسعار من المتجر نفسه بعملة الجهاز.
 */
type PlanId = 'yearly' | 'monthly';
/** منتجات آبل الموجودة أصلاً في App Store Connect (مجموعة «Subscriptions» لتطبيق 1595843013): com.yearly و com.monthly، وفيها تجربة 3 أيام */
export const PRODUCT_IDS: Record<PlanId, string> = { yearly: 'com.yearly', monthly: 'com.monthly' };
const PLANS: { id: PlanId; title: string; price: string; per: string; note: string; tag?: string }[] = [
  { id: 'yearly', title: 'سنوي', price: '99.99', per: 'ر.س / سنة', note: 'يعني 8.33 ر.س بالشهر · أول 3 أيام مجاناً', tag: 'وفّر 44%' },
  { id: 'monthly', title: 'شهري', price: '14.99', per: 'ر.س / شهر', note: 'أول 3 أيام مجاناً · تقدر تلغيه بأي وقت' },
];

const PERKS: { icon: IconName; title: string; sub: string; c: string; bg: string }[] = [
  { icon: 'spark', title: 'اسأل الدليل بدون حد', sub: 'مساعدك الذكي يجاوبك من أماكن الدليل وفعالياته ونصايح أهل المدن', c: brand.purple, bg: brand.softPurple },
  { icon: 'route', title: 'خطط رحلتك بذكاء', sub: 'خطة يوم بيوم حسب تواريخك ومين معك وميزانيتك، وتنحفظ في رحلتك', c: brand.orangeDeep, bg: brand.softOrange },
  { icon: 'x', title: 'بدون إعلانات', sub: 'تصفح الدليل كله بهدوء', c: brand.pinkDeep, bg: brand.softPink },
  { icon: 'crown', title: 'وسام دليل+ في ملفك', sub: 'يطلع جنب اسمك في المجتمع وأجوبتك', c: brand.skyDeep, bg: brand.softSky },
];

export default function Plus() {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<PlanId>('yearly');
  const cur = PLANS.find((p) => p.id === plan)!;

  const buy = () => Alert.alert('قريباً', 'الاشتراك يفتح مع التحديث الجاي إن شاء الله.');
  const restore = () => Alert.alert('استعادة المشتريات', 'إذا كنت مشترك من قبل، اشتراكك يرجع تلقائياً مع التحديث الجاي.');

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 190 }} showsVerticalScrollIndicator={false}>
        {/* الترويسة */}
        <View style={st.hero}>
          <Image source={photos.rock} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(43,39,69,0.35)', 'rgba(96,76,135,0.92)', '#604C87']} style={StyleSheet.absoluteFill} />
          <Pressable onPress={() => router.back()} style={[st.close, { top: insets.top + 10 }]} accessibilityLabel="إغلاق"><Icon name="x" color="#fff" size={20} /></Pressable>
          <View style={{ alignItems: 'center', gap: 10, paddingTop: insets.top + 70 }}>
            <View style={st.badge}><Icon name="spark" color="#fff" size={18} /><AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 15 }}>دليل+</AppText></View>
            <AppText variant="hero" color="#fff" center style={{ fontSize: 30, lineHeight: 42 }}>رحلتك أسهل{'\n'}مع دليلك الذكي</AppText>
            <AppText color="#E9E0FF" center style={{ lineHeight: 24, paddingHorizontal: 30 }}>اسأل عن أي مكان، وخذ خطة رحلة كاملة جاهزة في ثواني.</AppText>
          </View>
        </View>

        {/* المميزات */}
        <View style={st.perks}>
          {PERKS.map((p) => (
            <View key={p.title} style={st.perk}>
              <View style={[st.perkIc, { backgroundColor: p.bg }]}><Icon name={p.icon} color={p.c} size={22} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontFamily: font.bold, fontSize: 15 }}>{p.title}</AppText>
                <AppText variant="small" muted style={{ lineHeight: 20 }}>{p.sub}</AppText>
              </View>
            </View>
          ))}
        </View>

        {/* الخطط */}
        <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 6 }}>
          <AppText variant="title">اختر خطتك</AppText>
          {PLANS.map((p) => {
            const on = p.id === plan;
            return (
              <Pressable key={p.id} onPress={() => setPlan(p.id)} style={[st.plan, on && st.planOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                <View style={[st.radio, on && { borderColor: brand.orange, backgroundColor: brand.orange }]}>{on ? <Icon name="check" color="#fff" size={14} strokeWidth={3} /> : null}</View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <AppText style={{ fontFamily: font.bold, fontSize: 17 }}>{p.title}</AppText>
                    {p.tag ? <View style={st.tag}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{p.tag}</AppText></View> : null}
                  </View>
                  <AppText variant="small" muted>{p.note}</AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText style={{ fontFamily: font.bold, fontSize: 22 }} color={on ? brand.purple : brand.text}>{p.price}</AppText>
                  <AppText variant="tiny" muted>{p.per}</AppText>
                </View>
              </Pressable>
            );
          })}
          <View style={st.free}>
            <Icon name="info" color={brand.muted} size={16} />
            <AppText variant="small" muted style={{ flex: 1, lineHeight: 20 }}>بدون اشتراك تقدر تسأل الدليل 5 مرات باليوم، وتسوي خطة ذكية وحدة كل شهر مجاناً.</AppText>
          </View>
        </View>

        {/* الشروط المطلوبة من آبل */}
        <View style={{ paddingHorizontal: 22, marginTop: 18, gap: 10 }}>
          <AppText variant="tiny" muted center style={{ lineHeight: 19 }}>
            الاشتراك يتجدد تلقائياً بنفس السعر في نهاية كل فترة إلا إذا ألغيته قبلها بـ24 ساعة على الأقل. يُخصم المبلغ من حساب Apple ID، وتقدر تدير اشتراكك أو تلغيه من إعدادات حسابك في App Store.
          </AppText>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>
            <Pressable onPress={restore}><AppText variant="small" color={brand.purple} style={{ fontFamily: font.semibold }}>استعادة المشتريات</AppText></Pressable>
            <Pressable onPress={() => router.push('/settings')}><AppText variant="small" color={brand.purple} style={{ fontFamily: font.semibold }}>الشروط</AppText></Pressable>
            <Pressable onPress={() => router.push('/settings')}><AppText variant="small" color={brand.purple} style={{ fontFamily: font.semibold }}>الخصوصية</AppText></Pressable>
          </View>
        </View>
      </ScrollView>

      {/* زر الاشتراك ثابت تحت */}
      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable onPress={buy} style={st.cta} accessibilityRole="button">
          <AppText color="#fff" style={{ fontFamily: font.bold, fontSize: 17 }}>جرّب 3 أيام مجاناً</AppText>
        </Pressable>
        <AppText variant="tiny" muted center>{`بعدها ${cur.price} ${cur.per}، وتقدر تلغي قبل ما تنتهي التجربة`}</AppText>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { height: 360, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden' },
  close: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: brand.orange, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  perks: { marginHorizontal: 16, marginTop: -40, backgroundColor: brand.card, borderRadius: 26, padding: 16, gap: 16, shadowColor: '#2B2745', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3, marginBottom: 18 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkIc: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderRadius: 22, padding: 16, borderWidth: 2, borderColor: brand.line },
  planOn: { borderColor: brand.orange, backgroundColor: brand.card },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: brand.inactive, alignItems: 'center', justifyContent: 'center' },
  tag: { backgroundColor: brand.pinkDeep, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  free: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: brand.chip, borderRadius: 14, padding: 12 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: brand.bg, paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: brand.line },
  cta: { height: 58, borderRadius: 20, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
});
