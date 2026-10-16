import { useEffect, useState } from 'react';
import { PREFS_KEY, registerPush } from '@/lib/push';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Alert, Appearance, DevSettings, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isEn, setLang, t, tr } from '@/lib/i18n';
import { AppText } from '@/components/AppText';
import { Avatar, BackButton, Chip } from '@/components/ui';
import { deleteAccount, session, signOut, updateMe, useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { ALL_CITY_IDS, cityName } from '@/lib/content';
import { tint } from '@/lib/community';
import { brand, font, isDark, START, INPUT_START } from '@/theme/tokens';
import { env } from '@/config/env';

/** الإعدادات — مثل التصميم. الحساب حقيقي، والتفضيلات تنحفظ في المراحل الجاية */
export default function Settings() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [n, setN] = useState({ trip: true, community: true, offers: false, events: true, places: true });
  const [bio, setBio] = useState(user?.bio ?? '');
  const [home, setHome] = useState(user?.city ?? '');
  const [follow, setFollow] = useState<string[]>([]);
  const [open, setOpen] = useState<'' | 'home' | 'follow'>('');
  useEffect(() => { if (user) { setHome(user.city || ''); setBio(user.bio || ''); setName(user.name || ''); } }, [user?.id, user?.city, user?.bio]);
  // تفضيلات الإشعارات تنحفظ في الجوال وتوصل للسيرفر مع تسجيل الجهاز (lib/push.ts)
  useEffect(() => { AsyncStorage.getItem(PREFS_KEY).then((v) => { if (v) try { setN((d) => ({ ...d, ...JSON.parse(v) })); } catch {} }).catch(() => {}); }, []);
  const setPref = (k: keyof typeof n, v: boolean) => {
    const x = { ...n, [k]: v }; setN(x);
    // نحفظ ونحدّث الجهاز عند السيرفر (ولو فعّل إشعار وما عنده إذن، نطلبه)
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(x)).then(() => registerPush(v)).then((ok) => {
      if (v && ok === false && Platform.OS !== 'web') Alert.alert(t('الإشعارات مقفلة'), t('فعّل إشعارات دليل السعودية من إعدادات الجوال عشان توصلك.'), [{ text: t('لاحقاً'), style: 'cancel' }, { text: t('الإعدادات'), onPress: () => Linking.openSettings() }]);
    }).catch(() => {});
  };
  useEffect(() => { if (user) api<{ cities: string[] }>('/v1/me/cities', { token: session().token }).then((r) => setFollow(r.cities)).catch(() => {}); }, [user?.id]);
  const saveFollow = async (next: string[]) => { setFollow(next); await api('/v1/me/cities', { method: 'PUT', body: { cities: next }, token: session().token }).catch(() => {}); };
  const saveHome = async (c: string) => { setHome(c); setOpen(''); await updateMe({ city: c }).catch(() => {}); };

  const confirmDelete = () =>
    Alert.alert(t('حذف الحساب'), t('بنحذف حسابك ورحلاتك المحفوظة نهائياً، وما نقدر نرجعها. متأكد؟'), [
      { text: t('إلغاء'), style: 'cancel' },
      { text: t('احذف حسابي'), style: 'destructive', onPress: async () => { try { await deleteAccount(); router.replace('/'); } catch { Alert.alert(t('ما قدرنا نحذف الحساب الحين'), t('جرّب بعد شوي.')); } } },
    ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 60 }}>
      <View style={st.head}><BackButton /><AppText variant="title">{t('الإعدادات')}</AppText></View>

      {user ? (
        <View style={st.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar t={(user.name || tr('د', 'S')).trim()[0]} c={tint(user.id)} size={52} />
            <View style={{ flex: 1 }}>
              {editing ? (
                <TextInput value={name} onChangeText={setName} autoFocus style={st.input} placeholder={t('اسمك')} placeholderTextColor={brand.faint} maxLength={60} />
              ) : <AppText style={{ fontFamily: font.bold, fontSize: 17 }}>{user.name || t('مستخدم الدليل')}</AppText>}
              <AppText variant="small" muted>{t('مسجّل بـ Apple')}{home ? ' · ' + t('من {city}', { city: cityName(home) || home }) : ''}</AppText>
            </View>
            <Pressable style={st.edit} onPress={async () => { if (editing) await updateMe({ name: name.trim() || user.name, bio: bio.trim() }).catch(() => {}); setEditing((v) => !v); }}>
              <AppText variant="small" color={brand.purple} style={{ fontFamily: font.bold }}>{editing ? t('حفظ') : t('تعديل')}</AppText>
            </Pressable>
          </View>
          {editing ? (
            <TextInput value={bio} onChangeText={setBio} placeholder={t('نبذة قصيرة عنك (تطلع في ملفك)')} placeholderTextColor={brand.faint} maxLength={200} multiline style={[st.input, { fontFamily: font.regular, fontSize: 14, marginTop: 12, minHeight: 60 }]} />
          ) : user.bio ? <AppText variant="small" muted style={{ marginTop: 10 }}>{user.bio}</AppText> : null}
        </View>
      ) : (
        <Pressable style={[st.card, { backgroundColor: brand.orange }]} onPress={() => router.push('/login')}>
          <AppText style={{ fontFamily: font.bold }} color="#fff">{t('سجّل دخولك')}</AppText>
          <AppText variant="small" color="#FFF1E4">{t('عشان تنحفظ رحلاتك وتجمع نقاط وأوسمة')}</AppText>
        </Pressable>
      )}

      <Group title={t('التفضيلات')}>
        {/* الإنجليزي جاهز للتجربة بس (نسخة التطوير) لين تكتمل ترجمة الواجهة */}
        <Row label="اللغة · Language">{__DEV__ ? <Seg items={['عربي', 'English']} on={isEn ? 1 : 0} onPick={(i) => setLang(i ? 'en' : 'ar')} /> : <Seg items={['عربي', 'English · قريباً']} on={0} />}</Row>
        {__DEV__ ? <Row label={t('المظهر (تجربة)')}><Seg items={[t('فاتح'), t('ليلي')]} on={isDark ? 1 : 0} onPick={(i) => setScheme(i ? 'dark' : 'light')} /></Row> : null}
        {user ? <Row label={t('مدينتي')} value={(home ? cityName(home) || home : t('اختر')) + (isEn ? ' ›' : ' ‹')} onPress={() => setOpen(open === 'home' ? '' : 'home')} /> : null}
        {open === 'home' ? <View style={st.chips}>{CITY_IDS.map((c) => <Chip key={c} label={cityName(c)} on={home === c} color={brand.ink} onPress={() => saveHome(c)} />)}</View> : null}
        {user ? <Row label={t('المدن اللي أتابعها')} value={(follow.length ? tr(`${follow.length} ${follow.length === 1 ? 'مدينة' : follow.length === 2 ? 'مدينتين' : 'مدن'}`, `${follow.length} ${follow.length === 1 ? 'city' : 'cities'}`) : t('ولا مدينة')) + (isEn ? ' ›' : ' ‹')} onPress={() => setOpen(open === 'follow' ? '' : 'follow')} /> : null}
        {open === 'follow' ? (
          <View style={st.chips}>
            <AppText variant="tiny" muted style={{ width: '100%' }}>{t('توصلك فعاليات ومستجدات المدن اللي تختارها')}</AppText>
            {CITY_IDS.map((c) => <Chip key={c} label={cityName(c)} on={follow.includes(c)} color={brand.purple} onPress={() => saveFollow(follow.includes(c) ? follow.filter((x) => x !== c) : [...follow, c])} />)}
          </View>
        ) : null}
      </Group>
      <Group title={t('الإشعارات')}>
        <Row label={t('رحلاتي وتذكيرها')}><Switch value={n.trip} onValueChange={(v) => setPref('trip', v)} trackColor={{ true: brand.green }} /></Row>
        <Row label={t('إجابات وردود المجتمع')}><Switch value={n.community} onValueChange={(v) => setPref('community', v)} trackColor={{ true: brand.green }} /></Row>
        <Row label={t('العروض والكوبونات')}><Switch value={n.offers} onValueChange={(v) => setPref('offers', v)} trackColor={{ true: brand.green }} /></Row>
        <Row label={t('فعاليات ومواسم مدني')}><Switch value={n.events} onValueChange={(v) => setPref('events', v)} trackColor={{ true: brand.green }} /></Row>
        <Row label={t('أماكن جديدة في مدني')}><Switch value={n.places} onValueChange={(v) => setPref('places', v)} trackColor={{ true: brand.green }} /></Row>
      </Group>
      <Group title={t('عن الدليل')}>
        <Row label={t('تواصل معنا')} value={isEn ? '›' : '‹'} onPress={() => router.push('/contact')} />
        <Row label={t('سياسة الخصوصية')} value={isEn ? '›' : '‹'} onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} />
        <Row label={t('شروط الاستخدام')} value={isEn ? '›' : '‹'} onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} />
        <Row label={t('قواعد المجتمع')} value={isEn ? '›' : '‹'} onPress={() => router.push({ pathname: '/legal', params: { doc: 'community' } })} />
      </Group>
      {user ? (
        <Group title={t('الحساب')}>
          <Row label={t('تسجيل الخروج')} onPress={() => { registerPush(false, true).catch(() => {}); signOut(); }} color={brand.purple} />
          <Row label={t('حذف الحساب')} onPress={confirmDelete} color={brand.pinkDeep} />
        </Group>
      ) : null}
      <AppText variant="tiny" muted center style={{ marginTop: 20 }}>{t('بيانات الطقس: معهد الأرصاد النرويجي MET Norway')}</AppText>
      <AppText variant="tiny" muted center style={{ marginTop: 4 }}>{t('دليل السعودية · الإصدار {v}', { v: Constants.expoConfig?.version ?? '4.0.0' })}</AppText>
    </ScrollView>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <AppText variant="small" muted style={{ fontFamily: font.bold, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 8 }}>{title}</AppText>
      <View style={st.group}>{children}</View>
    </View>
  );
}
function Row({ label, value, children, onPress, color }: { label: string; value?: string; children?: React.ReactNode; onPress?: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={st.row}>
      <AppText style={{ flex: 1, fontFamily: font.semibold }} color={color}>{label}</AppText>
      {children ?? (value ? <AppText variant="small" muted>{value}</AppText> : null)}
    </Pressable>
  );
}
function Seg({ items, on, onPick }: { items: string[]; on: number; onPick?: (i: number) => void }) {
  return (
    <View style={st.seg}>
      {items.map((t, i) => <Pressable key={t} disabled={!onPick} onPress={() => onPick?.(i)} style={[st.segItem, i === on && { backgroundColor: brand.card }]}><AppText variant="tiny" style={{ fontFamily: font.bold }} color={i === on ? brand.text : brand.muted}>{t}</AppText></Pressable>)}
    </View>
  );
}

/** نسخة التجربة: نجبر المظهر ونعيد تحميل التطبيق. النسخة النهائية تتبع إعداد الآيفون تلقائياً */
function setScheme(c: 'light' | 'dark') {
  AsyncStorage.setItem('sg_scheme_v1', c).catch(() => {});
  Appearance.setColorScheme?.(c);
  setTimeout(() => DevSettings.reload(), 150);
}

const CITY_IDS = ALL_CITY_IDS;

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  card: { marginHorizontal: 16, marginTop: 16, backgroundColor: brand.card, borderRadius: 22, padding: 14 },
  input: { fontFamily: font.bold, fontSize: 17, color: brand.text, textAlign: INPUT_START, borderBottomWidth: 1.5, borderColor: brand.lilac, paddingVertical: 2 },
  edit: { backgroundColor: brand.chip, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  group: { marginHorizontal: 16, backgroundColor: brand.card, borderRadius: 22, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 54, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F1ECF6' },
  seg: { flexDirection: 'row', backgroundColor: brand.chip, borderRadius: 12, padding: 3 },
  segItem: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9 },
});
