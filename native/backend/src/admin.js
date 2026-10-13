/* لوحة التحكم: إدارة الأماكن والفعاليات والمجتمع (كل المسارات تحت /admin وتحتاج X-Admin-Key)
   حالات المحتوى في عمود deleted: 0 = منشور، 1 = مخفي، 2 = مسودة
   - أي مكان جديد يبدأ مسودة (ما يظهر في التطبيق لين تنشره)
   - ما نحذف شي: «حذف» = إخفاء
   - أي تعديل من اللوحة يعلّم الصف sig='panel' عشان مزامنة قودبابر ما ترجع تغيّره */

import { CITIES, KIND_OF, searchKey, nearestCity } from './normalize.js';

const now = () => Math.floor(Date.now() / 1000);
const STATUS = { live: 0, hidden: 1, draft: 2 };
const STATUS_NAME = ['live', 'hidden', 'draft'];
const NEW_ID_BASE = 900000000; // أرقام اللوحة بعيدة عن أرقام قودبابر
const parse = (s, d = []) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
const arr = (v, max = 30) => (Array.isArray(v) ? v : String(v || '').split(/[,،\n]/)).map((x) => str(x, 300)).filter(Boolean).slice(0, max);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** نص عادي → HTML بسيط (فقرات). لو فيه وسوم HTML نخليه مثل ما هو */
const toHtml = (t) => (!t ? '' : /<\w+/.test(t) ? t : t.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join(''));

async function nextId(env, table) {
  const r = await env.DB.prepare(`SELECT MAX(id) m FROM ${table}`).first();
  return Math.max(NEW_ID_BASE, r.m || 0) + 1;
}

/* ——— الأماكن ——— */
function placeFields(b) {
  const cats = arr(b.cats);
  const kinds = [...new Set([...arr(b.kinds), ...cats.map((c) => KIND_OF[c]).filter(Boolean)])].sort();
  const images = arr(b.images, 20);
  const title = str(b.title, 200), title_en = str(b.title_en, 200);
  return {
    city: str(b.city, 40), title, title_en, cats: JSON.stringify(cats), kinds: JSON.stringify(kinds),
    summary: str(b.summary, 400), body: toHtml(str(b.body, 20000)), images: JSON.stringify(images), thumb: images[0] || '',
    lat: num(b.lat), lng: num(b.lng), address: str(b.address, 300), phone: str(b.phone, 40), website: str(b.website, 300), email: str(b.email, 120),
    search: searchKey(title, title_en, cats.join(' ')),
  };
}
const placeOut = (r) => ({
  id: r.id, city: r.city, title: r.title, title_en: r.title_en || '', cats: parse(r.cats), kinds: parse(r.kinds),
  summary: r.summary || '', body: r.body || '', images: parse(r.images), thumb: r.thumb || '', lat: r.lat, lng: r.lng,
  address: r.address || '', phone: r.phone || '', website: r.website || '', email: r.email || '', url: r.url || '',
  status: STATUS_NAME[r.deleted] || 'hidden', fromPanel: r.sig === 'panel', updated: r.updated,
});

/* ——— الفعاليات ——— */
function eventFields(b) {
  const images = arr(b.images, 20);
  const lat = num(b.lat), lng = num(b.lng);
  const iso = (d) => { if (!d) return ''; const t = new Date(d); return isNaN(t) ? '' : t.toISOString(); };
  return {
    title: str(b.title, 200), summary: str(b.summary, 400), body: toHtml(str(b.body, 20000)), images: JSON.stringify(images), thumb: images[0] || '',
    start: iso(b.start), end: iso(b.end), all_day: b.all_day ? 1 : 0, cats: JSON.stringify(arr(b.cats)),
    city: str(b.city, 40) || nearestCity(lat, lng) || null, lat, lng, address: str(b.address, 300), tickets: str(b.tickets, 500), link: str(b.link, 500),
  };
}
const eventOut = (r) => ({
  id: r.id, title: r.title, summary: r.summary || '', body: r.body || '', images: parse(r.images), thumb: r.thumb || '',
  start: r.start || '', end: r.end || '', all_day: !!r.all_day, cats: parse(r.cats), city: r.city || '', lat: r.lat, lng: r.lng,
  address: r.address || '', tickets: r.tickets || '', link: r.link || '', status: STATUS_NAME[r.deleted] || 'hidden', fromPanel: r.sig === 'panel', updated: r.updated,
});

async function save(env, table, id, f) {
  const cols = Object.keys(f);
  const q = (c) => (c === 'end' ? '"end"' : c);
  if (id) {
    await env.DB.prepare(`UPDATE ${table} SET ${cols.map((c) => `${q(c)}=?`).join(',')}, sig='panel', updated=? WHERE id=?`).bind(...cols.map((c) => f[c]), now(), id).run();
    return id;
  }
  const nid = await nextId(env, table);
  await env.DB.prepare(`INSERT INTO ${table} (id,${cols.map(q).join(',')},sig,updated,deleted) VALUES (?,${cols.map(() => '?').join(',')},'panel',?,2)`)
    .bind(nid, ...cols.map((c) => f[c]), now()).run();
  return nid;
}

export async function adminRoute(p, request, env, J, q) {
  const M = request.method;
  let m;

  if (p === '/admin/meta') {
    const ev = await env.DB.prepare('SELECT cats FROM events WHERE deleted<>1').all();
    const pl = await env.DB.prepare('SELECT DISTINCT cats FROM places WHERE deleted=0').all();
    const evCats = [...new Set(ev.results.flatMap((r) => parse(r.cats)))].sort();
    const plCats = [...new Set(pl.results.flatMap((r) => parse(r.cats)))].sort();
    return J({ cities: CITIES.map((c) => ({ id: c[0], name: c[1], lat: c[4], lng: c[5] })), kinds: ['islamic', 'heritage', 'nature', 'sights', 'fun', 'food', 'cafe', 'shopping'], placeCats: plCats, eventCats: evCats });
  }

  if (p === '/admin/summary') {
    const n = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM places WHERE deleted=0) places, (SELECT COUNT(*) FROM places WHERE deleted=2) drafts, (SELECT COUNT(*) FROM places WHERE deleted=1) hidden,
      (SELECT COUNT(*) FROM events WHERE deleted=0 AND COALESCE(NULLIF("end",''),start) >= ?1) events, (SELECT COUNT(*) FROM events WHERE deleted=2) eventDrafts,
      (SELECT COUNT(*) FROM users WHERE deleted=0) users, (SELECT COUNT(*) FROM posts WHERE status='visible') posts, (SELECT COUNT(*) FROM answers WHERE status='visible') answers,
      (SELECT COUNT(*) FROM posts WHERE reports>0 AND hidden_by IS NOT 'admin') + (SELECT COUNT(*) FROM answers WHERE reports>0 AND hidden_by IS NOT 'admin') reported,
      (SELECT COUNT(*) FROM places WHERE lat IS NULL OR lat=0) noGeo, (SELECT COUNT(*) FROM places WHERE deleted=0 AND (thumb IS NULL OR thumb='')) noPhoto`).bind(new Date().toISOString()).first();
    const recent = await env.DB.prepare("SELECT p.id, p.kind, p.text, p.created, u.name FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status='visible' ORDER BY p.id DESC LIMIT 5").all();
    return J({ counts: n, recent: recent.results });
  }

  /* صور اللوحة → R2 */
  if (p === '/admin/upload' && M === 'POST') {
    if (!env.MEDIA) return J({ error: 'media_not_configured' }, 503);
    const type = request.headers.get('Content-Type') || '';
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
    if (!ext) return J({ error: 'bad_type' }, 400);
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 10 * 1024 * 1024) return J({ error: 'bad_size' }, 400);
    const key = `a/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, buf, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
    return J({ url: `${new URL(request.url).origin}/media/${key}` });
  }

  /* ——— الأماكن ——— */
  if (p === '/admin/places' && M === 'GET') {
    const where = ['1=1'], args = [];
    if (q.get('city')) { where.push('city=?'); args.push(q.get('city')); }
    if (q.get('status') in STATUS) { where.push('deleted=?'); args.push(STATUS[q.get('status')]); }
    if (q.get('q')) { where.push('(search LIKE ? OR CAST(id AS TEXT)=?)'); args.push(`%${searchKey(q.get('q'))}%`, q.get('q').trim()); }
    if (q.get('missing') === 'geo') where.push('(lat IS NULL OR lat=0)');
    if (q.get('missing') === 'photo') where.push("(thumb IS NULL OR thumb='')");
    const page = Math.max(1, +q.get('page') || 1);
    const total = await env.DB.prepare(`SELECT COUNT(*) n FROM places WHERE ${where.join(' AND ')}`).bind(...args).first();
    const { results } = await env.DB.prepare(`SELECT * FROM places WHERE ${where.join(' AND ')} ORDER BY updated DESC, id DESC LIMIT 30 OFFSET ?`).bind(...args, (page - 1) * 30).all();
    return J({ total: total.n, page, places: results.map(placeOut) });
  }
  if ((m = p.match(/^\/admin\/places\/(\d+)$/)) && M === 'GET') {
    const r = await env.DB.prepare('SELECT * FROM places WHERE id=?').bind(+m[1]).first();
    return r ? J({ place: placeOut(r) }) : J({ error: 'not_found' }, 404);
  }
  if ((p === '/admin/places' && M === 'POST') || ((m = p.match(/^\/admin\/places\/(\d+)$/)) && M === 'PUT')) {
    const f = placeFields(await request.json().catch(() => ({})));
    if (!f.title) return J({ error: 'title_required' }, 400);
    if (!CITIES.some((c) => c[0] === f.city)) return J({ error: 'bad_city' }, 400);
    const id = await save(env, 'places', m ? +m[1] : 0, f);
    return J({ place: placeOut(await env.DB.prepare('SELECT * FROM places WHERE id=?').bind(id).first()) });
  }
  if ((m = p.match(/^\/admin\/(places|events)\/(\d+)\/status$/)) && M === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (!(b.status in STATUS)) return J({ error: 'bad_status' }, 400);
    await env.DB.prepare(`UPDATE ${m[1]} SET deleted=?, sig='panel', updated=? WHERE id=?`).bind(STATUS[b.status], now(), +m[2]).run();
    return J({ ok: true, status: b.status });
  }

  /* ——— الفعاليات ——— */
  if (p === '/admin/events' && M === 'GET') {
    const where = ['1=1'], args = [];
    const when = q.get('when') || 'upcoming';
    if (when === 'upcoming') { where.push("COALESCE(NULLIF(\"end\",''),start) >= ?"); args.push(new Date().toISOString()); }
    if (when === 'past') { where.push("COALESCE(NULLIF(\"end\",''),start) < ?"); args.push(new Date().toISOString()); }
    if (q.get('status') in STATUS) { where.push('deleted=?'); args.push(STATUS[q.get('status')]); }
    if (q.get('city')) { where.push('city=?'); args.push(q.get('city')); }
    if (q.get('q')) { where.push('(title LIKE ? OR cats LIKE ?)'); args.push(`%${q.get('q')}%`, `%${q.get('q')}%`); }
    const { results } = await env.DB.prepare(`SELECT * FROM events WHERE ${where.join(' AND ')} ORDER BY start ${when === 'past' ? 'DESC' : 'ASC'} LIMIT 200`).bind(...args).all();
    return J({ events: results.map(eventOut) });
  }
  if ((m = p.match(/^\/admin\/events\/(\d+)$/)) && M === 'GET') {
    const r = await env.DB.prepare('SELECT * FROM events WHERE id=?').bind(+m[1]).first();
    return r ? J({ event: eventOut(r) }) : J({ error: 'not_found' }, 404);
  }
  if ((p === '/admin/events' && M === 'POST') || ((m = p.match(/^\/admin\/events\/(\d+)$/)) && M === 'PUT')) {
    const f = eventFields(await request.json().catch(() => ({})));
    if (!f.title) return J({ error: 'title_required' }, 400);
    if (!f.start) return J({ error: 'start_required' }, 400);
    const id = await save(env, 'events', m ? +m[1] : 0, f);
    return J({ event: eventOut(await env.DB.prepare('SELECT * FROM events WHERE id=?').bind(id).first()) });
  }

  /* ——— المستخدمين ——— */
  if (p === '/admin/users' && M === 'GET') {
    const args = [];
    let sql = 'SELECT id,name,city,role,points,created,seen FROM users WHERE deleted=0';
    if (q.get('q')) { sql += ' AND (name LIKE ? OR id=?)'; args.push(`%${q.get('q')}%`, q.get('q')); }
    const { results } = await env.DB.prepare(sql + ' ORDER BY points DESC, seen DESC LIMIT 100').bind(...args).all();
    return J({ users: results });
  }

  return null;
}
