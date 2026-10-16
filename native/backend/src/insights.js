/* التقرير الأسبوعي لرامي + متابعة أعطال التطبيق
   1) التقرير: كل أحد 9 الصبح بتوقيت مكة يوصل المشرفين إشعار بملخص الأسبوع (والتفاصيل في اللوحة ← «التقرير الأسبوعي»)
      مقارنة بالأسبوع اللي قبله: الأجهزة النشطة، فتحات التطبيق، الحسابات الجديدة، مشتركين دليل+، الدعوات، أكثر الأماكن والبحث، البحث بدون نتائج، الأعطال
   2) الأعطال: التطبيق يرسل أي خطأ يصير للمستخدم (الرسالة وأول سطور مكانه + الإصدار والجهاز، بدون أي بيانات شخصية)
      نجمعها حسب «البصمة» (نفس الخطأ = سطر واحد بعدّاد)، ورامي يشوفها في اللوحة ← «الأعطال» ويعلّمها «انحلت» */
const now = () => Math.floor(Date.now() / 1000);
const makkah = () => new Date(Date.now() + 3 * 3600e3);
const dayStr = (d) => new Date(Date.now() + 3 * 3600e3 - d * 86400e3).toISOString().slice(0, 10);

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS app_errors ( fp TEXT PRIMARY KEY, message TEXT NOT NULL, stack TEXT, screen TEXT, platform TEXT, version TEXT, fatal INTEGER NOT NULL DEFAULT 0, count INTEGER NOT NULL DEFAULT 1, devices INTEGER NOT NULL DEFAULT 1, first INTEGER NOT NULL, last INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open' )",
  'CREATE INDEX IF NOT EXISTS app_errors_last ON app_errors(status, last DESC)',
  'CREATE TABLE IF NOT EXISTS app_error_hits ( fp TEXT NOT NULL, device TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (fp, device, day) )',
];
let ready = false;
async function ensure(env) { if (!ready) { await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))); ready = true; } }

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 10).map((x) => x.toString(16).padStart(2, '0')).join('');
}
// نشيل الأرقام المتغيرة (أرقام الأماكن، الأوقات) عشان نفس الخطأ ينحسب مرة وحدة
const norm = (s) => String(s || '').replace(/\b\d{3,}\b/g, 'N').replace(/https?:\/\/\S+/g, 'URL').slice(0, 300);

/** POST /v1/errors من التطبيق */
export async function errorsRoute(p, request, env, J) {
  if (p !== '/v1/errors' || request.method !== 'POST') return null;
  await ensure(env);
  const b = await request.json().catch(() => ({}));
  const message = String(b.message || '').slice(0, 400);
  if (!message) return J({ ok: true });
  const stack = String(b.stack || '').split('\n').slice(0, 8).join('\n').slice(0, 1500);
  const firstFrame = (stack.split('\n').find((l) => /\.(t|j)sx?:\d+|@/.test(l)) || '').replace(/:\d+:\d+/g, '').trim();
  const fp = await sha(`${norm(message)}|${norm(firstFrame)}`);
  const device = String(b.device || '').slice(0, 64) || 'unknown';
  const day = dayStr(0);
  // جهاز واحد ما يرسل نفس الخطأ أكثر من مرة باليوم
  const hit = await env.DB.prepare('INSERT OR IGNORE INTO app_error_hits (fp,device,day) VALUES (?,?,?)').bind(fp, device, day).run();
  if (!hit.meta.changes) return J({ ok: true });
  const t = now();
  await env.DB.prepare(`INSERT INTO app_errors (fp,message,stack,screen,platform,version,fatal,count,devices,first,last) VALUES (?,?,?,?,?,?,?,1,1,?,?)
    ON CONFLICT(fp) DO UPDATE SET count=count+1, devices=devices+1, last=excluded.last, version=excluded.version, platform=excluded.platform,
      screen=COALESCE(excluded.screen, screen), fatal=MAX(fatal, excluded.fatal), status=CASE WHEN status='fixed' THEN 'open' ELSE status END`)
    .bind(fp, message, stack, String(b.screen || '').slice(0, 80) || null, String(b.platform || '').slice(0, 10), String(b.version || '').slice(0, 12), b.fatal ? 1 : 0, t, t).run();
  return J({ ok: true });
}

/** ملخص فترة: من (قبل n يوم) إلى (قبل m يوم) */
async function period(env, from, to) {
  const a = dayStr(from - 1), b = dayStr(to);
  const one = async (sql, ...args) => (await env.DB.prepare(sql).bind(...args).first())?.n || 0;
  const sinceTs = now() - from * 86400, untilTs = now() - to * 86400;
  return {
    active: await one('SELECT COUNT(DISTINCT device) n FROM active_devices WHERE day BETWEEN ? AND ?', a, b),
    opens: await one("SELECT COALESCE(SUM(n),0) n FROM stats_daily WHERE metric='open' AND day BETWEEN ? AND ?", a, b),
    users: await one('SELECT COUNT(*) n FROM users WHERE deleted=0 AND created BETWEEN ? AND ?', sinceTs, untilTs),
    tripAdds: await one("SELECT COALESCE(SUM(n),0) n FROM stats_daily WHERE metric='trip_add' AND day BETWEEN ? AND ?", a, b),
    searches: await one("SELECT COALESCE(SUM(n),0) n FROM stats_daily WHERE metric='search' AND day BETWEEN ? AND ?", a, b),
    shares: await one("SELECT COALESCE(SUM(n),0) n FROM stats_daily WHERE metric IN ('share','share_app','share_article','invite_share') AND day BETWEEN ? AND ?", a, b),
    invites: await one('SELECT COUNT(*) n FROM referrals WHERE created BETWEEN ? AND ?', sinceTs, untilTs).catch(() => 0),
    reviews: await one('SELECT COUNT(*) n FROM reviews WHERE created BETWEEN ? AND ?', sinceTs, untilTs).catch(() => 0),
    posts: await one('SELECT COUNT(*) n FROM posts WHERE created BETWEEN ? AND ?', sinceTs, untilTs).catch(() => 0),
    errors: await one('SELECT COUNT(*) n FROM app_error_hits WHERE day BETWEEN ? AND ?', a, b).catch(() => 0),
  };
}

export async function buildReport(env) {
  await ensure(env);
  const cur = await period(env, 7, 0), prev = await period(env, 14, 7);
  const a = dayStr(6), b = dayStr(0);
  const top = async (metric, lim = 5) => (await env.DB.prepare(`SELECT k, SUM(n) n FROM stats_daily WHERE metric=? AND day BETWEEN ? AND ? AND k<>'' GROUP BY k ORDER BY n DESC LIMIT ?`).bind(metric, a, b, lim).all()).results;
  const topPlaces = await top('place');
  const titles = topPlaces.length ? (await env.DB.prepare(`SELECT id, title FROM places WHERE id IN (${topPlaces.map(() => '?').join(',')})`).bind(...topPlaces.map((x) => +x.k)).all()).results : [];
  const plus = (await env.DB.prepare('SELECT COUNT(*) n FROM users WHERE plus_until>?').bind(now()).first())?.n || 0;
  const errorsOpen = (await env.DB.prepare("SELECT COUNT(*) n FROM app_errors WHERE status='open' AND last>?").bind(now() - 7 * 86400).first())?.n || 0;
  return {
    from: a, to: b, cur, prev, plus, errorsOpen,
    topPlaces: topPlaces.map((x) => ({ id: +x.k, n: x.n, title: String(titles.find((t) => t.id === +x.k)?.title || '').split(' - ')[0] })),
    topSearches: await top('search'), emptySearches: await top('search_empty'), topCities: await top('city'),
  };
}

const pct = (a, b) => (!b ? '' : ` (${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%)`);
/** الكرون: الأحد 9 الصبح */
export async function weeklyReport(env) {
  const mk = makkah();
  if (mk.getUTCDay() !== 0 || mk.getUTCHours() !== 9) return;
  const day = mk.toISOString().slice(0, 10);
  const r0 = await env.DB.prepare("SELECT v FROM kv WHERE k='weekly_report_day'").first();
  if (r0?.v === day) return;
  await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('weekly_report_day',?)").bind(day).run();
  const r = await buildReport(env);
  await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('weekly_report',?)").bind(JSON.stringify(r)).run();
  const text = `تقرير الأسبوع: ${r.cur.active} جهاز نشط${pct(r.cur.active, r.prev.active)}، ${r.cur.users} حساب جديد، ${r.plus} مشترك دليل+${r.errorsOpen ? `، ${r.errorsOpen} عطل يحتاج نظرة` : ''}`;
  const { results: admins } = await env.DB.prepare("SELECT id FROM users WHERE role='admin' AND deleted=0").all();
  if (admins.length) await env.DB.batch(admins.map((u) => env.DB.prepare("INSERT INTO notifications (user_id,type,text,link,created) VALUES (?,'system',?,?,?)").bind(u.id, text.slice(0, 160), '/inbox', now())));
}

export async function insightsAdmin(p, request, env, J) {
  if (!p.startsWith('/admin/report') && !p.startsWith('/admin/errors')) return null;
  await ensure(env);
  let m;
  if (p === '/admin/report' && request.method === 'GET') return J(await buildReport(env));
  if (p === '/admin/errors' && request.method === 'GET') {
    const { results } = await env.DB.prepare("SELECT * FROM app_errors WHERE status<>'hidden' ORDER BY (status='open') DESC, last DESC LIMIT 200").all();
    return J({ errors: results });
  }
  if ((m = p.match(/^\/admin\/errors\/([0-9a-f]+)$/)) && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (!['open', 'fixed', 'ignored', 'hidden'].includes(b.status)) return J({ error: 'bad_status' }, 400);
    await env.DB.prepare('UPDATE app_errors SET status=? WHERE fp=?').bind(b.status, m[1]).run();
    return J({ ok: true });
  }
  return null;
}
