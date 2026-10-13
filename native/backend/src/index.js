/* دليل السعودية — سيرفر التطبيق (Cloudflare Worker + D1)
   - يقرأ المحتوى من قاعدة D1 (اللي تتعبّى من قودبابر بالمزامنة) ويرجعه للتطبيق بسرعة مع كاش
   - المزامنة: كل ساعة تلقائياً (Cron)، أو يدوياً من /admin/sync
   - ما فيه أي مفتاح سري في الكود: كل المفاتيح Secrets في Cloudflare
   مرجع المسارات: docs/api/API.md */

import { ensureSchema } from './schema.js';
import { runSync, importRaw } from './sync.js';
import { searchKey, km, CITIES } from './normalize.js';
import { authRoute, sessionUser } from './auth.js';
import { communityRoute, communityAdmin, myStats } from './community.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, Authorization',
};
const VERSION = '0.3.0';

export function J(data, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
    },
  });
}

const parse = (s, d = []) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

/** صف مكان مختصر للقوائم (بدون النص الكامل) */
function placeLite(r, from) {
  const o = {
    id: r.id, city: r.city, title: r.title, kinds: parse(r.kinds), cat: parse(r.cats)[0] || '',
    thumb: r.thumb || '', image: parse(r.images)[0] || '', summary: (r.summary || '').slice(0, 160),
    lat: r.lat, lng: r.lng,
  };
  if (from && r.lat && r.lng) o.km = Math.round(km(from.lat, from.lng, r.lat, r.lng) * 10) / 10;
  return o;
}
function placeFull(r) {
  return {
    ...placeLite(r), title_en: r.title_en || '', cats: parse(r.cats), body: r.body || '', images: parse(r.images),
    address: r.address || '', phone: r.phone || '', website: r.website || '', email: r.email || '',
    url: r.url || '', comments: !!r.comments, premium: !!r.premium, updated: r.updated,
  };
}
const eventRow = (r, full) => ({
  id: r.id, title: r.title, summary: r.summary || '', thumb: r.thumb || '', image: parse(r.images)[0] || '',
  start: r.start, end: r.end, all_day: !!r.all_day, cats: parse(r.cats), city: r.city, lat: r.lat, lng: r.lng,
  address: r.address || '', tickets: r.tickets || '', url: r.url || '',
  ...(full ? { body: r.body || '', images: parse(r.images), link: r.link || '' } : {}),
});
const articleRow = (r, full) => ({
  id: r.id, title: r.title, author: r.author || '', date: r.date, summary: r.summary || '', thumb: r.thumb || '',
  image: parse(r.images)[0] || '', section: r.section || '', cats: parse(r.cats), url: r.url || '',
  ...(full ? { body: r.body || '', images: parse(r.images) } : {}),
});

/* ——— مختارات الأسبوع: نفس منطق الصفحة الرئيسية في قودبابر ——— */
async function weeklyPicks(env) {
  const row = await env.DB.prepare("SELECT v FROM kv WHERE k='weekly_pool'").first();
  const pool = parse(row?.v, []); // [{id, s: 'w'|'s'|'a', x?: 1}]
  if (!pool.length) return [];
  const now = new Date(Date.now() + 3 * 3600e3);
  const days = Math.floor(now.getTime() / 86400e3);
  const sun = days - ((days + 4) % 7);
  const wk = Math.floor(sun / 7);
  const m = now.getUTCMonth() + 1;
  const ok = m >= 11 || m <= 3 ? 'wa' : m >= 5 && m <= 9 ? 'sa' : 'wsa';
  const ids = pool.filter((p) => ok.includes(p.s)).map((p) => p.id);
  if (!ids.length) return [];
  const { results } = await env.DB.prepare(`SELECT * FROM places WHERE deleted=0 AND id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  const list = pool.filter((p) => ok.includes(p.s) && byId[p.id]);
  let seed = ok.length * 7919;
  for (let i = list.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; const j = Math.floor((seed / 233280) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const stars = list.filter((p) => p.x), rest = list.filter((p) => !p.x);
  const pick = [], cs = new Set();
  if (stars.length) { const s = byId[stars[wk % stars.length].id]; pick.push(s); cs.add(s.city); }
  for (let k = 0, start = (wk * 4) % Math.max(rest.length, 1); k < rest.length && pick.length < 5; k++) {
    const r = byId[rest[(start + k) % rest.length].id];
    if (cs.has(r.city)) continue;
    cs.add(r.city); pick.push(r);
  }
  return pick.map((r) => placeLite(r));
}

async function cities(env) {
  const { results } = await env.DB.prepare(
    'SELECT c.*, (SELECT COUNT(*) FROM places p WHERE p.city=c.id AND p.deleted=0) AS count FROM cities c ORDER BY sort',
  ).all();
  return results;
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const q = url.searchParams;

  if (p === '/' || p === '/v1') return J({ name: 'saudi-guide-api', version: VERSION });

  /* ——— الإدارة (بمفتاح) ——— */
  if (p.startsWith('/admin/')) {
    if (!env.ADMIN_KEY || request.headers.get('X-Admin-Key') !== env.ADMIN_KEY) return J({ error: 'unauthorized' }, 401);
    if (p === '/admin/sync' && request.method === 'POST') return J(await runSync(env, 'manual'));
    if (p === '/admin/import' && request.method === 'POST') return J(await importRaw(env, await request.json()));
    if (p === '/admin/weekly' && request.method === 'POST') {
      const body = await request.json();
      await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('weekly_pool',?)").bind(JSON.stringify(body.pool || [])).run();
      return J({ ok: true, count: (body.pool || []).length });
    }
    if (p.startsWith('/admin/community/')) {
      const r = await communityAdmin(p, request, env, J);
      if (r) return r;
    }
    if (p === '/admin/status') {
      const last = await env.DB.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 10').all();
      const n = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM places WHERE deleted=0) p, (SELECT COUNT(*) FROM events WHERE deleted=0) e, (SELECT COUNT(*) FROM articles WHERE deleted=0) a, (SELECT COUNT(*) FROM devices) d').first();
      return J({ counts: n, sync: last.results });
    }
    return J({ error: 'not_found' }, 404);
  }

  /* ——— الحسابات ——— */
  if (p === '/v1/me/stats' && request.method === 'GET') {
    const u = await sessionUser(env, request);
    return u ? J(await myStats(env, u)) : J({ error: 'unauthorized' }, 401);
  }
  if (p.startsWith('/v1/auth/') || p.startsWith('/v1/me')) {
    const r = await authRoute(p, request, env, J);
    if (r) return r;
  }

  /* ——— المجتمع ——— */
  if (p === '/v1/community' || p.startsWith('/v1/community/')) {
    const r = await communityRoute(p, request, env, J, q);
    if (r) return r;
  }

  /* ——— صور المستخدمين من R2 ——— */
  if (p.startsWith('/media/') && request.method === 'GET' && env.MEDIA) {
    const obj = await env.MEDIA.get(decodeURIComponent(p.slice(7)));
    if (!obj) return J({ error: 'not_found' }, 404);
    return new Response(obj.body, { headers: { ...CORS, 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } });
  }

  if (request.method === 'POST' && p === '/v1/devices') {
    const b = await request.json().catch(() => ({}));
    if (!b.token || !/^ExponentPushToken\[.+\]$/.test(b.token)) return J({ error: 'bad_token' }, 400);
    const now = Math.floor(Date.now() / 1000);
    const cs = (Array.isArray(b.cities) ? b.cities : []).filter((c) => CITIES.some((x) => x[0] === c)).slice(0, 21);
    await env.DB.prepare(
      'INSERT INTO devices (token,platform,cities,created,seen) VALUES (?,?,?,?,?) ON CONFLICT(token) DO UPDATE SET platform=excluded.platform, cities=excluded.cities, seen=excluded.seen',
    ).bind(b.token, String(b.platform || '').slice(0, 10), JSON.stringify(cs), now, now).run();
    return J({ ok: true });
  }
  if (request.method !== 'GET') return J({ error: 'method_not_allowed' }, 405);

  /* ——— القراءة (عامة + كاش) ——— */
  if (p === '/v1/meta') {
    const r = await env.DB.prepare('SELECT MAX(updated) u FROM places').first();
    return J({ version: VERSION, content_updated: r?.u || 0 }, 200, 60);
  }

  if (p === '/v1/home') {
    const [cs, picks, ev, ar] = await Promise.all([
      cities(env),
      weeklyPicks(env),
      env.DB.prepare("SELECT * FROM events WHERE deleted=0 AND COALESCE(NULLIF(\"end\",''),start) >= ? ORDER BY (start < ?) , start LIMIT 10").bind(new Date().toISOString(), new Date().toISOString()).all(),
      env.DB.prepare('SELECT * FROM articles WHERE deleted=0 ORDER BY date DESC LIMIT 10').all(),
    ]);
    return J({ cities: cs, picks, events: ev.results.map((r) => eventRow(r)), articles: ar.results.map((r) => articleRow(r)) }, 200, 300);
  }

  if (p === '/v1/cities') return J({ cities: await cities(env) }, 200, 600);

  let m;
  if ((m = p.match(/^\/v1\/cities\/([a-z0-9-]+)\/places$/))) {
    const kind = q.get('kind'), page = Math.max(1, +q.get('page') || 1), per = Math.min(100, +q.get('per') || 40);
    const where = ['city=?', 'deleted=0'], args = [m[1]];
    if (kind) { where.push('kinds LIKE ?'); args.push(`%"${kind}"%`); }
    if (q.get('q')) { where.push('search LIKE ?'); args.push(`%${searchKey(q.get('q'))}%`); }
    const total = await env.DB.prepare(`SELECT COUNT(*) n FROM places WHERE ${where.join(' AND ')}`).bind(...args).first();
    // اللي عندهم صور أول، بعدين الأحدث
    const { results } = await env.DB.prepare(
      `SELECT * FROM places WHERE ${where.join(' AND ')} ORDER BY (thumb IS NULL OR thumb='') ASC, updated DESC, id DESC LIMIT ? OFFSET ?`,
    ).bind(...args, per, (page - 1) * per).all();
    return J({ total: total.n, page, places: results.map((r) => placeLite(r)) }, 200, 300);
  }

  if ((m = p.match(/^\/v1\/places\/(\d+)$/))) {
    const r = await env.DB.prepare('SELECT * FROM places WHERE id=? AND deleted=0').bind(+m[1]).first();
    if (!r) return J({ error: 'not_found' }, 404);
    return J({ place: placeFull(r) }, 200, 300);
  }

  if (p === '/v1/places') { // ?ids=1,2,3 — لـ«رحلتي» و«المفضلة»
    const ids = (q.get('ids') || '').split(',').map(Number).filter(Boolean).slice(0, 100);
    if (!ids.length) return J({ places: [] });
    const { results } = await env.DB.prepare(`SELECT * FROM places WHERE deleted=0 AND id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    return J({ places: results.map((r) => placeLite(r)) }, 200, 300);
  }

  if (p === '/v1/search') {
    const k = searchKey(q.get('q') || '');
    if (k.length < 2) return J({ places: [] });
    const { results } = await env.DB.prepare(
      "SELECT * FROM places WHERE deleted=0 AND search LIKE ? ORDER BY (thumb IS NULL OR thumb='') ASC, LENGTH(title) ASC LIMIT 40",
    ).bind(`%${k}%`).all();
    return J({ places: results.map((r) => placeLite(r)) }, 200, 300);
  }

  if (p === '/v1/nearby') {
    const lat = +q.get('lat'), lng = +q.get('lng'), r = Math.min(+q.get('km') || 25, 200);
    if (!lat || !lng) return J({ error: 'lat_lng_required' }, 400);
    const d = r / 111; // مربع تقريبي ثم نرتب بالمسافة الحقيقية
    const { results } = await env.DB.prepare(
      'SELECT * FROM places WHERE deleted=0 AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? LIMIT 400',
    ).bind(lat - d, lat + d, lng - d * 1.2, lng + d * 1.2).all();
    const from = { lat, lng };
    const list = results.map((x) => placeLite(x, from)).filter((x) => x.km != null && x.km <= r).sort((a, b) => a.km - b.km).slice(0, 60);
    return J({ places: list }, 200, 120);
  }

  if (p === '/v1/events') {
    const city = q.get('city');
    const args = [new Date().toISOString()];
    let sql = "SELECT * FROM events WHERE deleted=0 AND COALESCE(NULLIF(\"end\",''),start) >= ?";
    if (city) { sql += ' AND city=?'; args.push(city); }
    const { results } = await env.DB.prepare(sql + ' ORDER BY (start < ?), start LIMIT 100').bind(...args, new Date().toISOString()).all();
    return J({ events: results.map((r) => eventRow(r)) }, 200, 300);
  }
  if ((m = p.match(/^\/v1\/events\/(\d+)$/))) {
    const r = await env.DB.prepare('SELECT * FROM events WHERE id=? AND deleted=0').bind(+m[1]).first();
    return r ? J({ event: eventRow(r, true) }, 200, 300) : J({ error: 'not_found' }, 404);
  }

  if (p === '/v1/articles') {
    const page = Math.max(1, +q.get('page') || 1);
    const { results } = await env.DB.prepare('SELECT * FROM articles WHERE deleted=0 ORDER BY date DESC LIMIT 20 OFFSET ?').bind((page - 1) * 20).all();
    return J({ page, articles: results.map((r) => articleRow(r)) }, 200, 300);
  }
  if ((m = p.match(/^\/v1\/articles\/(\d+)$/))) {
    const r = await env.DB.prepare('SELECT * FROM articles WHERE id=? AND deleted=0').bind(+m[1]).first();
    return r ? J({ article: articleRow(r, true) }, 200, 300) : J({ error: 'not_found' }, 404);
  }

  return J({ error: 'not_found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    try {
      await ensureSchema(env);
      return await route(request, env, ctx);
    } catch (e) {
      console.log('error', e && e.stack);
      return J({ error: 'server_error' }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    await ensureSchema(env);
    ctx.waitUntil(runSync(env, 'cron').catch((e) => console.log('sync', e && e.message)));
  },
};
