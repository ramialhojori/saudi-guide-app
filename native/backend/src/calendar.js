import { sessionUser } from './auth.js';
/* «التقويم والإجازات»: الإجازات المدرسية والمناسبات الوطنية والدينية (المواسم تجي من seasons.js والفعاليات من events)
   - كل عنصر: نوع (school إجازة دراسية | national وطنية | religious دينية | other)، عنوان، من/إلى (YYYY-MM-DD بتوقيت مكة)،
     سطر وصف، وأفضل مدن لهالوقت (لزر «خطط لي رحلة»)
   - تنضاف وتتعدل من اللوحة أو Claude، والجديد مسودة لين رامي ينشره
   - بيانات العام الدراسي 1448 من التقويم المعتمد من وزارة التعليم، والتواريخ الهجرية حسب تقويم أم القرى */
const now = () => Math.floor(Date.now() / 1000);
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const KINDS = ['school', 'national', 'religious', 'other'];
const STATUSES = ['draft', 'live', 'hidden'];
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS cal_items ( id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, title TEXT NOT NULL, title_en TEXT, start TEXT NOT NULL, \"end\" TEXT, note TEXT, note_en TEXT, cities TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'draft', created INTEGER NOT NULL, updated INTEGER NOT NULL )",
  'CREATE INDEX IF NOT EXISTS cal_items_start ON cal_items(status, start)',
];

/* البداية: العام الدراسي 1448 (2026-2027) + المناسبات. تنزل مسودة أول مرة */
const SEED = [
  ['school', 'إجازة الخريف', 'Autumn break', '2026-11-20', '2026-11-28', 'إجازة الفصل الأول، والجو بدأ يبرد في الشمال', 'First-term break, and the north is cooling down', ['alula', 'tabuk-region', 'riyadh', 'jeddah']],
  ['school', 'إجازة منتصف العام', 'Mid-year break', '2027-01-08', '2027-01-16', 'أحلى وقت للعلا وتبوك وحائل والبر', 'The best time for AlUla, Tabuk, Hail and the desert', ['alula', 'tabuk-region', 'hail', 'riyadh']],
  ['school', 'إجازة يوم التأسيس', 'Founding Day break', '2027-02-19', '2027-02-22', 'احتفالات يوم التأسيس في الدرعية والرياض', 'Founding Day celebrations in Diriyah and Riyadh', ['diriyah', 'riyadh', 'jeddah']],
  ['school', 'إجازة عيد الفطر', 'Eid al-Fitr break', '2027-02-26', '2027-03-13', 'العشر الأواخر من رمضان والعيد', 'The last ten nights of Ramadan and Eid', ['makkah-region', 'medina', 'jeddah', 'eastern-region']],
  ['school', 'إجازة عيد الأضحى', 'Eid al-Adha break', '2027-05-07', '2027-05-22', 'المصايف بدأت تحلى في الجنوب', 'Southern summer resorts are getting pleasant', ['abha', 'taif', 'albaha', 'asir-region']],
  ['school', 'إجازة نهاية العام', 'Summer break', '2027-06-24', '2027-08-21', 'الصيف في أبها والطائف والباحة', 'Summer in Abha, Taif and Al-Baha', ['abha', 'asir-region', 'taif', 'albaha']],
  ['national', 'يوم التأسيس', 'Founding Day', '2027-02-22', '2027-02-22', 'ذكرى تأسيس الدولة السعودية الأولى 1727م', 'Marking the founding of the first Saudi state in 1727', ['diriyah', 'riyadh']],
  ['national', 'يوم العلم', 'Flag Day', '2027-03-11', '2027-03-11', '', '', []],
  ['national', 'اليوم الوطني 97', 'Saudi National Day 97', '2027-09-23', '2027-09-23', 'احتفالات وعروض في كل المدن', 'Celebrations and shows in every city', ['riyadh', 'jeddah', 'eastern-region']],
  ['religious', 'رمضان', 'Ramadan', '2027-02-08', '2027-03-08', 'شهر الصيام، والتواريخ حسب تقويم أم القرى', 'The month of fasting (Umm al-Qura dates)', ['makkah-region', 'medina']],
  ['religious', 'عيد الفطر', 'Eid al-Fitr', '2027-03-09', '2027-03-11', 'تقبّل الله منا ومنكم', 'Eid Mubarak', []],
  ['religious', 'يوم عرفة', 'Day of Arafah', '2027-05-15', '2027-05-15', '', '', []],
  ['religious', 'عيد الأضحى', 'Eid al-Adha', '2027-05-16', '2027-05-19', 'وأيام التشريق', 'And the days of Tashreeq', []],
  ['religious', 'رأس السنة الهجرية 1449', 'Islamic New Year 1449', '2027-06-06', '2027-06-06', '', '', []],
];

let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
  const n = await env.DB.prepare('SELECT COUNT(*) n FROM cal_items').first();
  if (!n?.n) {
    const t = now();
    await env.DB.batch(SEED.map(([kind, title, title_en, start, end, note, note_en, cities]) =>
      env.DB.prepare('INSERT INTO cal_items (kind,title,title_en,start,"end",note,note_en,cities,status,created,updated) VALUES (?,?,?,?,?,?,?,?,\'draft\',?,?)')
        .bind(kind, title, title_en, start, end, note, note_en, JSON.stringify(cities), t, t)));
  }
  ready = true;
}

const row = (r) => ({ id: r.id, kind: r.kind, title: r.title, titleEn: r.title_en || '', start: r.start, end: r.end || r.start, note: r.note || '', noteEn: r.note_en || '', cities: parse(r.cities, []), status: r.status, updated: r.updated });
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

function clean(b, cur = {}) {
  const o = {};
  const str = (k, n) => { if (b[k] !== undefined) o[k] = String(b[k] ?? '').trim().slice(0, n); };
  str('title', 60); str('title_en', 60); str('note', 140); str('note_en', 140);
  if (b.kind !== undefined) { if (!KINDS.includes(b.kind)) return { error: 'bad_kind' }; o.kind = b.kind; }
  if (b.start !== undefined) { if (!isDay(b.start)) return { error: 'bad_date' }; o.start = b.start; }
  if (b.end !== undefined) { if (b.end && !isDay(b.end)) return { error: 'bad_date' }; o.end = b.end || null; }
  if (b.cities !== undefined) o.cities = JSON.stringify((Array.isArray(b.cities) ? b.cities : []).map(String).filter(Boolean).slice(0, 6));
  if (b.status !== undefined) { if (!STATUSES.includes(b.status)) return { error: 'bad_status' }; o.status = b.status; }
  const title = o.title ?? cur.title, start = o.start ?? cur.start, end = o.end !== undefined ? o.end : cur.end;
  if (!title) return { error: 'title_required' };
  if (!start) return { error: 'start_required' };
  if (end && end < start) return { error: 'bad_range' };
  return { o };
}

/** أقرب إجازة/مناسبة جاية (للودجت) */
export async function nextBreak(env) {
  await ensure(env);
  const r = await env.DB.prepare("SELECT * FROM cal_items WHERE status='live' AND kind IN ('school','national','religious') AND start>? ORDER BY CASE kind WHEN 'school' THEN 0 ELSE 1 END, start LIMIT 1").bind(today()).first().catch(() => null);
  if (!r) return null;
  const days = Math.round((Date.parse(r.end || r.start) - Date.parse(r.start)) / 86400e3) + 1;
  return { id: r.id, title: r.title, titleEn: r.title_en || '', start: `${r.start}T00:00:00+03:00`, days, url: 'saudiguide://calendar' };
}

/* ---------- عام ---------- */
export async function calendarRoute(p, request, env, J) {
  if (p !== '/v1/calendar' || request.method !== 'GET') return null;
  await ensure(env);
  const from = new Date(Date.now() + 3 * 3600e3 - 40 * 86400e3).toISOString().slice(0, 10);
  const { results } = await env.DB.prepare("SELECT * FROM cal_items WHERE status='live' AND COALESCE(\"end\", start)>=? ORDER BY start LIMIT 200").bind(from).all();
  const items = (results || []).map(row).map(({ status, updated, ...x }) => x);
  // فعاليات «رايح» للمستخدم (تتميز في التقويم)
  let going = [];
  const me = await sessionUser(env, request).catch(() => null);
  if (me) {
    const g = await env.DB.prepare(`SELECT e.id FROM event_going g JOIN events e ON e.id=g.event_id WHERE g.user_id=? AND e.deleted=0 AND COALESCE(NULLIF(e."end",''),e.start) >= ? LIMIT 100`).bind(me.id, from).all().catch(() => ({ results: [] }));
    going = (g.results || []).map((x) => x.id);
  }
  return J({ items, going }, 200, me ? 0 : 600);
}

/* ---------- المشرف ---------- */
export async function calendarAdmin(p, request, env, J) {
  if (!p.startsWith('/admin/calendar')) return null;
  await ensure(env);
  const M = request.method;
  if (p === '/admin/calendar') {
    if (M === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM cal_items ORDER BY start LIMIT 300').all();
      return J({ items: (results || []).map(row), kinds: KINDS, today: today() });
    }
    if (M !== 'POST') return null;
    const b = await request.json().catch(() => ({}));
    const { o, error } = clean({ ...b, status: undefined });
    if (error) return J({ error }, 400);
    if (!o.kind) o.kind = 'other';
    const t = now();
    const cols = Object.keys(o);
    const r = await env.DB.prepare(`INSERT INTO cal_items (${cols.map((c) => (c === 'end' ? '"end"' : c)).join(',')}, status, created, updated) VALUES (${cols.map(() => '?').join(',')}, 'draft', ?, ?)`).bind(...cols.map((k) => o[k]), t, t).run();
    return J({ ok: true, id: r.meta?.last_row_id, status: 'draft' });
  }
  if (p === '/admin/calendar/publish-all' && M === 'POST') {
    const r = await env.DB.prepare("UPDATE cal_items SET status='live', updated=? WHERE status='draft'").bind(now()).run();
    return J({ ok: true, published: r.meta?.changes || 0 });
  }
  const m = p.match(/^\/admin\/calendar\/(\d+)$/);
  if (m) {
    const cur = await env.DB.prepare('SELECT * FROM cal_items WHERE id=?').bind(+m[1]).first();
    if (!cur) return J({ error: 'not_found' }, 404);
    if (M === 'GET') return J(row(cur));
    if (M !== 'POST') return null;
    const b = await request.json().catch(() => ({}));
    const { o, error } = clean(b, cur);
    if (error) return J({ error }, 400);
    const cols = Object.keys(o);
    if (!cols.length) return J({ ok: true });
    await env.DB.prepare(`UPDATE cal_items SET ${cols.map((k) => (k === 'end' ? '"end"' : k) + '=?').join(',')}, updated=? WHERE id=?`).bind(...cols.map((k) => o[k]), now(), cur.id).run();
    return J({ ok: true });
  }
  return null;
}
