import { sessionUser } from './auth.js';
/* «رحلات جاهزة»: رحلات منسقة لكل مدينة (يوم في العلا، ويكند عائلي في أبها، جدة التاريخية مشي…)
   - كل رحلة: أيام، وكل يوم قائمة أماكن من الدليل بالترتيب، ووصف قصير
   - تنضاف من اللوحة أو من Claude (مسودة دايماً) ولا تطلع للناس إلا لما رامي ينشرها
   - المستخدم يحفظها في «رحلتي» بضغطة، ونعد كم واحد حفظها */
const now = () => Math.floor(Date.now() / 1000);
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS ready_trips ( id INTEGER PRIMARY KEY AUTOINCREMENT, city TEXT NOT NULL, title TEXT NOT NULL, title_en TEXT, intro TEXT, intro_en TEXT, tags TEXT NOT NULL DEFAULT '[]', days TEXT NOT NULL DEFAULT '[]', cover TEXT, status TEXT NOT NULL DEFAULT 'draft', sort INTEGER NOT NULL DEFAULT 50, saves INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL )",
  'CREATE INDEX IF NOT EXISTS ready_trips_city ON ready_trips(status, city, sort)',
];
const ALTERS = ['ALTER TABLE ready_trips ADD COLUMN plus_only INTEGER NOT NULL DEFAULT 0'];
let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
  for (const a of ALTERS) { try { await env.DB.prepare(a).run(); } catch { /* موجود */ } }
  ready = true;
}
const isPlusUser = (me) => { const t = now(); return !!me && ((me.plus_until && me.plus_until > t) || (me.plus_grant_until && me.plus_grant_until > t)); };

const TAGS = ['family', 'couples', 'friends', 'heritage', 'nature', 'food', 'budget', 'luxury', 'weekend', 'walking'];
/** days: [{ title, note, places: [id...] }] */
function cleanDays(days) {
  if (!Array.isArray(days)) return [];
  return days.slice(0, 7).map((d) => ({
    title: String(d?.title || '').slice(0, 60), note: String(d?.note || '').slice(0, 240),
    places: (Array.isArray(d?.places) ? d.places : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 10),
  })).filter((d) => d.places.length);
}
async function out(env, r, full) {
  const days = parse(r.days, []);
  const o = {
    id: r.id, city: r.city, title: r.title, titleEn: r.title_en || '', intro: r.intro || '', introEn: r.intro_en || '', tags: parse(r.tags, []),
    cover: r.cover || '', plusOnly: !!r.plus_only, dayCount: days.length, placeCount: days.reduce((n, d) => n + d.places.length, 0), saves: r.saves,
  };
  if (!o.cover && days[0]?.places?.[0]) {
    const p = await env.DB.prepare('SELECT thumb, images FROM places WHERE id=?').bind(days[0].places[0]).first();
    o.cover = parse(p?.images, [])[0] || p?.thumb || '';
  }
  if (full) Object.assign(o, { days, status: r.status, sort: r.sort });
  return o;
}

export async function tripsRoute(p, request, env, J, q) {
  if (!p.startsWith('/v1/trips')) return null;
  await ensure(env);
  let m;
  if (p === '/v1/trips' && request.method === 'GET') {
    const city = q.get('city');
    const { results } = await env.DB.prepare(`SELECT * FROM ready_trips WHERE status='live' ${city ? 'AND city=?' : ''} ORDER BY sort, saves DESC LIMIT 60`).bind(...(city ? [city] : [])).all();
    return J({ trips: await Promise.all(results.map((r) => out(env, r))) }, 200, 300);
  }
  if ((m = p.match(/^\/v1\/trips\/(\d+)$/)) && request.method === 'GET') {
    const r = await env.DB.prepare("SELECT * FROM ready_trips WHERE id=? AND status='live'").bind(+m[1]).first();
    if (!r) return J({ error: 'not_found' }, 404);
    const trip = await out(env, r, true);
    delete trip.status; delete trip.sort;
    // «حصرية دليل+»: غير المشترك يشوف الغلاف والوصف وأول يوم بس
    if (r.plus_only && !isPlusUser(await sessionUser(env, request))) { trip.locked = true; trip.days = trip.days.slice(0, 1); }
    return J({ trip }, 200, r.plus_only ? 0 : 300);
  }
  if ((m = p.match(/^\/v1\/trips\/(\d+)\/save$/)) && request.method === 'POST') {
    await env.DB.prepare('UPDATE ready_trips SET saves=saves+1 WHERE id=?').bind(+m[1]).run();
    return J({ ok: true });
  }
  return null;
}

export async function tripsAdmin(p, request, env, J) {
  if (!p.startsWith('/admin/trips')) return null;
  await ensure(env);
  let m;
  if (p === '/admin/trips' && request.method === 'GET') {
    const { results } = await env.DB.prepare("SELECT * FROM ready_trips WHERE status<>'hidden' ORDER BY city, sort, id DESC").all();
    return J({ trips: await Promise.all(results.map((r) => out(env, r, true))), tags: TAGS });
  }
  const save = async (id, b, old) => {
    const days = b.days !== undefined ? cleanDays(b.days) : parse(old?.days, []);
    if (!days.length) return J({ error: 'days_required' }, 400);
    const ids = [...new Set(days.flatMap((d) => d.places))];
    const found = await env.DB.prepare(`SELECT id FROM places WHERE deleted=0 AND id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    const missing = ids.filter((x) => !found.results.some((r) => r.id === x));
    if (missing.length) return J({ error: 'unknown_places', missing }, 400);
    const f = {
      city: String(b.city ?? old?.city ?? '').slice(0, 40), title: String(b.title ?? old?.title ?? '').slice(0, 80), title_en: String(b.title_en ?? old?.title_en ?? '').slice(0, 80),
      intro: String(b.intro ?? old?.intro ?? '').slice(0, 400), intro_en: String(b.intro_en ?? old?.intro_en ?? '').slice(0, 400),
      tags: JSON.stringify((Array.isArray(b.tags) ? b.tags : parse(old?.tags, [])).filter((x) => TAGS.includes(x))),
      cover: String(b.cover ?? old?.cover ?? '').slice(0, 500), sort: b.sort != null ? +b.sort : old?.sort ?? 50,
      status: ['draft', 'live', 'hidden'].includes(b.status) ? b.status : old?.status || 'draft',
      plus_only: b.plus_only != null ? (b.plus_only ? 1 : 0) : old?.plus_only || 0,
    };
    if (!f.city || f.title.length < 3) return J({ error: 'city_title_required' }, 400);
    if (id) {
      await env.DB.prepare('UPDATE ready_trips SET city=?,title=?,title_en=?,intro=?,intro_en=?,tags=?,days=?,cover=?,sort=?,status=?,plus_only=?,updated=? WHERE id=?')
        .bind(f.city, f.title, f.title_en, f.intro, f.intro_en, f.tags, JSON.stringify(days), f.cover, f.sort, f.status, f.plus_only, now(), id).run();
    } else {
      // الجديد مسودة دايماً (القاعدة: رامي هو اللي ينشر)
      const r = await env.DB.prepare("INSERT INTO ready_trips (city,title,title_en,intro,intro_en,tags,days,cover,sort,status,plus_only,created,updated) VALUES (?,?,?,?,?,?,?,?,?,'draft',?,?,?)")
        .bind(f.city, f.title, f.title_en, f.intro, f.intro_en, f.tags, JSON.stringify(days), f.cover, f.sort, f.plus_only, now(), now()).run();
      id = r.meta.last_row_id;
    }
    const row = await env.DB.prepare('SELECT * FROM ready_trips WHERE id=?').bind(id).first();
    return J({ ok: true, trip: await out(env, row, true) });
  };
  if (p === '/admin/trips' && request.method === 'POST') return save(0, await request.json().catch(() => ({})));
  if ((m = p.match(/^\/admin\/trips\/(\d+)$/)) && request.method === 'POST') {
    const old = await env.DB.prepare('SELECT * FROM ready_trips WHERE id=?').bind(+m[1]).first();
    if (!old) return J({ error: 'not_found' }, 404);
    return save(old.id, await request.json().catch(() => ({})), old);
  }
  return null;
}
