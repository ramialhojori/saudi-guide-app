/* لوحة التحكم: إدارة الأماكن والفعاليات والمجتمع (كل المسارات تحت /admin وتحتاج X-Admin-Key)
   حالات المحتوى في عمود deleted: 0 = منشور، 1 = مخفي، 2 = مسودة
   - أي مكان جديد يبدأ مسودة (ما يظهر في التطبيق لين تنشره)
   - ما نحذف شي: «حذف» = إخفاء
   - أي تعديل من اللوحة يعلّم الصف sig='panel' عشان مزامنة قودبابر ما ترجع تغيّره */

import { CITIES, KIND_OF, searchKey, nearestCity, km } from './normalize.js';

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

const articleOut = (r) => ({ id: r.id, title: r.title, author: r.author || '', date: r.date || '', summary: r.summary || '', body: r.body || '', images: parse(r.images), thumb: r.thumb || '', cats: parse(r.cats), section: r.section || '', url: r.url || '', status: STATUS_NAME[r.deleted] || 'hidden', updated: r.updated });

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

  /* ——— إضافة جماعية (للمساعد): كلها تنحفظ مسودات، ويرجع تنبيه لو فيه تكرار ——— */
  if ((m = p.match(/^\/admin\/(places|events)\/bulk$/)) && M === 'POST') {
    const b = await request.json().catch(() => ({}));
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 50);
    const out = [];
    for (const it of items) {
      try {
        if (m[1] === 'places') {
          const f = placeFields(it);
          if (!f.title || !CITIES.some((c) => c[0] === f.city)) { out.push({ title: f.title, error: 'title_or_city' }); continue; }
          const dupe = await env.DB.prepare('SELECT id,title FROM places WHERE deleted<>1 AND city=? AND (search=? OR (lat IS NOT NULL AND ABS(lat-?)<0.0012 AND ABS(lng-?)<0.0012)) LIMIT 1').bind(f.city, f.search, f.lat || 0, f.lng || 0).first();
          if (dupe && !it.force) { out.push({ title: f.title, skipped: 'duplicate', existing: dupe }); continue; }
          out.push({ title: f.title, id: await save(env, 'places', 0, f) });
        } else {
          const f = eventFields(it);
          if (!f.title || !f.start) { out.push({ title: f.title, error: 'title_or_start' }); continue; }
          const dupe = await env.DB.prepare('SELECT id,title FROM events WHERE deleted<>1 AND title=? AND substr(start,1,10)=substr(?,1,10) LIMIT 1').bind(f.title, f.start).first();
          if (dupe && !it.force) { out.push({ title: f.title, skipped: 'duplicate', existing: dupe }); continue; }
          out.push({ title: f.title, id: await save(env, 'events', 0, f) });
        }
      } catch (e) { out.push({ title: it?.title, error: String(e.message || e) }); }
    }
    return J({ results: out, added: out.filter((x) => x.id).length });
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

  /* ——— تنبيه التكرار: نفس المدينة واسم قريب، أو أقل من 150 متر ——— */
  if (p === '/admin/places/similar') {
    const title = searchKey(q.get('title') || ''), city = q.get('city') || '', lat = +q.get('lat') || 0, lng = +q.get('lng') || 0, self = +q.get('id') || 0;
    const words = title.split(' ').filter((w) => w.length > 2).slice(0, 3);
    const out = new Map();
    if (words.length) {
      const { results } = await env.DB.prepare(`SELECT * FROM places WHERE deleted<>1 AND id<>? ${city ? 'AND city=?' : ''} AND ${words.map(() => 'search LIKE ?').join(' AND ')} LIMIT 8`)
        .bind(self, ...(city ? [city] : []), ...words.map((w) => `%${w}%`)).all();
      results.forEach((r) => out.set(r.id, { ...placeOut(r), why: 'اسم مشابه' }));
    }
    if (lat && lng) {
      const d = 0.002;
      const { results } = await env.DB.prepare('SELECT * FROM places WHERE deleted<>1 AND id<>? AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? LIMIT 8').bind(self, lat - d, lat + d, lng - d, lng + d).all();
      results.forEach((r) => { const m2 = Math.round(km(lat, lng, r.lat, r.lng) * 1000); if (m2 <= 150) out.set(r.id, { ...placeOut(r), why: out.has(r.id) ? `اسم مشابه وعلى بعد ${m2} م` : `على بعد ${m2} م` }); });
    }
    return J({ similar: [...out.values()].slice(0, 6).map((x) => ({ id: x.id, title: x.title, city: x.city, thumb: x.thumb, status: x.status, why: x.why })) });
  }

  /* ——— مختارات الأسبوع ——— */
  if (p === '/admin/weekly' && M === 'GET') {
    const row = await env.DB.prepare("SELECT v FROM kv WHERE k='weekly_pool'").first();
    const pool = parse(row?.v, []);
    const ids = pool.map((x) => x.id);
    const rows = ids.length ? (await env.DB.prepare(`SELECT id,title,city,thumb,deleted FROM places WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results : [];
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    return J({ pool: pool.map((x) => ({ ...x, title: by[x.id]?.title || '(مكان محذوف)', city: by[x.id]?.city || '', thumb: by[x.id]?.thumb || '', status: STATUS_NAME[by[x.id]?.deleted ?? 1] })) });
  }

  /* ——— المقالات والأخبار ——— */
  if (p === '/admin/articles' && M === 'GET') {
    const args = [];
    let sql = 'SELECT * FROM articles WHERE 1=1';
    if (q.get('status') in STATUS) { sql += ' AND deleted=?'; args.push(STATUS[q.get('status')]); }
    if (q.get('q')) { sql += ' AND title LIKE ?'; args.push(`%${q.get('q')}%`); }
    const { results } = await env.DB.prepare(sql + ' ORDER BY date DESC LIMIT 100').bind(...args).all();
    return J({ articles: results.map(articleOut) });
  }
  if ((m = p.match(/^\/admin\/articles\/(\d+)$/)) && M === 'GET') {
    const r = await env.DB.prepare('SELECT * FROM articles WHERE id=?').bind(+m[1]).first();
    return r ? J({ article: articleOut(r) }) : J({ error: 'not_found' }, 404);
  }
  if ((p === '/admin/articles' && M === 'POST') || ((m = p.match(/^\/admin\/articles\/(\d+)$/)) && M === 'PUT')) {
    const b = await request.json().catch(() => ({}));
    const images = arr(b.images, 20);
    const f = { title: str(b.title, 200), author: str(b.author, 80), date: b.date ? new Date(b.date).toISOString() : new Date().toISOString(), summary: str(b.summary, 400), body: toHtml(str(b.body, 40000)), images: JSON.stringify(images), thumb: images[0] || '', cats: JSON.stringify(arr(b.cats)), section: str(b.section, 80) };
    if (!f.title) return J({ error: 'title_required' }, 400);
    const id = await save(env, 'articles', m ? +m[1] : 0, f);
    return J({ article: articleOut(await env.DB.prepare('SELECT * FROM articles WHERE id=?').bind(id).first()) });
  }
  if ((m = p.match(/^\/admin\/articles\/(\d+)\/status$/)) && M === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (!(b.status in STATUS)) return J({ error: 'bad_status' }, 400);
    await env.DB.prepare("UPDATE articles SET deleted=?, sig='panel', updated=? WHERE id=?").bind(STATUS[b.status], now(), +m[1]).run();
    return J({ ok: true });
  }

  /* ——— المواسم: تتكوّن من تصنيفات الفعاليات (موسم… / لحظات…) ——— */
  if (p === '/admin/seasons') {
    const { results } = await env.DB.prepare("SELECT id,title,start,\"end\",cats,deleted,city FROM events WHERE deleted<>1 AND (cats LIKE '%موسم%' OR cats LIKE '%لحظات%')").all();
    const map = new Map();
    for (const r of results) for (const c of parse(r.cats)) {
      if (!/^(موسم|لحظات)/.test(c)) continue;
      const x = map.get(c) || { name: c, total: 0, live: 0, drafts: 0, start: '', end: '' };
      x.total++; if (r.deleted === 0) x.live++; if (r.deleted === 2) x.drafts++;
      if (r.start && (!x.start || r.start < x.start)) x.start = r.start;
      const e = r.end || r.start; if (e && e > x.end) x.end = e;
      map.set(c, x);
    }
    return J({ seasons: [...map.values()].sort((a, b) => b.end.localeCompare(a.end)) });
  }

  /* ——— رسالة من الدليل: تنزل في إشعارات التطبيق للكل أو لمتابعين مدينة ——— */
  if (p === '/admin/notify' && M === 'POST') {
    const b = await request.json().catch(() => ({}));
    const text = str(b.text, 140), city = str(b.city, 40);
    if (text.length < 4) return J({ error: 'text_required' }, 400);
    const r = await env.DB.prepare(`INSERT INTO notifications (user_id,type,post_id,text,created) SELECT id,'system',?,?,? FROM users WHERE deleted=0 ${city ? 'AND id IN (SELECT user_id FROM user_cities WHERE city=?)' : ''}`)
      .bind(+b.postId || null, text, now(), ...(city ? [city] : [])).run();
    return J({ ok: true, sent: r.meta.changes });
  }
  /* ——— كل مشاركات المجتمع (للمراجعة) ——— */
  if (p === '/admin/community/posts' && M === 'GET') {
    const args = [];
    let sql = "SELECT p.id,p.kind,p.city,p.text,p.photo,p.answers,p.thanks,p.reports,p.status,p.hidden_by,p.created,u.name FROM posts p JOIN users u ON u.id=p.user_id WHERE 1=1";
    if (q.get('q')) { sql += ' AND p.text LIKE ?'; args.push(`%${q.get('q')}%`); }
    const { results } = await env.DB.prepare(sql + ' ORDER BY p.id DESC LIMIT 100').bind(...args).all();
    return J({ posts: results });
  }

  /* ——— تحدي الأسبوع ——— */
  if (p === '/admin/challenge') {
    if (M === 'POST') {
      const b = await request.json().catch(() => ({}));
      const c = b.clear ? null : { title: str(b.title, 80), prize: str(b.prize, 100), tag: str(b.tag, 30), photo: str(b.photo, 300), city: str(b.city, 40), start: new Date().toISOString(), end: b.end ? new Date(b.end).toISOString() : '' };
      await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('challenge',?)").bind(JSON.stringify(c)).run();
      return J({ ok: true, challenge: c });
    }
    const r = await env.DB.prepare("SELECT v FROM kv WHERE k='challenge'").first();
    return J({ challenge: r ? parse(r.v, null) : null });
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
