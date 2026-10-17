import { sessionUser } from './auth.js';
/* «إعلانات داخلية»: إعلانات يضيفها رامي من اللوحة (ترويج لأقسام دليل، أو راعي مجاني)
   - كل إعلان: صورة، عنوان، نص، زر، رابط (مسار داخل التطبيق يبدأ بـ / أو رابط https)
   - المكان: banner (شريط تحت الصفحات) و/أو native (بطاقة بين المحتوى)
   - مدن محددة أو كل المدن، وتاريخ بداية ونهاية (اختياري)
   - مسودة لين رامي ينشره، ونعد المشاهدات والضغطات
   - نسبة الظهور مقابل إعلانات قوقل (AdMob) تتعدل من اللوحة: kv 'house_ads'
   - مشتركين دليل+ ما يشوفونها (مثل باقي الإعلانات)
   ⚠️ بيع الإعلانات للتجار ينتظر السجل التجاري: هذي للترويج الذاتي والرعاة المجانيين */
const now = () => Math.floor(Date.now() / 1000);
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const PLACEMENTS = ['banner', 'native'];
const STATUSES = ['draft', 'live', 'hidden'];

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS house_ads ( id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, title_en TEXT, body TEXT, body_en TEXT, cta TEXT, cta_en TEXT, image TEXT, link TEXT, sponsor TEXT, placements TEXT NOT NULL DEFAULT '[\"banner\",\"native\"]', cities TEXT NOT NULL DEFAULT '[]', starts INTEGER, ends INTEGER, status TEXT NOT NULL DEFAULT 'draft', weight INTEGER NOT NULL DEFAULT 1, views INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL )",
  'CREATE INDEX IF NOT EXISTS house_ads_status ON house_ads(status)',
];
let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
  ready = true;
}
const isPlusUser = (me) => { const t = now(); return !!me && ((me.plus_until && me.plus_until > t) || (me.plus_grant_until && me.plus_grant_until > t)); };

export async function getHouseSettings(env) {
  const r = await env.DB.prepare("SELECT v FROM kv WHERE k='house_ads'").first().catch(() => null);
  const v = parse(r?.v, {});
  const share = Number.isFinite(+v.share) ? Math.max(0, Math.min(100, Math.round(+v.share))) : 50;
  return { share };
}

const row = (r) => ({
  id: r.id, title: r.title, titleEn: r.title_en || '', body: r.body || '', bodyEn: r.body_en || '', cta: r.cta || '', ctaEn: r.cta_en || '',
  image: r.image || '', link: r.link || '', sponsor: r.sponsor || '', placements: parse(r.placements, PLACEMENTS), cities: parse(r.cities, []),
  starts: r.starts || null, ends: r.ends || null, status: r.status, weight: r.weight, views: r.views, clicks: r.clicks, created: r.created, updated: r.updated,
});

/** يقبل تاريخ «2026-10-20» أو «2026-10-20T18:00» (بتوقيت مكة) أو رقم ثواني */
function toTs(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Math.floor(v);
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return +s;
  const iso = /T/.test(s) ? s : s + 'T00:00';
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + '+03:00');
  return Number.isFinite(t) ? Math.floor(t / 1000) : undefined;
}
const okLink = (u) => !u || /^https:\/\//.test(u) || /^\/[a-z0-9/_\-?=&.%]*$/i.test(u);

function clean(b, cur = {}) {
  const o = {};
  const str = (k, n) => { if (b[k] !== undefined) o[k] = String(b[k] ?? '').trim().slice(0, n); };
  str('title', 80); str('title_en', 80); str('body', 200); str('body_en', 200); str('cta', 24); str('cta_en', 24); str('sponsor', 60);
  if (b.image !== undefined) { const u = String(b.image || '').trim(); if (u && !/^https:\/\//.test(u)) return { error: 'bad_image' }; o.image = u.slice(0, 600); }
  if (b.link !== undefined) { const u = String(b.link || '').trim(); if (!okLink(u)) return { error: 'bad_link' }; o.link = u.slice(0, 600); }
  if (b.placements !== undefined) { const p = (Array.isArray(b.placements) ? b.placements : [b.placements]).filter((x) => PLACEMENTS.includes(x)); if (!p.length) return { error: 'no_placement' }; o.placements = JSON.stringify([...new Set(p)]); }
  if (b.cities !== undefined) o.cities = JSON.stringify((Array.isArray(b.cities) ? b.cities : []).map(String).filter(Boolean).slice(0, 40));
  for (const k of ['starts', 'ends']) if (b[k] !== undefined) { const t = toTs(b[k]); if (t === undefined) return { error: 'bad_date' }; o[k] = t; }
  if (b.weight !== undefined) o.weight = Math.max(1, Math.min(10, Math.round(+b.weight || 1)));
  if (b.status !== undefined) { if (!STATUSES.includes(b.status)) return { error: 'bad_status' }; o.status = b.status; }
  const title = o.title ?? cur.title;
  if (!title) return { error: 'title_required' };
  const s = o.starts !== undefined ? o.starts : cur.starts, e = o.ends !== undefined ? o.ends : cur.ends;
  if (s && e && e <= s) return { error: 'bad_range' };
  return { o };
}

/* ---------- عام ---------- */
export async function houseAdsRoute(p, request, env, J, q) {
  if (!p.startsWith('/v1/house-ads')) return null;
  await ensure(env);
  if (p === '/v1/house-ads' && request.method === 'GET') {
    if (isPlusUser(await sessionUser(env, request).catch(() => null))) return J({ share: 0, ads: [] }, 200, 0);
    const city = String(q?.get?.('city') || '');
    const t = now();
    const { results } = await env.DB.prepare("SELECT * FROM house_ads WHERE status='live' AND (starts IS NULL OR starts<=?) AND (ends IS NULL OR ends>?) ORDER BY id DESC LIMIT 50").bind(t, t).all();
    const ads = (results || []).map(row).filter((a) => !a.cities.length || !city || a.cities.includes(city))
      .map(({ id, title, titleEn, body, bodyEn, cta, ctaEn, image, link, sponsor, placements, weight, cities }) => ({ id, title, titleEn, body, bodyEn, cta, ctaEn, image, link, sponsor, placements, weight, cities }));
    const { share } = await getHouseSettings(env);
    return J({ share: ads.length ? share : 0, ads }, 200, 300);
  }
  const m = p.match(/^\/v1\/house-ads\/(\d+)\/(view|click)$/);
  if (m && request.method === 'POST') {
    const col = m[2] === 'view' ? 'views' : 'clicks';
    await env.DB.prepare(`UPDATE house_ads SET ${col}=${col}+1 WHERE id=? AND status='live'`).bind(+m[1]).run();
    return J({ ok: true });
  }
  return null;
}

/* ---------- المشرف ---------- */
export async function houseAdsAdmin(p, request, env, J) {
  if (!p.startsWith('/admin/house-ads')) return null;
  await ensure(env);
  const M = request.method;
  if (p === '/admin/house-ads/settings') {
    if (M === 'GET') return J(await getHouseSettings(env));
    if (M !== 'POST') return null;
    const b = await request.json().catch(() => ({}));
    const share = Math.max(0, Math.min(100, Math.round(+b.share)));
    if (!Number.isFinite(share)) return J({ error: 'bad_share' }, 400);
    await env.DB.prepare("INSERT INTO kv (k, v) VALUES ('house_ads', ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify({ share })).run();
    return J({ ok: true, share });
  }
  if (p === '/admin/house-ads') {
    if (M === 'GET') {
      const { results } = await env.DB.prepare("SELECT * FROM house_ads ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, id DESC LIMIT 200").all();
      return J({ ads: (results || []).map(row), ...(await getHouseSettings(env)), now: now() });
    }
    if (M !== 'POST') return null;
    const b = await request.json().catch(() => ({}));
    // جديد = مسودة دايماً، النشر بقرار رامي
    const { o, error } = clean({ ...b, status: undefined });
    if (error) return J({ error }, 400);
    const t = now();
    const cols = Object.keys(o);
    const r = await env.DB.prepare(`INSERT INTO house_ads (${cols.join(',')}, status, created, updated) VALUES (${cols.map(() => '?').join(',')}, 'draft', ?, ?)`).bind(...cols.map((k) => o[k]), t, t).run();
    return J({ ok: true, id: r.meta?.last_row_id, status: 'draft' });
  }
  const m = p.match(/^\/admin\/house-ads\/(\d+)$/);
  if (m) {
    const cur = await env.DB.prepare('SELECT * FROM house_ads WHERE id=?').bind(+m[1]).first();
    if (!cur) return J({ error: 'not_found' }, 404);
    if (M === 'GET') return J(row(cur));
    if (M !== 'POST') return null;
    const b = await request.json().catch(() => ({}));
    const { o, error } = clean(b, cur);
    if (error) return J({ error }, 400);
    if (o.status === 'live' && !(o.image ?? cur.image)) return J({ error: 'image_required' }, 400);
    const cols = Object.keys(o);
    if (!cols.length) return J({ ok: true });
    await env.DB.prepare(`UPDATE house_ads SET ${cols.map((k) => k + '=?').join(',')}, updated=? WHERE id=?`).bind(...cols.map((k) => o[k]), now(), cur.id).run();
    return J({ ok: true });
  }
  return null;
}
