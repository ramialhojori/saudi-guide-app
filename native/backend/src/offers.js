/* العروض الرسمية (عروض البنوك والمتاجر والتطبيقات) — منفصلة عن كوبونات التجار (merchants.js)
   - تضيفها المهمة المجدولة أو رامي من اللوحة/MCP بأداة create_coupons، وكل عرض فيه رابط مصدره
   - الحالة الافتراضية pending (مسودة) لين يعتمدها رامي، إلا لو فعّل من «المميزات» خيار
     «نشر العروض الرسمية مباشرة» (official_auto) — وقتها تنضاف active
   - يرفض المكرر (نفس المتجر ونفس الخصم وهو لسا شغّال أو ينتظر) واللي تاريخ انتهائه قبل اليوم
   - العرض المنتهي يختفي من التطبيق تلقائياً (ما ينحذف)
     GET  /v1/offers?city=            للتطبيق (الفعّالة بس)
     POST /v1/offers/:id/open {act}   عدّاد: نسخ الكود / فتح الرابط
     GET  /admin/offers?status=        POST /admin/offers (إضافة دفعة)   POST /admin/offers/:id {status, ...}
   - ما نحذف شي: الحذف = إخفاء */
import { CITIES } from './normalize.js';
import { getFeatures } from './contrib.js';

const now = () => Math.floor(Date.now() / 1000);
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // بتوقيت مكة
const str = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const url = (v) => { const s = str(v, 300); return /^https?:\/\/\S+$/i.test(s) ? s : null; };

export const OFFER_CATS = ['food', 'cafe', 'hotel', 'fun', 'shop', 'other'];
export const OFFER_UNITS = ['pct', 'sar', 'gift', 'bogo', 'free_delivery', 'fixed_price', 'cashback', 'other'];
export const OFFER_CHANNELS = ['any', 'store', 'online', 'app', 'delivery'];
const ALL_CITY = /^(all|any|كل المدن|جميع المدن|السعودية|المملكة|كل المملكة|أونلاين|اونلاين|online)$/i;

/** المدينة: معرّف (riyadh) أو اسم عربي (الرياض) أو «كل المدن» → '' */
/* مدن ومحافظات ما لها صفحة خاصة في الدليل → منطقتها */
const CITY_ALIAS = {
  'الخبر': 'eastern-region', 'الدمام': 'eastern-region', 'الظهران': 'eastern-region', 'الأحساء': 'eastern-region', 'الاحساء': 'eastern-region', 'القطيف': 'eastern-region', 'الجبيل': 'eastern-region', 'حفر الباطن': 'eastern-region', 'الشرقية': 'eastern-region',
  'مكة': 'makkah-region', 'المدينة': 'medina', 'خميس مشيط': 'asir-region', 'النماص': 'asir-region', 'بريدة': 'qassim-region', 'عنيزة': 'qassim-region', 'القصيم': 'qassim-region',
  'سكاكا': 'aljawf-region', 'عرعر': 'northern-border', 'جازان': 'jizan', 'جيزان': 'jizan', 'الخرج': 'riyadh-region', 'نيوم': 'tabuk-region', 'الوجه': 'tabuk-region', 'حقل': 'tabuk-region',
};
function cityId(v) {
  const s = str(v, 40);
  if (!s || ALL_CITY.test(s)) return '';
  if (CITY_ALIAS[s]) return CITY_ALIAS[s];
  const c = CITIES.find((x) => x[0] === s || x[1] === s || x[1].replace(/^منطقة /, '') === s || s.includes(x[1]));
  return c ? c[0] : null;
}
const normStore = (s) => str(s, 60).toLowerCase().replace(/[\s\-_.'"«»]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS offers ( id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'official', store_name TEXT NOT NULL, store_key TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'other', city TEXT NOT NULL DEFAULT '', city_raw TEXT, value REAL, unit TEXT NOT NULL DEFAULT 'pct', title TEXT NOT NULL, code TEXT, channel TEXT NOT NULL DEFAULT 'any', source_url TEXT, use_url TEXT, starts_at TEXT, expires_at TEXT, min_order REAL, max_discount REAL, new_only INTEGER NOT NULL DEFAULT 0, delivery_app TEXT, terms TEXT, status TEXT NOT NULL DEFAULT 'pending', note TEXT, origin TEXT, legacy_id TEXT, copies INTEGER NOT NULL DEFAULT 0, opens INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL )",
  'CREATE INDEX IF NOT EXISTS offers_pub ON offers(status, city, expires_at)',
  'CREATE INDEX IF NOT EXISTS offers_store ON offers(store_key, unit, value)',
];
let ready = false;
async function ensure(env) { if (!ready) { await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))); ready = true; } }

/** نص الخصم للعرض */
export function offerOff(o) {
  const v = o.value != null ? (Number.isInteger(o.value) ? o.value : +o.value.toFixed(2)) : null;
  return ({ pct: v ? `${v}%` : 'خصم', sar: v ? `${v} ر.س` : 'خصم', gift: 'هدية', bogo: '1+1', free_delivery: 'توصيل مجاني', fixed_price: v ? `بـ${v} ر.س` : 'سعر خاص', cashback: v ? `${v}% كاش باك` : 'كاش باك', other: 'عرض' })[o.unit] || 'عرض';
}
const out = (o, admin) => ({
  id: o.id, kind: o.kind, store: o.store_name, category: o.category, city: o.city, cityName: o.city ? (CITIES.find((c) => c[0] === o.city) || [])[1] || '' : 'كل المدن',
  value: o.value, unit: o.unit, off: offerOff(o), title: o.title, code: o.code || '', channel: o.channel, sourceUrl: o.source_url || '', useUrl: o.use_url || o.source_url || '',
  startsAt: o.starts_at || '', expiresAt: o.expires_at || '', minOrder: o.min_order, maxDiscount: o.max_discount, newOnly: !!o.new_only, deliveryApp: o.delivery_app || '', terms: o.terms || '',
  ...(admin ? { status: o.status, note: o.note || '', origin: o.origin || '', copies: o.copies, opens: o.opens, created: o.created, updated: o.updated } : {}),
});

/** يتحقق من عرض واحد ويرجّع الصف الجاهز أو سبب الرفض */
function clean(x) {
  const store = str(x.store_name ?? x.store, 60);
  const title = str(x.title, 140);
  if (store.length < 2) return { error: 'store_required' };
  if (title.length < 5) return { error: 'title_required' };
  const city = cityId(x.city);
  if (city === null) return { error: 'bad_city' };
  const unit = OFFER_UNITS.includes(x.unit) ? x.unit : 'other';
  const value = num(x.value);
  if (['pct', 'sar', 'fixed_price', 'cashback'].includes(unit) && !(value > 0)) return { error: 'value_required' };
  if (unit === 'pct' && value > 100) return { error: 'bad_value' };
  const expires = date(x.expires_at);
  if (x.expires_at && !expires) return { error: 'bad_expires_at' };
  if (expires && expires < today()) return { error: 'expired' };
  const starts = date(x.starts_at);
  if (starts && expires && starts > expires) return { error: 'bad_dates' };
  const source = url(x.source_url);
  if (!source) return { error: 'source_url_required' };
  return {
    row: {
      kind: 'official', store_name: store, store_key: normStore(store), category: OFFER_CATS.includes(x.category) ? x.category : 'other', city, city_raw: str(x.city, 40) || null,
      value, unit, title, code: x.code ? str(x.code, 40) : null, channel: OFFER_CHANNELS.includes(x.channel) ? x.channel : 'any', source_url: source, use_url: url(x.use_url),
      starts_at: starts, expires_at: expires, min_order: num(x.min_order), max_discount: num(x.max_discount), new_only: x.new_only ? 1 : 0,
      delivery_app: str(x.delivery_app, 40) || null, terms: str(x.terms, 300) || null, legacy_id: str(x.legacy_id, 64) || null,
    },
  };
}

/** يضيف دفعة عروض (رسمية بس). الحالة: active لو official_auto مفعّل (أو رامي اختارها من اللوحة)، وإلا pending */
export async function createOffers(env, items, { status, origin = 'task' } = {}) {
  await ensure(env);
  const list = Array.isArray(items) ? items.slice(0, 50) : [];
  const F = await getFeatures(env);
  // اللوحة: حسب اختيار رامي. المهمة المجدولة والنقل: تنشر مباشرة لو «نشر العروض الرسمية مباشرة» مفعّل، وإلا مسودة
  const st = origin === 'panel' ? (status === 'active' ? 'active' : 'pending') : F.official_auto && status !== 'pending' ? 'active' : 'pending';
  const added = [], rejected = [];
  for (let i = 0; i < list.length; i++) {
    const x = list[i] || {};
    if (x.kind && x.kind !== 'official') { rejected.push({ index: i, store: str(x.store_name, 60), reason: 'kind_must_be_official' }); continue; }
    const c = clean(x);
    if (c.error) { rejected.push({ index: i, store: str(x.store_name ?? x.store, 60), reason: c.error }); continue; }
    const r = c.row;
    // مكرر: نفس المتجر ونفس الخصم (النوع والقيمة)، وهو لسا شغّال أو ينتظر أو ما انتهى
    const dup = await env.DB.prepare(`SELECT id FROM offers WHERE store_key=? AND unit=? AND COALESCE(value,-1)=COALESCE(?,-1)
        AND status IN ('pending','active','paused') AND (expires_at IS NULL OR expires_at>=?) LIMIT 1`).bind(r.store_key, r.unit, r.value, today()).first();
    if (dup) { rejected.push({ index: i, store: r.store_name, reason: 'duplicate', existing: dup.id }); continue; }
    if (r.legacy_id) {
      const old = await env.DB.prepare('SELECT id FROM offers WHERE legacy_id=?').bind(r.legacy_id).first();
      if (old) { rejected.push({ index: i, store: r.store_name, reason: 'already_imported', existing: old.id }); continue; }
    }
    const t = now();
    const res = await env.DB.prepare(`INSERT INTO offers (kind,store_name,store_key,category,city,city_raw,value,unit,title,code,channel,source_url,use_url,starts_at,expires_at,min_order,max_discount,new_only,delivery_app,terms,status,origin,legacy_id,created,updated)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(r.kind, r.store_name, r.store_key, r.category, r.city, r.city_raw, r.value, r.unit, r.title, r.code, r.channel, r.source_url, r.use_url,
      r.starts_at, r.expires_at, r.min_order, r.max_discount, r.new_only, r.delivery_app, r.terms, st, origin, r.legacy_id, t, t).run();
    added.push({ id: res.meta.last_row_id, store: r.store_name, off: offerOff(r), status: st });
  }
  return { added, rejected, status: st, autoPublish: !!F.official_auto };
}

/* ═════════ للتطبيق ═════════ */
export async function offersRoute(p, request, env, J, q) {
  if (!p.startsWith('/v1/offers')) return null;
  await ensure(env);
  let m;
  if (p === '/v1/offers' && request.method === 'GET') {
    const city = q.get('city') || '';
    const args = [today()];
    let sql = "SELECT * FROM offers WHERE status='active' AND (expires_at IS NULL OR expires_at>=?1) AND (starts_at IS NULL OR starts_at<=?1)";
    if (city) { sql += " AND (city='' OR city=?2)"; args.push(city); }
    const { results } = await env.DB.prepare(sql + ' ORDER BY (expires_at IS NULL), expires_at, id DESC LIMIT 100').bind(...args).all();
    return J({ offers: results.map((o) => out(o)) }, 200, 300);
  }
  if ((m = p.match(/^\/v1\/offers\/(\d+)\/open$/)) && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const col = b.act === 'copy' ? 'copies' : 'opens';
    await env.DB.prepare(`UPDATE offers SET ${col}=${col}+1 WHERE id=? AND status='active'`).bind(+m[1]).run();
    return J({ ok: true });
  }
  return null;
}

/* ═════════ للإدارة ═════════ */
export async function offersAdmin(p, request, env, J, q) {
  if (!p.startsWith('/admin/offers')) return null;
  await ensure(env);
  let m;
  if (p === '/admin/offers' && request.method === 'GET') {
    const st = q.get('status') || 'pending';
    const where = st === 'all' ? "status<>'hidden'" : st === 'expired' ? "status<>'hidden' AND expires_at<?" : 'status=?';
    const args = st === 'all' ? [] : st === 'expired' ? [today()] : [st];
    const { results } = await env.DB.prepare(`SELECT * FROM offers WHERE ${where} ORDER BY id DESC LIMIT 300`).bind(...args).all();
    const c = await env.DB.prepare("SELECT status, COUNT(*) n FROM offers GROUP BY status").all();
    return J({ offers: results.map((o) => out(o, true)), counts: Object.fromEntries(c.results.map((x) => [x.status, x.n])), today: today() });
  }
  if (p === '/admin/offers' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const origin = ['task', 'panel', 'import'].includes(b.origin) ? b.origin : 'task';
    return J(await createOffers(env, b.offers || b.items || [], { status: b.status, origin }));
  }
  if ((m = p.match(/^\/admin\/offers\/(\d+)$/)) && request.method === 'POST') {
    const o = await env.DB.prepare('SELECT * FROM offers WHERE id=?').bind(+m[1]).first();
    if (!o) return J({ error: 'not_found' }, 404);
    const b = await request.json().catch(() => ({}));
    const status = ['pending', 'active', 'paused', 'rejected', 'hidden'].includes(b.status) ? b.status : o.status;
    const f = { ...o };
    if (b.fields && typeof b.fields === 'object') {
      const c = clean({ ...o, store_name: o.store_name, ...b.fields, source_url: b.fields.source_url ?? o.source_url, expires_at: b.fields.expires_at ?? o.expires_at });
      if (c.error) return J({ error: c.error }, 400);
      Object.assign(f, c.row);
    }
    const note = b.note === undefined ? o.note : str(b.note, 300);
    await env.DB.prepare(`UPDATE offers SET status=?, note=?, store_name=?, store_key=?, category=?, city=?, value=?, unit=?, title=?, code=?, channel=?, source_url=?, use_url=?, starts_at=?, expires_at=?,
        min_order=?, max_discount=?, new_only=?, delivery_app=?, terms=?, updated=? WHERE id=?`).bind(status, note, f.store_name, f.store_key, f.category, f.city, f.value, f.unit, f.title, f.code, f.channel,
      f.source_url, f.use_url, f.starts_at, f.expires_at, f.min_order, f.max_discount, f.new_only, f.delivery_app, f.terms, now(), o.id).run();
    return J({ ok: true, status });
  }
  if (p === '/admin/offers/approve-all' && request.method === 'POST') {
    const r = await env.DB.prepare("UPDATE offers SET status='active', updated=? WHERE status='pending' AND (expires_at IS NULL OR expires_at>=?)").bind(now(), today()).run();
    return J({ ok: true, approved: r.meta.changes || 0 });
  }
  return null;
}
