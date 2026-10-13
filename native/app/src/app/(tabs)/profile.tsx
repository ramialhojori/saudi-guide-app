import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Avatar, Badge, Pill } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { activity, badges, coupons, me as demo, passport } from '@/lib/mock';
import { brand, font, photos } from '@/theme/tokens';

const STAMP = [brand.orange, brand.lilac, brand.sky, brand.pink, brand.orangeDeep, brand.purple];

/** ملفي — بيانات تجريبية لين يجهز تسجيل الدخول (المرحلة 2) */
export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  // الاسم والمدينة من الحساب، والباقي (نقاط وأوسمة) تجريبي لين نبنيها
  const me = user ? { ...demo, name: user.name || 'مستخدم الدليل', initial: (user.name || 'د').trim()[0], handle: user.handle || user.id.slice(0, 6), since: user.since, city: user.city || demo.city, bio: user.bio || 'اكتب نبذة عنك من الإعدادات.' } : demo;
  const pct = me.points / me.nextLevelPts;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 130 }}>
      <View style={st.cover}>
        <Image source={photos.land} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(43,31,69,0.3)', 'rgba(43,31,69,0.85)']} style={StyleSheet.absoluteFill} />
        <View style={[st.coverTop, { top: insets.top + 10 }]}>
          <AppText variant="title" color="#fff">ملفي</AppText>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={st.glass} onPress={() => Share.share({ message: 'ملفي على دليل السعودية' }).catch(() => {})} accessibilityLabel="مشاركة"><Icon name="share" color="#fff" size={20} /></Pressable>
            <Pressable style={st.glass} onPress={() => router.push('/settings')} accessibilityLabel="الإعدادات"><Icon name="gear" color="#fff" size={20} /></Pressable>
          </View>
        </View>
      </View>

      {!user ? (
        <Pressable style={st.guest} onPress={() => router.push('/login')}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color="#fff">سجّل دخولك عشان يصير هذا ملفك</AppText>
            <AppText variant="small" color="#FFF1E4">رحلاتك تنحفظ، وتجمع نقاط وأوسمة. اللي تحت مثال.</AppText>
          </View>
          <View style={st.guestBtn}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={brand.orangeDeep}>دخول</AppText></View>
        </Pressable>
      ) : null}
      <View style={[st.card, !user && { marginTop: 12 }]}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View>
            <View style={st.avRing}><Avatar t={me.initial} c={brand.lilac} size={76} /></View>
            <View style={st.lvl}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>مستوى {me.level}</AppText></View>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title">{me.name}</AppText>
            <AppText variant="small" muted>@{me.handle} · عضو منذ {me.since}</AppText>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}>
              <Icon name="pin" color={brand.pinkDeep} size={14} />
              <AppText variant="small" style={{ fontFamily: font.semibold }}>من {me.city}</AppText>
              <Pill label="ابن الديرة" bg={brand.purple} fg="#fff" />
            </View>
          </View>
        </View>
        <AppText variant="small" style={{ marginTop: 12, lineHeight: 22 }}>{me.bio}</AppText>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
          <AppText style={{ fontFamily: font.bold, fontSize: 13 }}>{me.points.toLocaleString('en')} نقطة</AppText>
          <AppText variant="tiny" muted>باقي {me.nextLevelPts - me.points} للمستوى {me.level + 1} «{me.nextLevel}»</AppText>
        </View>
        <View style={st.bar}><View style={[st.barFill, { width: `${pct * 100}%` }]} /></View>
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          {me.stats.map((s, i) => (
            <View key={s.l} style={{ flex: 1, alignItems: 'center' }}>
              <AppText style={{ fontFamily: font.bold, fontSize: 20 }} color={[brand.purple, brand.orangeDeep, brand.pinkDeep, brand.skyDeep][i]}>{s.v}</AppText>
              <AppText variant="tiny" muted>{s.l}</AppText>
            </View>
          ))}
        </View>
      </View>

      {/* جواز السعودية */}
      <Pressable style={st.passport} onPress={() => router.push('/passport')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <AppText style={{ fontFamily: font.bold, fontSize: 18 }} color="#fff">جواز السعودية</AppText>
            <AppText variant="small" color="#CFC6DE">كل مدينة تزورها تنختم في جوازك</AppText>
          </View>
          <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#F9A158">{passport.visited.length} من {passport.total} وجهة</AppText>
        </View>
        <View style={st.stamps}>
          {passport.visited.map((c, i) => (
            <View key={c} style={[st.stamp, { backgroundColor: STAMP[i % STAMP.length] }]}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{c}</AppText></View>
          ))}
          <View style={[st.stamp, st.stampLeft]}><AppText variant="tiny" color="#CFC6DE">+{passport.total - passport.visited.length} باقية</AppText></View>
        </View>
      </Pressable>

      {/* الأوسمة */}
      <View style={st.secRow}>
        <AppText variant="section">أوسمتي <AppText variant="small" muted> 12 من 40</AppText></AppText>
        <AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.purple}>الكل</AppText>
      </View>
      <View style={st.badges}>
        {badges.map((b) => (
          <View key={b.t} style={{ width: '25%', alignItems: 'center', gap: 4, opacity: b.locked ? 0.7 : 1, marginBottom: 14 }}>
            <Badge icon={b.icon} bg={b.bg} fg={b.fg} size={58} r={20} />
            <AppText variant="tiny" center style={{ fontFamily: font.bold }}>{b.t}</AppText>
            <AppText variant="tiny" center muted>{b.s}</AppText>
          </View>
        ))}
      </View>

      {/* الكوبونات */}
      <View style={st.secRow}>
        <AppText variant="section">كوبوناتي <AppText variant="small" muted> 3 فعّالة</AppText></AppText>
        <Pressable onPress={() => router.push('/coupons')}><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.purple}>المحفظة</AppText></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
        {coupons.map((c) => (
          <View key={c.code} style={[st.coupon, { backgroundColor: c.bg }]}>
            <View style={{ flex: 1, padding: 14 }}>
              <AppText variant="tiny" color="#FFF1E4">{c.biz}</AppText>
              <AppText style={{ fontFamily: font.bold, fontSize: 24, lineHeight: 34 }} color="#fff">{c.off}</AppText>
              <AppText variant="tiny" color="#FFF1E4">{c.until}</AppText>
            </View>
            <Pressable style={st.code} onPress={() => Clipboard.setStringAsync(c.code).catch(() => {})}>
              <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#fff">{c.code}</AppText>
              <View style={st.copy}><AppText variant="tiny" color={c.bg} style={{ fontFamily: font.bold }}>نسخ</AppText></View>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {/* آخر نشاطي */}
      <View style={st.secRow}><AppText variant="section">آخر نشاطي</AppText></View>
      <View style={{ gap: 10, paddingHorizontal: 16 }}>
        {activity.map((a) => (
          <View key={a.t} style={st.act}>
            <Badge icon={a.icon} bg={brand.softPurple} fg={brand.purple} size={36} r={12} />
            <AppText variant="small" style={{ flex: 1 }}>{a.t}</AppText>
            {a.pts ? <AppText variant="tiny" color={brand.orangeDeep} style={{ fontFamily: font.bold }}>{a.pts}</AppText> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  cover: { height: 190, backgroundColor: brand.ink },
  coverTop: { position: 'absolute', right: 20, left: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  glass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  guest: { marginHorizontal: 16, marginTop: -60, backgroundColor: brand.orange, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  guestBtn: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  card: { marginHorizontal: 16, marginTop: -60, backgroundColor: '#fff', borderRadius: 28, padding: 18 },
  avRing: { borderWidth: 3, borderColor: brand.orange, borderRadius: 50, padding: 3 },
  lvl: { position: 'absolute', bottom: -6, alignSelf: 'center', backgroundColor: brand.orange, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  bar: { height: 10, borderRadius: 5, backgroundColor: brand.chip, marginTop: 6, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, backgroundColor: brand.orange },
  passport: { margin: 16, marginBottom: 0, backgroundColor: brand.ink, borderRadius: 26, padding: 18 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  stamp: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  stampLeft: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#6B6585' },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 },
  coupon: { width: 270, height: 120, borderRadius: 22, flexDirection: 'row', overflow: 'hidden' },
  code: { width: 90, alignItems: 'center', justifyContent: 'center', gap: 8, borderRightWidth: 2, borderStyle: 'dashed', borderRightColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(0,0,0,0.06)' },
  copy: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 18, padding: 12 },
});
