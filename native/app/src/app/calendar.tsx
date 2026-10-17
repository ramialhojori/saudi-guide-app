import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { useAuth } from '@/lib/auth';
import { cityName, getEvents } from '@/lib/content';
import { addDays, bestCities, calNote, calTitle, countdown, daysBetween, getCalendar, lengthDays, remKey, todayKey, toggleReminder, useReminders, type CalItem } from '@/lib/calendar';
import { hijriLabel, hijriMonthName, toHijri } from '@/lib/hijri';
import { isEn, t } from '@/lib/i18n';
import { alert } from '@/lib/alert';
import { getSeasonMeta, seasonLabel, seasonsFrom } from '@/lib/seasons';
import type { EventItem } from '@/lib/types';
import { brand, font } from '@/theme/tokens';

/**
 * «التقويم والإجازات» — ثلاث تبويبات:
 *  1) التقويم: شهر ميلادي وتحت كل يوم الهجري (أم القرى)، ونقاط للفعاليات والمناسبات و«رايح»
 *  2) المناسبات: الإجازات والمواسم والمناسبات الوطنية والدينية مع عد تنازلي و«ذكّرني»
 *  3) إجازاتك: الإجازات الجاية، أفضل مدن لوقتها، وزر «خطط لي رحلة» بالتاريخ جاهز
 */
type Tab = 'month' | 'events' | 'breaks';
const WEEK_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (m: number) => (isEn ? MONTHS_EN : MONTHS_AR)[m - 1];
const gLabel = (d: string, withYear = true) => `${+d.slice(8, 10)} ${monthName(+d.slice(5, 7))}${withYear ? ' ' + d.slice(0, 4) : ''}`;
const weekday = (d: string) => (isEn ? WEEK_EN : WEEK_AR)[new Date(d + 'T12:00:00Z').getUTCDay()];

const LOOK: Record<CalItem['kind'], { icon: IconName; bg: string; fg: string }> = {
  school: { icon: 'book', bg: brand.softPink, fg: brand.pinkDeep },
  national: { icon: 'flag', bg: brand.softGreen, fg: brand.green },
  religious: { icon: 'moon', bg: brand.softPurple, fg: brand.purple },
  season: { icon: 'spark', bg: brand.softOrange, fg: brand.orangeDeep },
  other: { icon: 'calendar', bg: brand.chip, fg: brand.purple },
};

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const prm = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(prm.tab === 'breaks' ? 'breaks' : prm.tab === 'events' ? 'events' : 'month');
  const [items, setItems] = useState<CalItem[] | null>(null);
  const [going, setGoing] = useState<number[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const today = todayKey();
  const [month, setMonth] = useState(today.slice(0, 7)); // YYYY-MM
  const [sel, setSel] = useState(today);
  const [mine, setMine] = useState(!!user?.city);
  const reminders = useReminders();

  const load = useCallback(async () => {
    const [c, ev, meta] = await Promise.all([getCalendar(), getEvents().catch(() => [] as EventItem[]), getSeasonMeta()]);
    const seasons: CalItem[] = seasonsFrom(ev, Date.now(), meta).filter((s) => !s.returning && !isNaN(s.start) && !isNaN(s.end)).map((s) => ({
      id: s.name, kind: 'season', title: s.name, titleEn: seasonLabel(s.name), note: s.line, noteEn: s.line, cities: [],
      start: new Date(s.start + 3 * 3600e3).toISOString().slice(0, 10), end: new Date(s.end + 3 * 3600e3).toISOString().slice(0, 10),
    }));
    setItems([...c.items, ...seasons].sort((a, b) => a.start.localeCompare(b.start)));
    setGoing(c.going); setEvents(ev);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const evByDay = useMemo(() => {
    const m = new Map<string, EventItem[]>();
    for (const e of events) {
      if (mine && user?.city && e.city !== user.city) continue;
      const s = (e.start || '').slice(0, 10), en = ((e.end || e.start) || '').slice(0, 10);
      if (!s) continue;
      // الفعاليات الطويلة (أكثر من 3 أسابيع) تنحسب بيوم بدايتها بس عشان ما تغرق التقويم
      const span = Math.min(daysBetween(s, en || s), 21);
      for (let i = 0; i <= Math.max(0, span); i++) { const d = addDays(s, i); if (!m.has(d)) m.set(d, []); m.get(d)!.push(e); }
    }
    return m;
  }, [events, mine, user?.city]);
  const itemsOn = (d: string) => (items || []).filter((x) => x.start <= d && (x.end || x.start) >= d);
  const upcoming = (items || []).filter((x) => (x.end || x.start) >= today);
  const breaks = upcoming.filter((x) => x.kind === 'school');

  const onRemind = async (x: CalItem) => {
    const on = await toggleReminder(x);
    if (!on && !reminders[remKey(x)]) alert(t('ما قدرنا نفعّل التذكير'), t('فعّل إشعارات دليل السعودية من إعدادات الآيفون، أو الموعد قريب جداً.'));
  };
  const plan = (x: CalItem, city?: string) => {
    const start = x.start < today ? today : x.start;
    const days = Math.max(1, Math.min(lengthDays({ start, end: x.end }), 4)); // المخطط يخطط حتى 4 أيام
    router.push({ pathname: '/planner', params: { start, days: String(days), ...(city ? { city } : {}) } });
  };

  const h = toHijri(today);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: brand.bg }} contentContainerStyle={{ paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <View style={[st.head, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable style={st.glass} onPress={() => router.back()} accessibilityLabel={t('رجوع')}><Icon name="back" color="#fff" /></Pressable>
          <View style={{ flex: 1 }}>
            <AppText variant="title" color="#fff">{t('التقويم والإجازات')}</AppText>
            <AppText variant="small" color="#E4DCF2">{weekday(today)} {h ? hijriLabel(today) + ' · ' : ''}{gLabel(today)}</AppText>
          </View>
        </View>
        <View style={st.tabs}>
          {([['month', t('التقويم')], ['events', t('المناسبات')], ['breaks', t('إجازاتك')]] as [Tab, string][]).map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[st.tab, tab === k && st.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
              <AppText style={{ fontFamily: font.bold, fontSize: 14 }} color={tab === k ? brand.purple : '#fff'}>{l}</AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {!items ? <ActivityIndicator style={{ marginTop: 40 }} color={brand.purple} /> : tab === 'month' ? (
        <MonthView width={width} month={month} setMonth={setMonth} sel={sel} setSel={setSel} today={today} itemsOn={itemsOn} evByDay={evByDay} going={going}
          mine={mine} setMine={user?.city ? setMine : undefined} homeCity={user?.city} onPlanDay={(d) => router.push({ pathname: '/planner', params: { start: d, days: '1' } })} />
      ) : tab === 'events' ? (
        <View style={{ padding: 16, gap: 10 }}>
          {upcoming.length ? upcoming.map((x) => <ItemRow key={remKey(x)} x={x} on={!!reminders[remKey(x)]} onRemind={() => onRemind(x)} />) : <Empty text={t('ما فيه مناسبات قادمة للحين')} />}
          <AppText variant="tiny" muted center style={{ marginTop: 8, lineHeight: 19 }}>{t('التواريخ الهجرية حسب تقويم أم القرى، وقد تختلف المناسبات الدينية يوم حسب رؤية الهلال. مواعيد الإجازات من التقويم الدراسي المعتمد من وزارة التعليم.')}</AppText>
        </View>
      ) : (
        <View style={{ padding: 16, gap: 14 }}>
          {breaks.length ? breaks.map((x) => (
            <BreakCard key={remKey(x)} x={x} on={!!reminders[remKey(x)]} onRemind={() => onRemind(x)} onPlan={(c) => plan(x, c)} />
          )) : <Empty text={t('ما فيه إجازات قادمة للحين')} />}
        </View>
      )}
    </ScrollView>
  );
}

/* ---------- التقويم الشهري ---------- */
function MonthView({ width, month, setMonth, sel, setSel, today, itemsOn, evByDay, going, mine, setMine, homeCity, onPlanDay }: {
  width: number; month: string; setMonth: (m: string) => void; sel: string; setSel: (d: string) => void; today: string;
  itemsOn: (d: string) => CalItem[]; evByDay: Map<string, EventItem[]>; going: number[]; mine: boolean; setMine?: (v: boolean) => void; homeCity?: string; onPlanDay: (d: string) => void;
}) {
  const y = +month.slice(0, 4), m = +month.slice(5, 7);
  const first = `${month}-01`;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  const cell = Math.floor((width - 32 - 16) / 7);
  const shift = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const h1 = toHijri(first), h2 = toHijri(`${month}-${String(dim).padStart(2, '0')}`);
  const hRange = h1 && h2 ? (h1.m === h2.m ? `${hijriMonthName(h1.m)} ${h1.y}` : `${hijriMonthName(h1.m)} – ${hijriMonthName(h2.m)} ${h2.y}`) + (isEn ? ' AH' : 'هـ') : '';
  const goingSet = new Set(going);
  const selItems = itemsOn(sel);
  const selEvents = (evByDay.get(sel) || []).slice().sort((a, b) => Number(goingSet.has(b.id)) - Number(goingSet.has(a.id)));

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={st.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable style={st.arrow} onPress={() => shift(-1)} accessibilityLabel={t('الشهر السابق')}><View style={{ transform: [{ scaleX: -1 }] }}><Icon name="chevron" color={brand.purple} size={18} /></View></Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <AppText style={{ fontFamily: font.bold, fontSize: 19 }}>{monthName(m)} {y}</AppText>
            {hRange ? <AppText variant="small" muted>{hRange}</AppText> : null}
          </View>
          <Pressable style={st.arrow} onPress={() => shift(1)} accessibilityLabel={t('الشهر التالي')}><Icon name="chevron" color={brand.purple} size={18} /></Pressable>
        </View>
        {month !== today.slice(0, 7) ? (
          <Pressable onPress={() => { setMonth(today.slice(0, 7)); setSel(today); }} style={{ alignSelf: 'center', marginTop: 6 }}><AppText variant="tiny" color={brand.purple} style={{ fontFamily: font.bold }}>{t('رجوع لليوم')}</AppText></Pressable>
        ) : null}
      </View>

      {setMine ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => setMine(true)} style={[st.filter, mine && st.filterOn]}><AppText variant="small" color={mine ? '#fff' : brand.text} style={{ fontFamily: font.semibold }}>{t('فعاليات')} {cityName(homeCity || '')}</AppText></Pressable>
          <Pressable onPress={() => setMine(false)} style={[st.filter, !mine && st.filterOn]}><AppText variant="small" color={!mine ? '#fff' : brand.text} style={{ fontFamily: font.semibold }}>{t('كل المدن')}</AppText></Pressable>
        </View>
      ) : null}

      <View style={[st.card, { paddingHorizontal: 8 }]}>
        <View style={{ flexDirection: 'row' }}>
          {(isEn ? WEEK_EN : WEEK_AR).map((w, i) => <AppText key={w} variant="tiny" center style={{ width: cell, color: i === 5 || i === 6 ? brand.orangeDeep : brand.muted }}>{w}</AppText>)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {cells.map((d, i) => {
            if (!d) return <View key={'e' + i} style={{ width: cell, height: cell + 8 }} />;
            const its = itemsOn(d);
            const school = its.some((x) => x.kind === 'school');
            const special = its.find((x) => x.kind === 'national' || x.kind === 'religious');
            const season = its.some((x) => x.kind === 'season');
            const ev = evByDay.get(d) || [];
            const isGoing = ev.some((e) => goingSet.has(e.id));
            const isToday = d === today, isSel = d === sel;
            const hd = toHijri(d);
            const bg = isToday ? brand.purple : school ? brand.softPink : special ? brand.softGreen : 'transparent';
            const fg = isToday ? '#fff' : d < today ? brand.faint : brand.text;
            return (
              <Pressable key={d} onPress={() => setSel(d)} style={{ width: cell, height: cell + 8, padding: 2 }} accessibilityLabel={`${gLabel(d)} ${hd ? hijriLabel(d) : ''}`}>
                <View style={[st.day, { backgroundColor: bg }, isSel && !isToday && st.daySel]}>
                  <AppText style={{ fontFamily: font.bold, fontSize: 16, lineHeight: 20 }} color={fg}>{+d.slice(8, 10)}</AppText>
                  {hd ? <AppText style={{ fontSize: 10, lineHeight: 13 }} color={isToday ? '#E4DCF2' : brand.muted}>{hd.d}</AppText> : null}
                  <View style={{ flexDirection: 'row', gap: 2, height: 5, marginTop: 1 }}>
                    {isGoing ? <View style={[st.dot, { backgroundColor: brand.orange }]} /> : ev.length ? <View style={[st.dot, { backgroundColor: isToday ? '#fff' : brand.purple }]} /> : null}
                    {season ? <View style={[st.dot, { backgroundColor: brand.orangeDeep }]} /> : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={st.legend}>
        <Legend color={brand.purple} label={t('اليوم')} square />
        <Legend color={brand.softPink} label={t('إجازة')} square />
        <Legend color={brand.softGreen} label={t('مناسبة')} square />
        <Legend color={brand.purple} label={t('فعاليات')} />
        <Legend color={brand.orange} label={t('رايح')} />
        <Legend color={brand.orangeDeep} label={t('موسم')} />
      </View>

      <View style={st.dayCard}>
        <AppText style={{ fontFamily: font.bold, fontSize: 20 }} color="#fff">{hijriLabel(sel) || gLabel(sel)}</AppText>
        <AppText variant="small" color="#CFC6DE">{weekday(sel)} {gLabel(sel)}{sel === today ? ' · ' + t('اليوم') : ''}</AppText>
        {selItems.map((x) => (
          <View key={remKey(x)} style={[st.tag, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <Icon name={LOOK[x.kind].icon} color="#FFD7A8" size={15} />
            <AppText variant="small" color="#fff" style={{ fontFamily: font.semibold, flex: 1 }} numberOfLines={1}>{calTitle(x)}</AppText>
          </View>
        ))}
        {selEvents.length ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            {selEvents.slice(0, 8).map((e) => (
              <Pressable key={e.id} style={st.evRow} onPress={() => router.push(`/event/${e.id}`)}>
                <View style={[st.dot, { width: 8, height: 8, backgroundColor: goingSet.has(e.id) ? brand.orange : '#B9A9E0' }]} />
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontFamily: font.bold, fontSize: 14 }} color="#fff" numberOfLines={1}>{e.title}</AppText>
                  <AppText variant="tiny" color="#CFC6DE" numberOfLines={1}>{[e.city ? cityName(e.city) : '', goingSet.has(e.id) ? t('رايح') : ''].filter(Boolean).join(' · ')}</AppText>
                </View>
                <Icon name="chevron" color="#CFC6DE" size={16} />
              </Pressable>
            ))}
            {selEvents.length > 8 ? <AppText variant="tiny" color="#CFC6DE">{t('و{n} فعالية ثانية', { n: selEvents.length - 8 })}</AppText> : null}
          </View>
        ) : !selItems.length ? <AppText variant="small" color="#CFC6DE" style={{ marginTop: 6 }}>{t('ما فيه فعاليات مسجلة في هذا اليوم')}</AppText> : null}
        {sel >= today ? (
          <Pressable style={st.dayBtn} onPress={() => onPlanDay(sel)}>
            <Icon name="route" color={brand.orange} size={17} />
            <AppText style={{ fontFamily: font.bold, fontSize: 14 }} color={brand.orange}>{t('خطط لي هذا اليوم')}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Legend({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={square ? { width: 12, height: 12, borderRadius: 4, backgroundColor: color } : [st.dot, { width: 7, height: 7, backgroundColor: color }]} />
      <AppText variant="tiny" muted>{label}</AppText>
    </View>
  );
}

/* ---------- المناسبات ---------- */
function ItemRow({ x, on, onRemind }: { x: CalItem; on: boolean; onRemind: () => void }) {
  const L = LOOK[x.kind];
  const c = countdown(x);
  const len = lengthDays(x);
  const sub = [gLabel(x.start, false) + (len > 1 ? ' – ' + gLabel(x.end, false) : ''), hijriLabel(x.start)].filter(Boolean).join(' · ');
  return (
    <View style={[st.row, c.live && { borderColor: brand.purple, borderWidth: 1.5 }]}>
      <View style={[st.ic, { backgroundColor: L.bg }]}><Icon name={L.icon} color={L.fg} size={22} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText style={{ fontFamily: font.bold, fontSize: 16 }} numberOfLines={1}>{calTitle(x)}</AppText>
        <AppText variant="small" muted numberOfLines={1}>{sub}</AppText>
        {calNote(x) ? <AppText variant="small" color={brand.orangeInk} numberOfLines={2}>{calNote(x)}</AppText> : null}
      </View>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={[st.count, c.live && { backgroundColor: brand.purple }]}><AppText variant="tiny" color={c.live ? '#fff' : brand.purple} style={{ fontFamily: font.bold }}>{c.label}</AppText></View>
        {!c.live ? (
          <Pressable onPress={onRemind} hitSlop={8} accessibilityLabel={on ? t('ألغِ التذكير') : t('ذكّرني')} style={[st.bell, on && { backgroundColor: brand.orange }]}>
            <Icon name="bell" color={on ? '#fff' : brand.muted} size={16} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* ---------- إجازاتك ---------- */
function BreakCard({ x, on, onRemind, onPlan }: { x: CalItem; on: boolean; onRemind: () => void; onPlan: (city?: string) => void }) {
  const c = countdown(x);
  const len = lengthDays(x);
  const cities = bestCities(x).slice(0, 4);
  return (
    <View style={st.break}>
      <View style={st.breakTop}>
        <View style={{ flex: 1 }}>
          <AppText variant="tiny" color="#FFD7A8" style={{ fontFamily: font.bold }}>{c.label}</AppText>
          <AppText style={{ fontFamily: font.bold, fontSize: 20 }} color="#fff">{calTitle(x)}</AppText>
          <AppText variant="small" color="#E4DCF2">{gLabel(x.start, false)} – {gLabel(x.end)}</AppText>
        </View>
        <View style={st.len}>
          <AppText style={{ fontFamily: font.bold, fontSize: 26, lineHeight: 30 }} color={brand.purple}>{len}</AppText>
          <AppText variant="tiny" color={brand.purple}>{isEn ? (len === 1 ? 'day' : 'days') : len <= 10 ? 'أيام' : 'يوم'}</AppText>
        </View>
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        {calNote(x) ? <AppText variant="small" muted>{calNote(x)}</AppText> : null}
        {cities.length ? (
          <View>
            <AppText variant="tiny" muted style={{ marginBottom: 6 }}>{t('تناسب وقتها')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {cities.map((id) => (
                <Pressable key={id} style={st.cityChip} onPress={() => onPlan(id)}>
                  <Icon name="pin" color={brand.purple} size={14} />
                  <AppText variant="small" color={brand.purple} style={{ fontFamily: font.semibold }}>{cityName(id)}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={st.planBtn} onPress={() => onPlan(cities[0])}>
            <Icon name="route" color="#fff" size={18} />
            <AppText style={{ fontFamily: font.bold, fontSize: 15 }} color="#fff">{t('خطط لي رحلة')}</AppText>
          </Pressable>
          {!c.live ? (
            <Pressable style={[st.remBtn, on && { backgroundColor: brand.softOrange, borderColor: brand.orange }]} onPress={onRemind}>
              <Icon name="bell" color={on ? brand.orangeDeep : brand.purple} size={18} />
              <AppText style={{ fontFamily: font.bold, fontSize: 14 }} color={on ? brand.orangeDeep : brand.purple}>{on ? t('بنذكرك') : t('ذكّرني')}</AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <View style={[st.card, { alignItems: 'center', paddingVertical: 30 }]}><Icon name="calendar" color={brand.faint} size={32} /><AppText muted style={{ marginTop: 8 }}>{text}</AppText></View>;
}

const st = StyleSheet.create({
  head: { backgroundColor: brand.purple, paddingHorizontal: 20, paddingBottom: 18, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, gap: 16 },
  glass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18, padding: 4 },
  tab: { flex: 1, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: '#fff' },
  card: { backgroundColor: brand.card, borderRadius: 22, padding: 14 },
  arrow: { width: 42, height: 42, borderRadius: 14, backgroundColor: brand.softPurple, alignItems: 'center', justifyContent: 'center' },
  filter: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: brand.card, alignItems: 'center', justifyContent: 'center' },
  filterOn: { backgroundColor: brand.purple },
  day: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  daySel: { borderWidth: 2, borderColor: brand.purple },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  dayCard: { backgroundColor: brand.ink, borderRadius: 24, padding: 18, gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, marginTop: 4 },
  evRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 10 },
  dayBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(248,151,67,0.5)', marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: brand.card, borderRadius: 22, padding: 14, borderWidth: 1.5, borderColor: 'transparent' },
  ic: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  count: { backgroundColor: brand.softPurple, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  bell: { width: 32, height: 32, borderRadius: 16, backgroundColor: brand.chip, alignItems: 'center', justifyContent: 'center' },
  break: { backgroundColor: brand.card, borderRadius: 24, overflow: 'hidden' },
  breakTop: { backgroundColor: brand.purple, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  len: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: brand.softPurple, borderRadius: 14, paddingHorizontal: 12, height: 34 },
  planBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 16, backgroundColor: brand.orange },
  remBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5, borderColor: brand.line },
});
