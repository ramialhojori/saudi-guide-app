import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { couponColor, leftText, type Coupon } from '@/lib/coupons';
import { font } from '@/theme/tokens';
import { t } from '@/lib/i18n';

/** بطاقة الكوبون: نفس شكل التصميم (صورة المحل + الخصم + خط مقطّع + «استخدمه») */
export function CouponCard({ c, onPress, onSave, cta = t('استخدمه'), bizName }: { c: Coupon; onPress?: () => void; onSave?: () => void; cta?: string; bizName?: string }) {
  const bg = couponColor(c.biz?.kind);
  const used = !!c.usedByMe && c.perUser;
  return (
    <Pressable style={[st.card, { backgroundColor: bg, shadowColor: bg }, used && { opacity: 0.55 }]} onPress={onPress}>
      {c.biz?.photo ? <Image source={c.biz.photo} style={{ width: 92, height: 120 }} contentFit="cover" /> : <View style={st.noImg}><Icon name="ticket" color="#fff" size={30} /></View>}
      <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
        <View>
          <AppText variant="tiny" color="#fff" numberOfLines={1}>{bizName ?? c.biz?.name}{c.biz?.area ? ` · ${c.biz.area}` : ''}{c.biz?.verified ? ' ✓' : ''}{c.biz?.featured ? ` · ${t('مميّز')}` : ''}</AppText>
          <AppText style={{ fontFamily: font.bold, fontSize: 21, lineHeight: 30 }} color="#fff" numberOfLines={1}>{c.off}</AppText>
          <AppText variant="small" color="#fff" numberOfLines={1}>{c.title}</AppText>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {c.points || c.minLevel ? <View style={st.tag}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{[c.points ? t('{n} نقطة', { n: c.points }) : '', c.minLevel ? t('مستوى {n}+', { n: c.minLevel }) : ''].filter(Boolean).join(' · ')}</AppText></View> : null}
          <AppText variant="tiny" color="#fff" numberOfLines={1} style={{ flexShrink: 1 }}>{used ? t('استخدمته ✓') : leftText(c)}</AppText>
        </View>
      </View>
      <View style={st.stub}>
        {onSave ? (
          <Pressable onPress={onSave} hitSlop={10} accessibilityLabel={c.saved ? t('شيل من المحفظة') : t('احفظ في المحفظة')}><Icon name={c.saved ? 'heartFill' : 'heart'} color="#fff" size={22} /></Pressable>
        ) : null}
        <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#fff" center>{cta}</AppText>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  card: { height: 120, borderRadius: 22, flexDirection: 'row', overflow: 'hidden', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  tag: { backgroundColor: 'rgba(43,39,69,0.55)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  noImg: { width: 92, height: 120, backgroundColor: 'rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  stub: { width: 78, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.06)' },
});
