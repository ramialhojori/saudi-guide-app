import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BackButton, Badge, Chip } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { useAuth } from '@/lib/auth';
import { ago } from '@/lib/community';
import { isEn, t } from '@/lib/i18n';
import { fetchNotes, markAllRead, type Note } from '@/lib/notifications';
import { brand, font } from '@/theme/tokens';

const TABS: [string, Note['type'][] | null][] = [[t('الكل'), null], [t('الإجابات'), ['answer', 'best']], [t('الشكر'), ['thanks']], [t('من الدليل'), ['system']]];
const LOOK: Record<Note['type'], { icon: IconName; bg: string; fg: string }> = {
  answer: { icon: 'chat', bg: brand.softSky, fg: brand.skyDeep },
  thanks: { icon: 'heart', bg: brand.softPink, fg: brand.pinkDeep },
  best: { icon: 'crown', bg: brand.softGreen, fg: brand.green },
  system: { icon: 'bell', bg: brand.softOrange, fg: brand.orangeDeep },
};
/** رسائل النظام: نعرف نوعها من رابطها ونصها، ونعطيها عنوان وأيقونة ولون ووجهة تناسبها */
type SysKind = { title: string; icon: IconName; bg: string; fg: string; go?: string };
function sysKind(n: Note): SysKind {
  const tx = n.text || '', l = n.link || '';
  if (l.startsWith('/merchant') || /نشاطك|التاجر|متجرك/.test(tx)) return { title: t('نشاطك التجاري'), icon: 'shop', bg: brand.softPurple, fg: brand.purple, go: '/merchant' };
  if (/وقفنا|مخالف|ما قدرنا ننشر|رفض/.test(tx)) return { title: t('بخصوص مشاركتك'), icon: 'info', bg: brand.softOrange, fg: brand.orangeInk, go: '/community' };
  if (/اقتراح/.test(tx)) return { title: /ما قدرنا/.test(tx) ? t('بخصوص اقتراحك') : t('اقتراحك وصل للدليل'), icon: 'pin', bg: brand.softGreen, fg: brand.green, go: l || '/profile' };
  if (/صورت|صورة/.test(tx)) return { title: t('صورتك'), icon: 'cam', bg: brand.softSky, fg: brand.skyDeep, go: l || undefined };
  if (/كوبون|خصم|العرض|عرض /.test(tx)) return { title: t('كوبونات وعروض'), icon: 'ticket', bg: brand.softPink, fg: brand.pinkDeep, go: l || '/coupons' };
  if (/مبروك|أبطال|وسام|مرشد|تكريم/.test(tx)) return { title: t('مبروك!'), icon: 'crown', bg: brand.softOrange, fg: brand.orangeDeep, go: l || '/profile' };
  if (/انتشرت|مشاركتك|سؤالك|المجتمع/.test(tx)) return { title: t('مشاركتك في المجتمع'), icon: 'chat', bg: brand.softPurple, fg: brand.lilac, go: n.postId ? `/question/${n.postId}` : '/community' };
  if (/تأثيرك|نقاط|نقطة/.test(tx)) return { title: t('نقاطك وتأثيرك'), icon: 'star', bg: brand.softOrange, fg: brand.orangeDeep, go: l || '/profile' };
  if (/فعالي|موسم/.test(tx)) return { title: t('فعاليات'), icon: 'cal', bg: brand.softPink, fg: brand.pinkDeep, go: l || '/events' };
  return { title: t('من فريق الدليل'), icon: 'bell', bg: brand.softOrange, fg: brand.orangeDeep, go: l || undefined };
}
const title = (n: Note) => n.type === 'system' ? sysKind(n).title : ({
  answer: t('{name} جاوب على سؤالك', { name: n.actor }),
  thanks: t('{name} شكرك على مشاركتك', { name: n.actor }),
  best: t('{name} اختار جوابك أفضل إجابة · +15 نقطة', { name: n.actor }),
} as Record<string, string>)[n.type];
const open = (n: Note) => {
  if (n.type !== 'system') return n.postId && router.push(`/question/${n.postId}`);
  const go = sysKind(n).go;
  if (go) router.push(go as never);
};

/** الإشعارات: إجابات وشكر وأفضل إجابة — من السيرفر */
export default function Inbox() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<Note[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setItems([]); return; }
    setBusy(true);
    try {
      const r = await fetchNotes();
      setItems(r.items);
      if (r.unread) setTimeout(() => markAllRead(), 1500); // بعد ما يشوفها تنقرى
    } catch { setItems((x) => x ?? []); } finally { setBusy(false); }
  }, [user?.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filt = TABS[tab][1];
  const list = (items || []).filter((n) => !filt || filt.includes(n.type));
  const day = 86400, now = Date.now() / 1000;
  const groups: [string, Note[]][] = [
    [t('اليوم'), list.filter((n) => now - n.created < day)],
    [t('هالأسبوع'), list.filter((n) => now - n.created >= day && now - n.created < 7 * day)],
    [t('قبل'), list.filter((n) => now - n.created >= 7 * day)],
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={busy && !!items} onRefresh={load} tintColor={brand.purple} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
        <BackButton />
        <AppText variant="title" style={{ flex: 1 }}>{t('الإشعارات')}</AppText>
      </View>

      {!user ? (
        <Pressable style={st.empty} onPress={() => router.push('/login')}>
          <Badge icon="bell" bg={brand.softPurple} fg={brand.purple} size={60} r={20} />
          <AppText style={{ fontFamily: font.bold, fontSize: 17 }} center>{t('سجّل عشان توصلك الإشعارات')}</AppText>
          <AppText variant="small" muted center>{t('لما أحد يجاوب سؤالك أو يشكرك، بتلقاه هنا.')}</AppText>
          <View style={st.btn}><AppText color="#fff" style={{ fontFamily: font.bold }}>{t('سجّل دخولك')}</AppText></View>
        </Pressable>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16, paddingBottom: 4 }}>
            {TABS.map(([lbl], i) => <Chip key={lbl} label={lbl} on={tab === i} onPress={() => setTab(i)} />)}
          </ScrollView>
          {items === null ? <ActivityIndicator color={brand.purple} style={{ marginTop: 40 }} /> : null}
          {items && !list.length ? (
            <View style={st.empty}>
              <Badge icon="bell" bg={brand.softPurple} fg={brand.purple} size={60} r={20} />
              <AppText style={{ fontFamily: font.bold, fontSize: 17 }} center>{t('ما عندك إشعارات للحين')}</AppText>
              <AppText variant="small" muted center>{t('اسأل أو جاوب في المجتمع، وأي رد يوصلك هنا.')}</AppText>
              <Pressable style={st.btn} onPress={() => router.push('/community')}><AppText color="#fff" style={{ fontFamily: font.bold }}>{t('روح للمجتمع')}</AppText></Pressable>
            </View>
          ) : null}
          {groups.filter(([, g]) => g.length).map(([lbl, g]) => (
            <View key={lbl}>
              <AppText variant="small" muted style={{ fontFamily: font.bold, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>{lbl}</AppText>
              <View style={{ paddingHorizontal: 10, gap: 4 }}>
                {g.map((n) => {
                  const lk = n.type === 'system' ? sysKind(n) : (LOOK[n.type] || LOOK.system);
                  const canOpen = n.type !== 'system' ? !!n.postId : !!sysKind(n).go;
                  return (
                    <Pressable key={n.id} style={[st.row, !n.read && { backgroundColor: brand.card }]} onPress={() => open(n)} disabled={!canOpen}>
                      <Badge icon={lk.icon} bg={lk.bg} fg={lk.fg} size={44} r={15} />
                      <View style={{ flex: 1 }}>
                        <AppText style={{ fontFamily: n.read ? font.semibold : font.bold, fontSize: 14.5 }}>{title(n)}</AppText>
                        {n.text ? <AppText variant="small" muted numberOfLines={3} style={{ lineHeight: 20 }}>{n.type === 'system' ? n.text : isEn ? `“${n.text}”` : `«${n.text}»`}</AppText> : null}
                        {n.post && n.type !== 'system' ? <AppText variant="tiny" color={brand.skyDeep} numberOfLines={1}>{t('على: {post}', { post: n.post })}</AppText> : null}
                        <AppText variant="tiny" color={brand.faint}>{ago(n.created)}</AppText>
                      </View>
                      <View style={{ alignItems: 'center', gap: 10 }}>
                        <View style={[st.dot, { backgroundColor: n.read ? 'transparent' : brand.orange }]} />
                        {canOpen ? <Icon name="chevron" size={14} color={brand.faint} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 20 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  empty: { margin: 16, backgroundColor: brand.card, borderRadius: 24, padding: 24, alignItems: 'center', gap: 8 },
  btn: { marginTop: 8, backgroundColor: brand.purple, borderRadius: 16, paddingHorizontal: 22, height: 46, justifyContent: 'center' },
});
