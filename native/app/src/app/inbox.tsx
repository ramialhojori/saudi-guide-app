import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BackButton, Badge, Chip } from '@/components/ui';
import { notes } from '@/lib/mock';
import { brand, font } from '@/theme/tokens';

const TABS = ['الكل', 'رحلاتي', 'المجتمع', 'العروض', 'الفعاليات'];

/** الإشعارات — تجريبي لين نبني الإشعارات (المرحلة 3) */
export default function Inbox() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [read, setRead] = useState(false);
  const group = (d: 'today' | 'week', title: string) => (
    <View>
      <AppText variant="small" muted style={{ fontFamily: font.bold, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>{title}</AppText>
      <View style={{ paddingHorizontal: 10, gap: 4 }}>
        {notes.filter((n) => n.day === d).map((n) => {
          const un = n.unread && !read;
          return (
            <View key={n.t} style={[st.row, un && { backgroundColor: '#fff' }]}>
              <Badge icon={n.icon} bg={n.bg} fg={n.fg} size={44} r={15} />
              <View style={{ flex: 1 }}>
                <AppText style={{ fontFamily: un ? font.bold : font.semibold, fontSize: 14.5 }}>{n.t}</AppText>
                <AppText variant="small" muted>{n.s}</AppText>
                <AppText variant="tiny" color={brand.faint}>{n.when}</AppText>
              </View>
              <View style={[st.dot, { backgroundColor: un ? brand.orange : 'transparent' }]} />
            </View>
          );
        })}
      </View>
    </View>
  );
  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 60 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
        <BackButton />
        <AppText variant="title" style={{ flex: 1 }}>الإشعارات</AppText>
        <AppText style={{ fontFamily: font.semibold, fontSize: 13 }} color={brand.purple} onPress={() => setRead(true)}>قراءة الكل</AppText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16, paddingBottom: 4 }}>
        {TABS.map((t, i) => <Chip key={t} label={t} on={tab === i} onPress={() => setTab(i)} />)}
      </ScrollView>
      {group('today', 'اليوم')}
      {group('week', 'هالأسبوع')}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 20 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
});
