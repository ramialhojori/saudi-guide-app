/* إشعارات المحتوى التلقائية (تتحكم فيها من اللوحة: الميزات ← «إشعارات المحتوى»)
   1) جديد في مدينتك: أي مكان أو فعالية تنتشر (live) تنسجّل، وكل يوم الساعة 5 العصر بتوقيت مكة
      يوصل متابعين المدينة إشعار واحد يجمع الجديد (ما نزعجهم بإشعار لكل مكان لو نشرت 30 مكان مرة وحدة)
   2) بداية موسم: يوم بداية الموسم (من بيانات المواسم) الساعة 10 الصبح لمتابعين مدينته
   3) تذكير «رايح»: اللي ضغط «رايح» على فعالية يوصله تذكير الساعة 6 المغرب قبلها بيوم، وتذكير ثاني قبلها بساعتين تقريباً
   4) «بكرة في مدينتك»: الساعة 7 المغرب، متابعين كل مدينة فيها فعاليات تبدأ بكرة يوصلهم إشعار واحد يجمعها
   5) «ويكندك في مدينتك»: كل خميس 8 المساء، أبرز فعاليات الجمعة والسبت
   المتابع = مدينته في الحساب أو المدن اللي يتابعها، والجوالات بدون حساب حسب المدن اللي اختارتها
   الإشعار ينحفظ في صندوق الإشعارات، وإشعار الجوال يطلع من push.js حسب تفضيلات المستخدم */
import { arTitle } from './titles.js';
import { sendPush } from './messages.js';
import { CITIES } from './normalize.js';
import { getFeatures } from './contrib.js';
import { getSeasons } from './seasons.js';

const now = () => Math.floor(Date.now() / 1000);
const makkah = () => new Date(Date.now() + 3 * 3600e3);
const cityName = (id) => CITIES.find((c) => c[0] === id)?.[1] || '';
const count = (n, two, few, many) => (n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`);
const list = (titles) => (titles.length > 3 ? `${titles.slice(0, 3).join('، ')} وغيرها` : titles.join('، '));

/** يسجّل إن مكان/فعالية صارت منشورة (من مسار تغيير الحالة) */
export async function logLive(env, kind, id) {
  const r = await env.DB.prepare(`SELECT id, title, city, deleted FROM ${kind} WHERE id=?`).bind(id).first();
  if (!r || r.deleted !== 0) return;
  await env.DB.prepare('INSERT OR IGNORE INTO content_live (kind,item_id,city,title,at,sent) VALUES (?,?,?,?,?,0)')
    .bind(kind, id, r.city || '', arTitle(r.title).slice(0, 60), now()).run();
}

/** يوصل إشعار لمتابعين مدينة (أو للكل لو city فاضية): حسابات + جوالات بدون حساب */
async function toFollowers(env, city, text, link, pref) {
  const t = now();
  const where = city ? 'u.deleted=0 AND (u.city=? OR u.id IN (SELECT user_id FROM user_cities WHERE city=?))' : 'u.deleted=0';
  const args = city ? [city, city] : [];
  const ins = await env.DB.prepare(`INSERT INTO notifications (user_id,type,text,link,created) SELECT u.id,'system',?,?,? FROM users u WHERE ${where}`)
    .bind(String(text).slice(0, 140), link, t, ...args).run();
  // جوالات بدون حساب (اختارت المدينة وقت الترحيب)
  const devs = await env.DB.prepare(`SELECT token, prefs FROM devices WHERE user_id IS NULL ${city ? 'AND cities LIKE ?' : ''}`).bind(...(city ? [`%"${city}"%`] : [])).all();
  const tokens = devs.results.filter((d) => { try { return JSON.parse(d.prefs || '{}')[pref] !== false; } catch { return true; } }).map((d) => d.token);
  if (tokens.length) await sendPush(env, tokens, { title: 'دليل السعودية', text, link });
  return (ins.meta.changes || 0) + tokens.length;
}

async function onceToday(env, key) {
  const day = makkah().toISOString().slice(0, 10);
  const r = await env.DB.prepare('SELECT v FROM kv WHERE k=?').bind(key).first();
  if (r?.v === day) return false;
  await env.DB.prepare('INSERT OR REPLACE INTO kv (k,v) VALUES (?,?)').bind(key, day).run();
  return true;
}

/** الجديد في كل مدينة (مرة باليوم، 5 العصر) */
async function cityDigest(env) {
  if (makkah().getUTCHours() !== 17 || !(await onceToday(env, 'alerts_digest_day'))) return;
  const { results } = await env.DB.prepare('SELECT kind, item_id, city, title FROM content_live WHERE sent=0 AND city<>\'\' ORDER BY at').all();
  if (!results.length) return;
  await env.DB.prepare(`UPDATE content_live SET sent=1 WHERE sent=0`).run();
  const byCity = {};
  for (const r of results) (byCity[r.city] ??= { places: [], events: [] })[r.kind].push(r);
  for (const [city, g] of Object.entries(byCity)) {
    const name = cityName(city);
    if (!name) continue;
    // نتأكد إنها لسا منشورة (ممكن انخفت بعد النشر)
    const live = async (kind, items) => {
      if (!items.length) return [];
      const r = await env.DB.prepare(`SELECT id FROM ${kind} WHERE deleted=0 AND id IN (${items.map((x) => +x.item_id).join(',')})`).all();
      const ok = new Set(r.results.map((x) => x.id));
      return items.filter((x) => ok.has(x.item_id));
    };
    const places = await live('places', g.places), events = await live('events', g.events);
    if (places.length) {
      const text = places.length === 1 ? `مكان جديد في ${name}: ${places[0].title}` : `انضاف ${count(places.length, 'مكانين جديدين', 'أماكن جديدة', 'مكان جديد')} في ${name}: ${list(places.map((x) => x.title))}`;
      await toFollowers(env, city, text, places.length === 1 ? `/place/${places[0].item_id}` : `/city/${city}`, 'places');
    }
    if (events.length) {
      const text = events.length === 1 ? `فعالية جديدة في ${name}: ${events[0].title}` : `${count(events.length, 'فعاليتين جديدتين', 'فعاليات جديدة', 'فعالية جديدة')} في ${name}: ${list(events.map((x) => x.title))}`;
      await toFollowers(env, city, text, events.length === 1 ? `/event/${events[0].item_id}` : '/events', 'events');
    }
  }
}

/** بداية المواسم (10 الصبح يوم البداية) */
async function seasonStarts(env) {
  const mk = makkah();
  if (mk.getUTCHours() !== 10 || !(await onceToday(env, 'alerts_season_day'))) return;
  const today = mk.toISOString().slice(0, 10);
  for (const s of await getSeasons(env)) {
    if (s.hidden || s.start !== today) continue;
    const where = s.city ? ` في ${cityName(s.city) || ''}` : '';
    await toFollowers(env, s.city || '', `بدأ ${s.name}${where}! شوف فعالياته وخطط لزيارتك`, `/season/${encodeURIComponent(s.name)}`, 'events');
  }
}

/** تذكير «رايح» قبل الفعالية بيوم (6 المغرب) */
async function goingReminders(env) {
  const mk = makkah();
  if (mk.getUTCHours() !== 18 || !(await onceToday(env, 'alerts_going_day'))) return;
  const tomorrow = new Date(mk.getTime() + 86400e3).toISOString().slice(0, 10);
  const { results } = await env.DB.prepare(`SELECT g.user_id, e.id, e.title FROM event_going g JOIN events e ON e.id=g.event_id
    WHERE e.deleted=0 AND substr(e.start,1,10)=? LIMIT 5000`).bind(tomorrow).all();
  if (!results.length) return;
  const t = now();
  for (let i = 0; i < results.length; i += 50) {
    await env.DB.batch(results.slice(i, i + 50).map((r) => env.DB.prepare("INSERT INTO notifications (user_id,type,text,link,created) VALUES (?,'system',?,?,?)")
      .bind(r.user_id, `تذكير: بكرة ${arTitle(r.title).slice(0, 80)}. لا تنسى تخطط لوقتك`, `/event/${r.id}`, t)));
  }
}

/** تذكير قبل الفعالية بساعتين تقريباً (بين ساعة ونص وساعتين ونص) للي ضغطوا «رايح» — مع رابط الفعالية (فيها زر الاتجاهات) */
async function goingSoon(env) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS going_soon ( event_id INTEGER NOT NULL, user_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (event_id, user_id) )').run();
  const mk = makkah();
  const days = [mk.toISOString().slice(0, 10), new Date(mk.getTime() + 86400e3).toISOString().slice(0, 10)];
  const { results } = await env.DB.prepare(`SELECT id, title, start FROM events WHERE deleted=0 AND all_day=0 AND substr(start,1,10) IN (?,?) LIMIT 500`).bind(...days).all();
  const t = Date.now();
  const soon = results.filter((e) => {
    // التاريخ بدون منطقة زمنية = توقيت مكة
    const at = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(e.start || '') ? e.start : `${e.start}+03:00`);
    return Number.isFinite(at) && at - t >= 90 * 60e3 && at - t <= 150 * 60e3;
  });
  for (const e of soon) {
    const { results: users } = await env.DB.prepare('SELECT user_id FROM event_going WHERE event_id=? AND user_id NOT IN (SELECT user_id FROM going_soon WHERE event_id=?) LIMIT 2000').bind(e.id, e.id).all();
    if (!users.length) continue;
    const text = `باقي ساعتين تقريباً على ${arTitle(e.title).slice(0, 70)}. افتحها وخذ الاتجاهات`;
    for (let i = 0; i < users.length; i += 40) {
      const part = users.slice(i, i + 40);
      await env.DB.batch(part.flatMap((u) => [
        env.DB.prepare("INSERT INTO notifications (user_id,type,text,link,created) VALUES (?,'system',?,?,?)").bind(u.user_id, text, `/event/${e.id}`, now()),
        env.DB.prepare('INSERT OR IGNORE INTO going_soon (event_id,user_id,at) VALUES (?,?,?)').bind(e.id, u.user_id, now()),
      ]));
    }
  }
}

/** «بكرة في مدينتك»: فعاليات تبدأ بكرة، إشعار واحد لكل مدينة (7 المغرب) */
async function tomorrowInCity(env) {
  const mk = makkah();
  if (mk.getUTCHours() !== 19 || !(await onceToday(env, 'alerts_tomorrow_day'))) return;
  const tomorrow = new Date(mk.getTime() + 86400e3).toISOString().slice(0, 10);
  const { results } = await env.DB.prepare(`SELECT id, title, city FROM events WHERE deleted=0 AND city<>'' AND substr(start,1,10)=? ORDER BY id LIMIT 500`).bind(tomorrow).all();
  const byCity = {};
  for (const e of results) (byCity[e.city] ??= []).push(e);
  for (const [city, evs] of Object.entries(byCity)) {
    const name = cityName(city);
    if (!name) continue;
    const titles = evs.map((e) => arTitle(e.title).slice(0, 50));
    const text = evs.length === 1 ? `بكرة في ${name}: ${titles[0]}` : `بكرة في ${name} ${count(evs.length, 'فعاليتين', 'فعاليات', 'فعالية')}: ${list(titles)}`;
    await toFollowers(env, city, text, evs.length === 1 ? `/event/${evs[0].id}` : '/events', 'events');
  }
}

/** «ويكندك في مدينتك»: كل خميس 8 المساء، أبرز الفعاليات الشغالة الجمعة والسبت في كل مدينة (إشعار واحد) */
async function weekendDigest(env) {
  const mk = makkah();
  if (mk.getUTCDay() !== 4 || mk.getUTCHours() !== 20 || !(await onceToday(env, 'alerts_weekend_day'))) return;
  const fri = new Date(mk.getTime() + 86400e3).toISOString().slice(0, 10);
  const sat = new Date(mk.getTime() + 2 * 86400e3).toISOString().slice(0, 10);
  // شغالة يوم الجمعة أو السبت: تبدأ قبل نهاية السبت وتنتهي بعد بداية الجمعة
  const { results } = await env.DB.prepare(`SELECT id, title, city FROM events WHERE deleted=0 AND city<>'' AND substr(start,1,10)<=?
      AND substr(COALESCE(NULLIF("end",''),start),1,10)>=? ORDER BY start LIMIT 800`).bind(sat, fri).all();
  const byCity = {};
  for (const e of results) (byCity[e.city] ??= []).push(e);
  for (const [city, evs] of Object.entries(byCity)) {
    const name = cityName(city);
    if (!name) continue;
    const titles = evs.slice(0, 3).map((e) => arTitle(e.title).slice(0, 45));
    const text = evs.length === 1 ? `ويكندك في ${name}: ${titles[0]}` : `ويكندك في ${name}: ${count(evs.length, 'فعاليتين', 'فعاليات', 'فعالية')} منها ${list(titles)}`;
    await toFollowers(env, city, text, evs.length === 1 ? `/event/${evs[0].id}` : '/events', 'events');
  }
}

/** الكرون كل 10 دقايق */
export async function runAlerts(env) {
  if (!(await getFeatures(env)).alerts) return;
  await cityDigest(env);
  await seasonStarts(env);
  await goingReminders(env);
  await goingSoon(env);
  await tomorrowInCity(env);
  await weekendDigest(env);
}
