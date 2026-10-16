import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { Avatar, Badge, Pill } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { activity, badges, coupons, me as demo, passport } from '@/lib/mock';
import { ago, myStats, tint, type Stats } from '@/lib/community';
import { getPassport, type Passport as PassportData } from '@/lib/passport';
import { cityName } from '@/lib/content';
import { useFeatures } from '@/lib/features';
import { CouponCard } from '@/components/CouponCard';
import { myCoupons, myMerchant, type Coupon, type Merchant } from '@/lib/coupons';
import { brand, font, photos } from '@/theme/tokens';
import { t, tr } from '@/lib/i18n';

const STAMP = [brand.orange, brand.lilac, brand.sky, brand.pink, brand.orangeDeep, brand.purple];

/** ملفي — بيانات تجريبية لين يجهز تسجيل الدخول (المرحلة 2) */
export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pp, setPp] = useState<PassportData | null>(null);
  const [wallet, setWallet] = useState<Coupon[] | null>(null);
  const [biz, setBiz] = useState<Merchant | null>(null);
  const F = useFeatures();
  useFocusEffect(useCallback(() => {
    if (user) {
      myStats().then(setStats).catch(() => {}); getPassport().then(setPp).catch(() => {});
      myCoupons().then(setWallet).catch(() => setWallet([])); myMerchant().then((r) => setBiz(r.merchant)).catch(() => {});
    } else { setStats(null); setPp(null); setWallet(null); setBiz(null); }
  }, [user?.id]));
  const stampNames = user ? (pp?.cities ?? []).map((c) => pp?.all.find((a) => a.id === c.id)?.name ?? c.id) : passport.visited;
  const stampTotal = user ? pp?.all.length ?? 21 : passport.total;
  // الزائر يشوف مثال، والمسجّل يشوف أرقامه الحقيقية من السيرفر
  const me = user ? {
    ...demo, name: user.name || t('مستخدم الدليل'), initial: (user.name || tr('د', 'S')).trim()[0], handle: user.handle, since: user.since,
    city: user.city ? cityName(user.city) || user.city : '', bio: user.bio || t('اكتب نبذة عنك من الإعدادات.'),
    points: stats?.points ?? user.points, level: stats?.level ?? 1, nextLevelPts: stats?.nextAt ?? Math.max(user.points, 1), nextLevel: stats?.nextName ?? '',
    levelName: stats?.levelName ?? '', levelAt: stats?.levelAt ?? 0,
    stats: [
      { v: String(stats?.counts.answers ?? 0), l: tr('إجابة', 'Answers') }, { v: String(stats?.counts.questions ?? 0), l: tr('سؤال', 'Questions') },
      { v: String(stats?.counts.photos ?? 0), l: tr('صورة', 'Photos') }, { v: String(stats?.counts.thanks ?? 0), l: t('شكر') },
    ],
  } : { ...demo, levelName: t('سفير الدليل'), levelAt: 0 };
  const pct = Math.min(1, Math.max(0, (me.points - me.levelAt) / Math.max(1, me.nextLevelPts - me.levelAt)));
  const badgeList = user && stats
    ? stats.badges.map((b, i) => ({ icon: b.icon as IconName, t: b.name, s: b.earned ? t('حصّلته') : t('{a} من {b}', { a: b.have, b: b.goal }), locked: !b.earned, bg: b.earned ? STAMP[i % STAMP.length] : brand.chip, fg: b.earned ? '#fff' : brand.faint }))
    : badges;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 130 }}>
      <View style={st.cover}>
        <Image source={photos.land} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(43,31,69,0.3)', 'rgba(43,31,69,0.85)']} style={StyleSheet.absoluteFill} />
        <View style={[st.coverTop, { top: insets.top + 10 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable style={st.glass} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} accessibilityLabel={t('رجوع')}><Icon name="back" color="#fff" size={20} /></Pressable>
            <AppText variant="title" color="#fff">{t('ملفي')}</AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={st.glass} onPress={() => Share.share({ message: t('ملفي على دليل السعودية') }).catch(() => {})} accessibilityLabel={t('مشاركة')}><Icon name="share" color="#fff" size={20} /></Pressable>
            <Pressable style={st.glass} onPress={() => router.push('/settings')} accessibilityLabel={t('الإعدادات')}><Icon name="gear" color="#fff" size={20} /></Pressable>
          </View>
        </View>
      </View>

      {!user ? (
        <Pressable style={st.guest} onPress={() => router.push('/login')}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color="#fff">{t('سجّل دخولك عشان يصير هذا ملفك')}</AppText>
            <AppText variant="small" color="#FFF1E4">{t('رحلاتك تنحفظ، وتجمع نقاط وأوسمة. اللي تحت مثال.')}</AppText>
          </View>
          <View style={st.guestBtn}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color={brand.orangeDeep}>{t('دخول')}</AppText></View>
        </Pressable>
      ) : null}
      <View style={[st.card, !user && { marginTop: 12 }]}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View>
            <View style={st.avRing}><Avatar t={me.initial} c={user ? tint(user.id) : brand.lilac} size={76} /></View>
            <View style={st.lvl}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{t('مستوى {n}', { n: me.level })}</AppText></View>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title">{me.name}</AppText>
            <AppText variant="small" muted>{me.handle ? `@${me.handle} · ` : ''}{t('عضو منذ {y}', { y: me.since })}</AppText>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              {me.city ? <><Icon name="pin" color={brand.pinkDeep} size={14} /><AppText variant="small" style={{ fontFamily: font.semibold }}>{t('من {city}', { city: me.city })}</AppText></> : null}
              {me.levelName ? <Pill label={me.levelName} bg={brand.purple} fg="#fff" /> : null}
            </View>
          </View>
        </View>
        <AppText variant="small" style={{ marginTop: 12, lineHeight: 22 }}>{me.bio}</AppText>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
          <AppText style={{ fontFamily: font.bold, fontSize: 13 }}>{t('{n} نقطة', { n: me.points.toLocaleString('en') })}</AppText>
          <AppText variant="tiny" muted>{me.nextLevel ? t('باقي {n} للمستوى {l} «{name}»', { n: me.nextLevelPts - me.points, l: me.level + 1, name: me.nextLevel }) : t('وصلت أعلى مستوى')}</AppText>
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

      {/* تأثيرك: مثل «مساهماتك انشافت X مرة» في قوقل ماب */}
      {F.impact && user && stats?.impact ? (
        <View style={st.impact}>
          <AppText style={{ fontFamily: font.bold, fontSize: 16 }} color="#fff">{t('تأثيرك')}</AppText>
          <AppText variant="tiny" color="#CFC6DE">{t('كل شي شاركته يساعد زوار ثانيين')}</AppText>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            {[[stats.impact.views, t('مرة انشافت مساهماتك')], [stats.impact.thanks, t('شكر وصلك')], [stats.impact.helped, t('شخص جاوبته')], [stats.impact.facts + stats.impact.suggestions, t('معلومة أضفتها')]].map(([v, l]) => (
              <View key={l as string} style={{ flex: 1, alignItems: 'center' }}>
                <AppText style={{ fontFamily: font.bold, fontSize: 20 }} color="#F9A158">{Number(v).toLocaleString('en')}</AppText>
                <AppText variant="tiny" color="#E2DAEE" center>{l}</AppText>
              </View>
            ))}
          </View>
          {F.suggest ? (
            <Pressable style={st.impactBtn} onPress={() => router.push('/suggest')}>
              <Icon name="plus" color="#fff" size={16} />
              <AppText variant="small" color="#fff" style={{ fontFamily: font.bold }}>{t('أضف مكان ناقص في الدليل (+15)')}</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* النقاط: الرصيد والصرف وطريق «مرشد موثّق» */}
      {user && stats && (F.points || F.guides) ? (
        <View style={st.pts}>
          {F.points && F.coupons ? <Pressable style={st.ptsRow} onPress={() => router.push('/coupons?tab=points')}>
            <Badge icon="star" bg={brand.softOrange} fg={brand.orangeDeep} size={40} r={14} />
            <View style={{ flex: 1 }}>
              <AppText style={{ fontFamily: font.bold }}>{t('رصيدك {n} نقطة', { n: stats.balance })}</AppText>
              <AppText variant="tiny" muted>{stats.spent ? `${t('صرفت {n}', { n: stats.spent })} · ` : ''}{t('اصرفها على عروض المحلات')}</AppText>
            </View>
            <AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.link}>{t('استبدل')}</AppText>
          </Pressable> : null}
          {F.guides && stats.role === 'user' ? (
            <Pressable style={[st.ptsRow, F.points && F.coupons && st.ptsLine]} onPress={() => router.push('/guide-request')}>
              <Badge icon="crown" bg={brand.softPurple} fg={brand.purple} size={40} r={14} />
              <View style={{ flex: 1 }}>
                <AppText style={{ fontFamily: font.bold }}>{t('مرشد موثّق')}</AppText>
                <AppText variant="tiny" muted>{stats.guide.request?.status === 'pending' ? t('طلبك قيد المراجعة') : stats.guide.eligible ? t('صرت مؤهل! قدّم طلبك الحين') : t('من {at} نقطة تقدر تطلب الشارة · باقي {left}', { at: stats.guide.at, left: Math.max(0, stats.guide.at - stats.points) })}</AppText>
              </View>
              {stats.guide.eligible && stats.guide.request?.status !== 'pending' ? <AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.link}>{t('قدّم')}</AppText> : <Icon name="chevron" color={brand.faint} size={16} />}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* جواز السعودية */}
      {F.passport ? <Pressable style={st.passport} onPress={() => router.push('/passport')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <AppText style={{ fontFamily: font.bold, fontSize: 18 }} color="#fff">{t('جواز السعودية')}</AppText>
            <AppText variant="small" color="#CFC6DE">{user && !stampNames.length ? t('اختم أول مدينة من صفحة أي مكان تزوره') : t('كل مدينة تزورها تنختم في جوازك')}</AppText>
          </View>
          <AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#F9A158">{t('{a} من {b} وجهة', { a: stampNames.length, b: stampTotal })}</AppText>
        </View>
        <View style={st.stamps}>
          {stampNames.slice(0, 9).map((c, i) => (
            <View key={c} style={[st.stamp, { backgroundColor: STAMP[i % STAMP.length] }]}><AppText variant="tiny" color="#fff" style={{ fontFamily: font.bold }}>{c}</AppText></View>
          ))}
          <View style={[st.stamp, st.stampLeft]}><AppText variant="tiny" color="#CFC6DE">{t('+{n} باقية', { n: stampTotal - stampNames.length })}</AppText></View>
        </View>
      </Pressable> : null}

      {/* الأوسمة */}
      <View style={st.secRow}>
        <AppText variant="section">{t('أوسمتي')} <AppText variant="small" muted> {t('{a} من {b}', { a: badgeList.filter((b) => !b.locked).length, b: badgeList.length })}</AppText></AppText>
      </View>
      <View style={st.badges}>
        {badgeList.map((b) => (
          <View key={b.t} style={{ width: '25%', alignItems: 'center', gap: 4, opacity: b.locked ? 0.7 : 1, marginBottom: 14 }}>
            <Badge icon={b.icon} bg={b.bg} fg={b.fg} size={58} r={20} />
            <AppText variant="tiny" center style={{ fontFamily: font.bold }}>{b.t}</AppText>
            <AppText variant="tiny" center muted>{b.s}</AppText>
          </View>
        ))}
      </View>

      {/* الكوبونات */}
      {F.coupons ? (<>
      <View style={st.secRow}>
        <AppText variant="section">{t('كوبوناتي')} <AppText variant="small" muted> {user ? t('{n} محفوظة', { n: wallet?.length ?? 0 }) : t('مثال')}</AppText></AppText>
        <Pressable onPress={() => router.push(user ? '/coupons?wallet=1' : '/coupons')}><AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.link}>{user && wallet?.length ? t('المحفظة') : t('تصفح العروض')}</AppText></Pressable>
      </View>
      {user ? (
        wallet?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
            {wallet.map((c) => <View key={c.id} style={{ width: 300 }}><CouponCard c={c} onPress={() => router.push(`/coupon/${c.id}`)} /></View>)}
          </ScrollView>
        ) : (
          <Pressable style={[st.act, { marginHorizontal: 16 }]} onPress={() => router.push('/coupons')}>
            <Badge icon="ticket" bg={brand.softPink} fg={brand.pinkDeep} size={36} r={12} />
            <AppText variant="small" style={{ flex: 1 }}>{t('احفظ عروض المحلات في مدينتك، وتلقاها هنا وقت ما تحتاجها.')}</AppText>
          </Pressable>
        )
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
          {coupons.map((c) => (
            <View key={c.code} style={[st.coupon, { backgroundColor: c.bg }]}>
              <View style={{ flex: 1, padding: 14 }}>
                <AppText variant="tiny" color="#FFF1E4">{c.biz}</AppText>
                <AppText style={{ fontFamily: font.bold, fontSize: 24, lineHeight: 34 }} color="#fff">{c.off}</AppText>
                <AppText variant="tiny" color="#FFF1E4">{c.until}</AppText>
              </View>
              <View style={st.code}><AppText style={{ fontFamily: font.bold, fontSize: 13 }} color="#fff">{t('مثال')}</AppText></View>
            </View>
          ))}
        </ScrollView>
      )}

      </>) : null}

      {/* بوابة التجار */}
      {user && F.merchants ? (
        <Pressable style={st.biz} onPress={() => router.push('/merchant')}>
          <View style={st.bizIcon}><Icon name="shop" color="#fff" size={22} /></View>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontFamily: font.bold }} color="#fff">{biz ? biz.name : t('عندك نشاط تجاري؟')}</AppText>
            <AppText variant="small" color="#CFC6DE">{biz ? (biz.status === 'approved' ? t('لوحة التاجر: كوبوناتك وتأكيد الاستخدام') : biz.status === 'pending' ? t('طلبك قيد المراجعة') : t('الطلب يحتاج تعديل')) : t('سجّل نشاطك مجاناً وأضف عرضك')}</AppText>
          </View>
          <Icon name="chevron" color="#fff" size={18} />
        </Pressable>
      ) : null}

      {/* آخر نشاطي */}
      <View style={st.secRow}><AppText variant="section">{t('آخر نشاطي')}</AppText></View>
      <View style={{ gap: 10, paddingHorizontal: 16 }}>
        {user && stats ? (
          stats.activity.length ? stats.activity.map((a) => (
            <Pressable key={a.type + a.postId + a.created} style={st.act} onPress={() => router.push(`/question/${a.postId}`)}>
              <Badge icon={a.type === 'answer' ? 'chat' : a.kind === 'tip' ? 'star' : a.kind === 'photo' ? 'cam' : 'chat'} bg={brand.softPurple} fg={brand.purple} size={36} r={12} />
              <View style={{ flex: 1 }}>
                <AppText variant="small" numberOfLines={2}>{t(a.type === 'answer' ? 'جاوبت على «{q}»' : a.kind === 'question' ? 'سألت «{q}»' : 'شاركت «{q}»', { q: a.text.slice(0, 70) })}</AppText>
                <AppText variant="tiny" muted>{ago(a.created)}</AppText>
              </View>
              {a.thanks ? <AppText variant="tiny" color={brand.orangeDeep} style={{ fontFamily: font.bold }}>{t('+{n} شكر', { n: a.thanks })}</AppText> : null}
            </Pressable>
          )) : (
            <Pressable style={st.act} onPress={() => router.push('/community')}>
              <Badge icon="chat" bg={brand.softOrange} fg={brand.orangeDeep} size={36} r={12} />
              <AppText variant="small" style={{ flex: 1 }}>{t('ما عندك نشاط للحين. جاوب على سؤال في المجتمع واجمع أول نقاطك.')}</AppText>
            </Pressable>
          )
        ) : activity.map((a) => (
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
  guestBtn: { backgroundColor: brand.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  card: { marginHorizontal: 16, marginTop: -60, backgroundColor: brand.card, borderRadius: 28, padding: 18 },
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
  impact: { marginHorizontal: 16, marginTop: 14, backgroundColor: brand.purple, borderRadius: 22, padding: 16 },
  impactBtn: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  pts: { marginHorizontal: 16, marginTop: 14, backgroundColor: brand.card, borderRadius: 22, paddingHorizontal: 14 },
  ptsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  ptsLine: { borderTopWidth: 1, borderTopColor: brand.chip },
  biz: { margin: 16, marginBottom: 0, backgroundColor: brand.purple, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bizIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: brand.orange, alignItems: 'center', justifyContent: 'center' },
  act: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: brand.card, borderRadius: 18, padding: 12 },
});
