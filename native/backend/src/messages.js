/* رسائل الإدارة: تنزل في «الإشعارات» داخل التطبيق، وتوصل إشعار للجوال للأجهزة المسجلة
   - الجمهور: الكل / متابعين مدن معينة / غايبين +30 يوم / جدد آخر 7 أيام / المرشدين / التجار
   - ساعات الهدوء 11 م – 8 ص بتوقيت مكة: إشعار الجوال يتأجل لـ 8 ص (الرسالة داخل التطبيق تنزل على وقتها)
   - المجدول يرسله الكرون (كل ساعة) */

import { CITIES } from './normalize.js';

const now = () => Math.floor(Date.now() / 1000);
const parse = (s, d = {}) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const SEGMENTS = ['all', 'inactive', 'new', 'guides', 'merchants'];
const MAKKAH = 3 * 3600;
const hourMakkah = (t) => Math.floor(((t + MAKKAH) % 86400) / 3600);
/** لو الوقت داخل ساعات الهدوء نرجّعه لـ 8 الصبح الجاية */
export function outOfQuiet(t) {
  const h = hourMakkah(t);
  if (h >= 8 && h < 23) return t;
  const day = Math.floor((t + MAKKAH) / 86400) + (h >= 23 ? 1 : 0);
  return day * 86400 - MAKKAH + 8 * 3600;
}

function audienceSql(a) {
  const where = ['u.deleted=0'], args = [];
  const cities = (a.cities || []).filter((c) => CITIES.some((x) => x[0] === c));
  if (cities.length) { where.push(`(u.city IN (${cities.map(() => '?').join(',')}) OR u.id IN (SELECT user_id FROM user_cities WHERE city IN (${cities.map(() => '?').join(',')})))`); args.push(...cities, ...cities); }
  if (a.segment === 'inactive') { where.push('u.seen<?'); args.push(now() - 30 * 86400); }
  if (a.segment === 'new') { where.push('u.created>?'); args.push(now() - 7 * 86400); }
  if (a.segment === 'guides') where.push("u.role IN ('guide','admin')");
  if (a.segment === 'merchants') where.push("u.id IN (SELECT user_id FROM merchants WHERE status='approved')");
  return { where: where.join(' AND '), args, cities };
}
/** الأجهزة: المربوطة بمستخدم من الجمهور، أو (للكل/المدن) الأجهزة بدون حساب اللي اختارت المدينة */
function deviceSql(a) {
  const u = audienceSql(a);
  let sql = `SELECT token FROM devices WHERE user_id IN (SELECT u.id FROM users u WHERE ${u.where})`;
  const args = [...u.args];
  if (!a.segment || a.segment === 'all') {
    if (u.cities.length) { sql += ` OR (user_id IS NULL AND (${u.cities.map(() => 'cities LIKE ?').join(' OR ')}))`; args.push(...u.cities.map((c) => `%"${c}"%`)); }
    else sql += ' OR user_id IS NULL';
  }
  return { sql, args };
}

export async function estimate(env, a) {
  const u = audienceSql(a), d = deviceSql(a);
  const users = await env.DB.prepare(`SELECT COUNT(*) n FROM users u WHERE ${u.where}`).bind(...u.args).first();
  const dev = await env.DB.prepare(`SELECT COUNT(*) n FROM (${d.sql})`).bind(...d.args).first();
  return { users: users.n, devices: dev.n };
}

export async function sendPush(env, tokens, m) {
  let ok = 0, bad = 0;
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100).map((to) => ({ to, title: m.title || 'دليل السعودية', body: m.text, sound: 'default', data: m.link ? { link: m.link } : {} }));
    try {
      const r = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(batch) });
      const j = await r.json().catch(() => ({}));
      const res = Array.isArray(j.data) ? j.data : [];
      res.forEach((x, k) => {
        if (x.status === 'ok') ok++;
        else { bad++; if (x.details && x.details.error === 'DeviceNotRegistered') env.DB.prepare('DELETE FROM devices WHERE token=?').bind(batch[k].to).run().catch(() => {}); }
      });
      if (!res.length) bad += batch.length;
    } catch { bad += batch.length; }
  }
  return { ok, bad };
}

/** يرسل رسالة واحدة. الجزء داخل التطبيق ينزل مرة، والجوال لو بساعات الهدوء يتأجل */
async function deliver(env, m) {
  const a = parse(m.audience);
  let inapp = m.sent_inapp, push = m.sent_push, errors = m.push_errors;
  if (m.inapp && !m.sent_inapp) {
    const u = audienceSql(a);
    const r = await env.DB.prepare(`INSERT INTO notifications (user_id,type,text,link,created) SELECT u.id,'system',?,?,? FROM users u WHERE ${u.where}`)
      .bind([m.title, m.text].filter(Boolean).join(' — ').slice(0, 140), m.link || null, now(), ...u.args).run();
    inapp = r.meta.changes || 0;
  }
  let done = true;
  if (m.push && !m.sent_push) {
    if (outOfQuiet(now()) > now() + 60) done = false; // نرجع له الساعة 8
    else {
      const d = deviceSql(a);
      const { results } = await env.DB.prepare(d.sql).bind(...d.args).all();
      const r = await sendPush(env, [...new Set(results.map((x) => x.token))], m);
      push = r.ok || -1; errors = r.bad; // -1 = حاولنا وما فيه أجهزة
    }
  }
  await env.DB.prepare('UPDATE messages SET sent_inapp=?, sent_push=?, push_errors=?, status=?, sent_at=? WHERE id=?')
    .bind(inapp || (m.inapp ? -1 : 0), push, errors, done ? 'sent' : 'scheduled', now(), m.id).run();
  return { inapp, push: Math.max(0, push), errors, pushDelayed: !done };
}

/** الكرون: يرسل اللي جا وقتها */
export async function runQueue(env) {
  const { results } = await env.DB.prepare("SELECT * FROM messages WHERE status='scheduled' AND at<=? ORDER BY at LIMIT 5").bind(now()).all();
  for (const m of results) await deliver(env, m).catch((e) => console.log('msg', m.id, e && e.message));
}

export async function messagesAdmin(p, request, env, J, q) {
  const M = request.method;
  let mm;
  if (p === '/admin/messages/estimate' && M === 'POST') return J(await estimate(env, await request.json().catch(() => ({}))));
  if (p === '/admin/messages' && M === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 60').all();
    const dev = await env.DB.prepare('SELECT COUNT(*) n FROM devices').first();
    return J({ devices: dev.n, messages: results.map((m) => ({ ...m, audience: parse(m.audience) })) });
  }
  if (p === '/admin/messages' && M === 'POST') {
    const b = await request.json().catch(() => ({}));
    const text = String(b.text || '').trim().slice(0, 178), title = String(b.title || '').trim().slice(0, 60);
    const link = /^\/[a-z0-9/_?=&.-]*$/i.test(String(b.link || '')) ? String(b.link) : '';
    if (text.length < 4) return J({ error: 'text_required' }, 400);
    const aud = { cities: (Array.isArray(b.cities) ? b.cities : []).slice(0, 21), segment: SEGMENTS.includes(b.segment) ? b.segment : 'all' };
    const at = b.at ? Math.floor(new Date(b.at).getTime() / 1000) : now();
    if (!at || at < now() - 300) return J({ error: 'bad_time' }, 400);
    const inapp = b.inapp === false ? 0 : 1, push = b.push === false ? 0 : 1;
    if (!inapp && !push) return J({ error: 'no_channel' }, 400);
    const r = await env.DB.prepare('INSERT INTO messages (title,text,link,audience,inapp,push,at,created) VALUES (?,?,?,?,?,?,?,?)')
      .bind(title, text, link, JSON.stringify(aud), inapp, push, at, now()).run();
    const id = r.meta.last_row_id;
    if (at <= now() + 60) {
      const m = await env.DB.prepare('SELECT * FROM messages WHERE id=?').bind(id).first();
      return J({ id, sent: true, ...(await deliver(env, m)) });
    }
    return J({ id, sent: false, at });
  }
  if ((mm = p.match(/^\/admin\/messages\/(\d+)\/cancel$/)) && M === 'POST') {
    await env.DB.prepare("UPDATE messages SET status='cancelled' WHERE id=? AND status='scheduled' AND sent_inapp=0").bind(+mm[1]).run();
    return J({ ok: true });
  }
  return null;
}
