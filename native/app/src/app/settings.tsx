import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Alert, Appearance, DevSettings, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Avatar, BackButton, Chip } from '@/components/ui';
import { deleteAccount, session, signOut, updateMe, useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { cityName } from '@/lib/content';
import { tint } from '@/lib/community';
import { brand, font, isDark, START, INPUT_START } from '@/theme/tokens';
import { env } from '@/config/env';

/** الإعدادات — مثل التصميم. الحساب حقيقي، والتفضيلات تنحفظ في المراحل الجاية */
export default function Settings() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [n, setN] = useState({ trip: true, community: true, offers: false, events: true });
  const [bio, setBio] = useState(user?.bio ?? '');
  const [home, setHome] = useState(user?.city ?? '');
  const [follow, setFollow] = useState<string[]>([]);
  const [open, setOpen] = useState<'' | 'home' | 'follow'>('');
  useEffect(() => { if (user) { setHome(user.city || ''); setBio(user.bio || ''); setName(user.name || ''); } }, [user?.id, user?.city, user?.bio]);
  // تفضيلات الإشعارات تنحفظ في الجوال، وتتفعّل مع إشعارات الجوال في النسخة الجاية
  useEffect(() => { AsyncStorage.getItem('sg_notif_prefs_v1').then((v) => { if (v) try { setN(JSON.parse(v)); } catch {} }).catch(() => {}); }, []);
  const setPref = (k: keyof typeof n, v: boolean) => { const x = { ...n, [k]: v }; setN(x); AsyncStorage.setItem('sg_notif_prefs_v1', JSON.stringify(x)).catch(() => {}); };
  useEffect(() => { if (user) api<{ cities: string[] }>('/v1/me/cities', { token: session().token }).then((r) => setFollow(r.cities)).catch(() => {}); }, [user?.id]);
  const saveFollow = async (next: string[]) => { setFollow(next); await api('/v1/me/cities', { method: 'PUT', body: { cities: next }, token: session().token }).catch(() => {}); };
  const saveHome = async (c: string) => { setHome(c); setOpen(''); await updateMe({ city: c }).catch(() => {}); };

  const confirmDelete = () =>
    Alert.alert('حذف الحساب', 'بنحذف حسابك ورحلاتك المحفوظة نهائياً، وما نقدر نرجعها. متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'احذف حسابي', style: 'destructive', onPress: async () => { try { await deleteAccount(); router.replace('/'); } catch { Alert.alert('ما قدرنا نحذف الحساب الحين', 'جرّب بعد شوي.'); } } },
    ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 60 }}>
      <View style={st.head}><BackButton /><AppText variant="title">الإعدادات</AppText></View>

      {user ? (
        <View style={st.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar t={(user.name || 'د').trim()[0]} c={tint(user.id)} size={52} />
            <View style={{ flex: 1 }}>
              {editing ? (
                <TextInput value={name} onChangeText={setName} autoFocus style={st.input} placeholder="اسمك" placeholderTextColor={brand.faint} maxLength={60} />
              ) : <AppText style={{ fontFamily: font.bold, fontSize: 17 }}>{user.name || 'مستخدم الدليل'}</AppText>}
              <AppText variant="small" muted>مسجّل بـ Apple{home ? ' · من ' + (cityName(home) || home) : ''}</AppText>
            </View>
            <Pressable style={st.edit} onPress={async () => { if (editing) await updateMe({ name: name.trim() || user.name, bio: bio.trim() }).catch(() => {}); setEditing((v) => !v); }}>
              <AppText variant="small" color={brand.purple} style={{ fontFamily: font.bold }}>{editing ? 'حفظ' : 'تعديل'}</AppText>
            </Pressable>
          </View>
          {editing ? (
            <TextInput value={bio} onChangeText={setBio} placeholder="نبذة قصيرة عنك (تطلع في ملفك)" placeholderTextColor={brand.faint} maxLength={200} multiline style={[st.input, { fontFamily: font.regular, fontSize: 14, marginTop: 12, minHeight: 60 }]} />
          ) : user.bio ? <AppText variant="small" muted style={{ marginTop: 10 }}>{user.bio}</AppText> : null}
        </View>
      ) : (
        <Pressable style={[st.card, { backgroundColor: brand.orange }]} onPress={() => router.push('/login')}>
          <AppText style={{ fontFamily: font.bold }} color="#fff">سجّل دخولك</AppText>
          <AppText variant="small" color="#FFF1E4">عشان تنحفظ رحلاتك وتجمع نقاط وأوسمة</AppText>
        </Pressable>
      )}

      <Group title="التفضيلات">
        <Row label="اللغة"><Seg items={['عربي', 'English · قريباً']} on={0} /></Row>
        {__DEV__ ? <Row label="المظهر (تجربة)"><Seg items={['فاتح', 'ليلي']} on={isDark ? 1 : 0} onPick={(i) => setScheme(i ? 'dark' : 'light')} /></Row> : null}
        {user ? <Row label="مدينتي" value={(home ? cityName(home) || home : 'اختر') + ' ‹'} onPress={() => setOpen(open === 'home' ? '' : 'home')} /> : null}
        {open === 'home' ? <View style={st.chips}>{CITY_IDS.map((c) => <Chip key={c} label={cityName(c)} on={home === c} color={brand.ink} onPress={() => saveHome(c)} />)}</View> : null}
        {user ? <Row label="المدن اللي أتابعها" value={(follow.length ? `${follow.length} ${follow.length === 1 ? 'مدينة' : follow.length === 2 ? 'مدينتين' : 'مدن'}` : 'ولا مدينة') + ' ‹'} onPress={() => setOpen(open === 'follow' ? '' : 'follow')} /> : null}
        {open === 'follow' ? (
          <View style={st.chips}>
            <AppText variant="tiny" muted style={{ width: '100%' }}>توصلك فعاليات ومستجدات المدن اللي تختارها</AppText>
            {CITY_IDS.map((c) => <Chip key={c} label={cityName(c)} on={follow.includes(c)} color={brand.purple} onPress={() => saveFollow(follow.includes(c) ? follow.filter((x) => x !== c) : [...follow, c])} />)}
          </View>
        ) : null}
      </Group>
      <Group title="الإشعارات">
        <Row label="رحلاتي وتذكيرها"><Switch value={n.trip} onValueChange={(v) => setPref('trip', v)} trackColor={{ true: brand.green }} /></Row>
        <Row label="إجابات وردود المجتمع"><Switch value={n.community} onValueChange={(v) => setPref('community', v)} trackColor={{ true: brand.green }} /></Row>
        <Row label="العروض والكوبونات"><Switch value={n.offers} onValueChange={(v) => setPref('offers', v)} trackColor={{ true: brand.green }} /></Row>
        <Row label="فعاليات مدينتي"><Switch value={n.events} onValueChange={(v) => setPref('events', v)} trackColor={{ true: brand.green }} /></Row>
      </Group>
      <Group title="عن الدليل">
        <Row label="تواصل معنا" value="‹" onPress={() => router.push('/contact')} />
        <Row label="سياسة الخصوصية" value="‹" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} />
        <Row label="شروط الاستخدام" value="‹" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} />
        <Row label="قواعد المجتمع" value="‹" onPress={() => router.push({ pathname: '/legal', params: { doc: 'community' } })} />
      </Group>
      {user ? (
        <Group title="الحساب">
          <Row label="تسجيل الخروج" onPress={() => signOut()} color={brand.purple} />
          <Row label="حذف الحساب" onPress={confirmDelete} color={brand.pinkDeep} />
        </Group>
      ) : null}
      <AppText variant="tiny" muted center style={{ marginTop: 20 }}>دليل السعودية · الإصدار {Constants.expoConfig?.version ?? '4.0.0'}</AppText>
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

const CITY_IDS = ['medina', 'makkah-region', 'riyadh', 'jeddah', 'alula', 'taif', 'abha', 'asir-region', 'diriyah', 'yanbu', 'umluj', 'eastern-region', 'tabuk-region', 'hail', 'qassim-region', 'albaha', 'jizan', 'najran', 'aljawf-region', 'northern-border', 'riyadh-region'];

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
