import { useState } from 'react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Avatar, BackButton } from '@/components/ui';
import { deleteAccount, signOut, updateMe, useAuth } from '@/lib/auth';
import { brand, font, START } from '@/theme/tokens';
import { env } from '@/config/env';

/** الإعدادات — مثل التصميم. الحساب حقيقي، والتفضيلات تنحفظ في المراحل الجاية */
export default function Settings() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [n, setN] = useState({ trip: true, community: true, offers: false, events: true });

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
            <Avatar t={(user.name || 'د').trim()[0]} c={brand.lilac} size={52} />
            <View style={{ flex: 1 }}>
              {editing ? (
                <TextInput value={name} onChangeText={setName} autoFocus style={st.input} placeholder="اسمك" placeholderTextColor={brand.faint} maxLength={60} />
              ) : <AppText style={{ fontFamily: font.bold, fontSize: 17 }}>{user.name || 'مستخدم الدليل'}</AppText>}
              <AppText variant="small" muted>مسجّل بـ Apple{user.city ? ' · ' + user.city : ''}</AppText>
            </View>
            <Pressable style={st.edit} onPress={async () => { if (editing && name.trim()) await updateMe({ name: name.trim() }).catch(() => {}); setEditing((v) => !v); }}>
              <AppText variant="small" color={brand.purple} style={{ fontFamily: font.bold }}>{editing ? 'حفظ' : 'تعديل'}</AppText>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={[st.card, { backgroundColor: brand.orange }]} onPress={() => router.push('/login')}>
          <AppText style={{ fontFamily: font.bold }} color="#fff">سجّل دخولك</AppText>
          <AppText variant="small" color="#FFF1E4">عشان تنحفظ رحلاتك وتجمع نقاط وأوسمة</AppText>
        </Pressable>
      )}

      <Group title="التفضيلات">
        <Row label="اللغة"><Seg items={['عربي', 'English']} on={0} /></Row>
        <Row label="المظهر"><Seg items={['تلقائي', 'فاتح', 'ليلي']} on={0} /></Row>
        <Row label="المدن اللي أتابعها" value="4 مدن ‹" />
      </Group>
      <Group title="الإشعارات">
        <Row label="رحلاتي وتذكيرها"><Switch value={n.trip} onValueChange={(v) => setN({ ...n, trip: v })} trackColor={{ true: brand.green }} /></Row>
        <Row label="إجابات وردود المجتمع"><Switch value={n.community} onValueChange={(v) => setN({ ...n, community: v })} trackColor={{ true: brand.green }} /></Row>
        <Row label="العروض والكوبونات"><Switch value={n.offers} onValueChange={(v) => setN({ ...n, offers: v })} trackColor={{ true: brand.green }} /></Row>
        <Row label="فعاليات مدينتي"><Switch value={n.events} onValueChange={(v) => setN({ ...n, events: v })} trackColor={{ true: brand.green }} /></Row>
      </Group>
      <Group title="عن الدليل">
        <Row label="الدليل القديم" value="‹" onPress={() => WebBrowser.openBrowserAsync(env.siteUrl)} />
        <Row label="تواصل معنا" value="‹" onPress={() => WebBrowser.openBrowserAsync(`${env.siteUrl}/contact`)} />
        <Row label="سياسة الخصوصية والشروط" value="‹" onPress={() => WebBrowser.openBrowserAsync(`${env.siteUrl}/privacy`)} />
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
function Seg({ items, on }: { items: string[]; on: number }) {
  return (
    <View style={st.seg}>
      {items.map((t, i) => <View key={t} style={[st.segItem, i === on && { backgroundColor: '#fff' }]}><AppText variant="tiny" style={{ fontFamily: font.bold }} color={i === on ? brand.ink : brand.muted}>{t}</AppText></View>)}
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  card: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#fff', borderRadius: 22, padding: 14 },
  input: { fontFamily: font.bold, fontSize: 17, color: brand.ink, textAlign: START, borderBottomWidth: 1.5, borderColor: brand.lilac, paddingVertical: 2 },
  edit: { backgroundColor: brand.chip, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  group: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 54, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F1ECF6' },
  seg: { flexDirection: 'row', backgroundColor: brand.chip, borderRadius: 12, padding: 3 },
  segItem: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9 },
});
