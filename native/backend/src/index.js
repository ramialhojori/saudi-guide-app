/* دليل السعودية — سيرفر التطبيق (Cloudflare Worker + D1)
   - يقرأ المحتوى من قاعدة D1 (اللي تتعبّى من قودبابر بالمزامنة) ويرجعه للتطبيق بسرعة مع كاش
   - المزامنة: كل ساعة تلقائياً (Cron)، أو يدوياً من /admin/sync
   - ما فيه أي مفتاح سري في الكود: كل المفاتيح Secrets في Cloudflare
   مرجع المسارات: docs/api/API.md */

import { arTitle, enPart } from './titles.js';
import { localize, wantsEn, importTranslations, trStats, runTranslate } from './i18n.js';
import { withCovers } from './covers.js';
import { ensureSchema } from './schema.js';
import { runSync, importRaw } from './sync.js';
import { searchKey, km, CITIES } from './normalize.js';
import { authRoute, sessionUser } from './auth.js';
import { communityRoute, communityAdmin, myStats, myNotifications, passportRoute, goingRoute, guideRequest, guideAdmin } from './community.js';
import { adminRoute } from './admin.js';
import { merchantRoute, merchantAdmin, merchantWeekly } from './merchants.js';
import { reviewsRoute, reviewsAdmin } from './reviews.js';
import { messagesAdmin, runQueue } from './messages.js';
import { contribRoute, contribAdmin, weeklyImpact } from './contrib.js';
import { seasonsRoute, seasonsAdmin } from './seasons.js';
import { aiRoute, aiAdmin } from './ai.js';
import { searchRoute } from './search.js';
import { contactRoute, contactAdmin } from './contact.js';
import { businessRoute, businessAdmin, planExpiry } from './business.js';
import { weatherRoute } from './weather.js';
import { offersRoute, offersAdmin } from './offers.js';
import { commentsRoute, commentsAdmin } from './comments.js';
import { adminAuth, adminLoginRoute, adminSessionRoute } from './adminauth.js';
import { inviteRoute } from './invite.js';
import { tripsRoute, tripsAdmin } from './trips.js';
import { errorsRoute, insightsAdmin, weeklyReport } from './insights.js';
import { papersRoute, papersAdmin, runPapers, saveDevicePapers } from './papers.js';
import { legalRoute } from './legal.js';
import { webApiRoute } from './webapi.js';
import { iapRoute } from './iap.js';
import { pushPending } from './push.js';
import { runAlerts } from './alerts.js';
import { summaryRoute } from './summary.js';
import { mcpRoute } from './mcp.js';
import { trackRoute, dashboard } from './track.js';
import { PANEL_HTML } from './panel.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, Authorization',
};
const VERSION = '0.22.0';

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
    id: r.id, city: r.city, title: arTitle(r.title), kinds: parse(r.kinds), cat: parse(r.cats)[0] || '',
    thumb: r.thumb || '', image: parse(r.images)[0] || '', summary: (r.summary || '').slice(0, 160),
    lat: r.lat, lng: r.lng,
  };
  if (from && r.lat && r.lng) o.km = Math.round(km(from.lat, from.lng, r.lat, r.lng) * 10) / 10;
  return o;
}
function placeFull(r) {
  return {
    ...placeLite(r), title_en: r.title_en || enPart(r.title), cats: parse(r.cats), body: r.body || '', images: parse(r.images),
    address: r.address || '', phone: r.phone || '', website: r.website || '', email: r.email || '',
    url: r.url || '', comments: !!r.comments, premium: !!r.premium, updated: r.updated,
  };
}
const eventRow = (r, full) => ({
  id: r.id, title: arTitle(r.title), summary: r.summary || '', thumb: r.thumb || '', image: parse(r.images)[0] || '',
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
  return withCovers(results);
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const q = url.searchParams;

  if (p === '/' || p === '/v1') return J({ name: 'saudi-guide-api', version: VERSION });

  /* ——— ربط Claude باللوحة (MCP + OAuth) ——— */
  if (p === '/mcp' || p.startsWith('/oauth/') || p.startsWith('/.well-known/oauth')) {
    const r = await mcpRoute(p, request, env);
    if (r) return r;
  }

  /* ——— الشروط والخصوصية (داخل التطبيق + صفحة عامة لآبل) ——— */
  if (p === '/privacy' || p === '/terms' || p.startsWith('/v1/legal/')) { const r = legalRoute(p, J); if (r) return r; }

  /* ——— لوحة التحكم (الصفحة نفسها عامة، وكل بياناتها تحتاج مفتاح الإدارة) ——— */
  if (p === '/panel') {
    const u = new URL(request.url);
    if (u.hostname.startsWith('saudi-guide-api.') && !u.searchParams.has('key')) return Response.redirect((env.WEB_URL || 'https://saudi-guide-web.saudi-guide2030.workers.dev') + '/panel', 302);
    return new Response(PANEL_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin' } });
  }

  /* ——— الإدارة (بمفتاح) ——— */
  if (p.startsWith('/admin/')) {
    // مفتاح الإدارة (للأدوات الآلية) أو جلسة مشرف مسجّل بحسابه (adminauth.js)
    const who = await adminAuth(env, request);
    if (!who) return J({ error: 'unauthorized' }, 401);
    { const r = await adminSessionRoute(p, request, env, J, who); if (r) return r; }
    if (p === '/admin/sync' && request.method === 'POST') return J(await runSync(env, 'manual'));
    if (p === '/admin/import' && request.method === 'POST') return J(await importRaw(env, await request.json()));
    if (p === '/admin/translations' && request.method === 'POST') return J(await importTranslations(env, await request.json()));
    if (p === '/admin/translations') return J(await trStats(env));
    if (p === '/admin/weekly' && request.method === 'POST') {
      const body = await request.json();
      await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('weekly_pool',?)").bind(JSON.stringify(body.pool || [])).run();
      return J({ ok: true, count: (body.pool || []).length });
    }
    const ar = (await contactAdmin(request, env, p, q, J)) || (await businessAdmin(p, request, env, J, q)) || (await offersAdmin(p, request, env, J, q)) || (await commentsAdmin(p, request, env, J, q)) || (await papersAdmin(p, request, env, J)) || (await tripsAdmin(p, request, env, J)) || (await insightsAdmin(p, request, env, J)) || (await seasonsAdmin(p, request, env, J)) || (await aiAdmin(p, request, env, J)) || (await adminRoute(p, request, env, J, q)) || (await merchantAdmin(p, request, env, J, q)) || (await reviewsAdmin(p, request, env, J, q)) || (await messagesAdmin(p, request, env, J, q)) || (await guideAdmin(p, request, env, J)) || (await contribAdmin(p, request, env, J, q));
    if (ar) return ar;
    if (p.startsWith('/admin/community/')) {
      const r = await communityAdmin(p, request, env, J);
      if (r) return r;
    }
    if (p === '/admin/dashboard') return J(await dashboard(env));
    if (p === '/admin/status') {
      const last = await env.DB.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 10').all();
      const n = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM places WHERE deleted=0) p, (SELECT COUNT(*) FROM events WHERE deleted=0) e, (SELECT COUNT(*) FROM articles WHERE deleted=0) a, (SELECT COUNT(*) FROM devices) d').first();
      return J({ counts: n, sync: last.results });
    }
    return J({ error: 'not_found' }, 404);
  }

  if (p === '/v1/seasons') { const r = await seasonsRoute(p, request, env, J); if (r) return r; }
  if (p.endsWith('/summary') && request.method === 'GET') { const r = await summaryRoute(p, env, J, ctx); if (r) return r; }
  if (p.startsWith('/v1/iap/')) { const r = await iapRoute(p, request, env, J); if (r) return r; }
  if (p.startsWith('/v1/web/')) { const r = await webApiRoute(p, env, J); if (r) return r; }
  if (p.startsWith('/v1/contact')) { const r = await contactRoute(request, env, p, J); if (r) return r; }
  if (p.startsWith('/v1/business')) { const r = await businessRoute(p, request, env, J, q); if (r) return r; }
  if (p === '/v1/weather') return weatherRoute(p, env, J, q);
  if (p === '/v1/admin/login') { const r = await adminLoginRoute(p, request, env, J); if (r) return r; }
  if (p === '/v1/errors') { const r = await errorsRoute(p, request, env, J); if (r) return r; }
  if (p.startsWith('/v1/trips')) { const r = await tripsRoute(p, request, env, J, q); if (r) return r; }
  if (p.startsWith('/v1/invite')) { const r = await inviteRoute(p, request, env, J); if (r) return r; }
  if (p.startsWith('/v1/papers')) { const r = await papersRoute(p, request, env, J, q); if (r) return r; }
  if (p.startsWith('/v1/offers')) { const r = await offersRoute(p, request, env, J, q); if (r) return r; }
  if (/^\/v1\/articles\/\d+\/comments$/.test(p) || /^\/v1\/comments\/\d+\/report$/.test(p)) { const r = await commentsRoute(p, request, env, J); if (r) return r; }
  if (p.startsWith('/v1/ai/')) { const r = await aiRoute(p, request, env, J); if (r) return r; }

  /* ——— المساهمة: المميزات، الأسئلة السريعة، الاقتراحات، أبطال الشهر ——— */
  if (p === '/v1/features' || p === '/v1/suggestions' || p === '/v1/places/similar' || p === '/v1/community/heroes' || /^\/v1\/places\/\d+\/facts$/.test(p)) {
    const r = await contribRoute(p, request, env, J, q);
    if (r) return r;
  }

  /* ——— التجار والكوبونات + التقييمات ——— */
  if (p.startsWith('/v1/coupons') || p.startsWith('/v1/merchant') || p === '/v1/me/coupons') {
    const r = await merchantRoute(p, request, env, J, q);
    if (r) return r;
  }
  if (/^\/v1\/places\/\d+\/reviews$/.test(p) || /^\/v1\/(reviews|photos)\/\d+\/report$/.test(p)) {
    const r = await reviewsRoute(p, request, env, J, q);
    if (r) return r;
  }

  /* ——— الحسابات ——— */
  if (p === '/v1/me/visits' || p === '/v1/me/passport') {
    const u = await sessionUser(env, request);
    if (!u) return J({ error: 'unauthorized' }, 401);
    const r = await passportRoute(p, env, u, request, J);
    if (r) return r;
  }
  if (p === '/v1/me/notifications') {
    const u = await sessionUser(env, request);
    return u ? myNotifications(env, u, request, J) : J({ error: 'unauthorized' }, 401);
  }
  if (p === '/v1/me/guide') {
    const u = await sessionUser(env, request);
    return u ? guideRequest(env, u, request, J) : J({ error: 'unauthorized' }, 401);
  }
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

  const gm = p.match(/^\/v1\/events\/(\d+)\/going$/);
  if (gm) return goingRoute(+gm[1], env, await sessionUser(env, request), request, J);

  if (request.method === 'POST' && p === '/v1/track') return trackRoute(request, env, J);
  if (request.method === 'POST' && p === '/v1/devices') {
    const b = await request.json().catch(() => ({}));
    if (!b.token || !/^ExponentPushToken\[.+\]$/.test(b.token)) return J({ error: 'bad_token' }, 400);
    const now = Math.floor(Date.now() / 1000);
    const cs = (Array.isArray(b.cities) ? b.cities : []).filter((c) => CITIES.some((x) => x[0] === c)).slice(0, 21);
    const me = await sessionUser(env, request);
    const prefs = {};
    for (const k of ['community', 'offers', 'events', 'trip', 'places', 'papers']) if (b.prefs && typeof b.prefs[k] === 'boolean') prefs[k] = b.prefs[k];
    // الجهاز يرتبط بالحساب المسجّل فيه (ولو سجّل خروج: b.logout يفك الربط)
    await env.DB.prepare(
      'INSERT INTO devices (token,platform,cities,user_id,prefs,created,seen) VALUES (?,?,?,?,?,?,?) ON CONFLICT(token) DO UPDATE SET platform=excluded.platform, cities=excluded.cities, user_id=excluded.user_id, prefs=excluded.prefs, seen=excluded.seen',
    ).bind(b.token, String(b.platform || '').slice(0, 10), JSON.stringify(cs), me && !b.logout ? me.id : null, JSON.stringify(prefs), now, now).run();
    if (Array.isArray(b.papers)) await saveDevicePapers(env, b.token, b.papers); // الصحف اللي يتابعها (للإشعار المجمّع)
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

  /* تحميل المدينة للاستخدام بدون نت: كل أماكنها بالتفاصيل + فعالياتها الجاية (التطبيق يحفظها ويحمّل صورها) */
  if ((m = p.match(/^\/v1\/cities\/([a-z0-9-]+)\/offline$/))) {
    // ميزة دليل+ بس (users.plus_until يشمل اشتراك آبل ومنحة المشرف)
    const me = await sessionUser(env, request);
    if (!me) return J({ error: 'login_required' }, 401);
    if (!(me.plus_until && me.plus_until > Math.floor(Date.now() / 1000)) && !(me.plus_grant_until && me.plus_grant_until > Math.floor(Date.now() / 1000))) return J({ error: 'plus_required' }, 402);
    const now = new Date().toISOString();
    const [pl, ev] = await Promise.all([
      env.DB.prepare('SELECT * FROM places WHERE city=? AND deleted=0 ORDER BY (thumb IS NULL OR thumb=\'\') ASC, updated DESC LIMIT 600').bind(m[1]).all(),
      env.DB.prepare("SELECT * FROM events WHERE city=? AND deleted=0 AND COALESCE(NULLIF(\"end\",''),start) >= ? ORDER BY start LIMIT 100").bind(m[1], now).all(),
    ]);
    return J({ city: m[1], at: Math.floor(Date.now() / 1000), places: pl.results.map((r) => placeFull(r)), events: ev.results.map((r) => eventRow(r, true)) }, 200, 600);
  }

  if ((m = p.match(/^\/v1\/places\/(\d+)$/))) {
    const r = await env.DB.prepare('SELECT p.*, u.name added_name FROM places p LEFT JOIN users u ON u.id=p.added_by AND u.deleted=0 WHERE p.id=? AND p.deleted=0').bind(+m[1]).first();
    if (!r) return J({ error: 'not_found' }, 404);
    return J({ place: { ...placeFull(r), ...(r.added_name ? { addedBy: r.added_name } : {}) } }, 200, 300);
  }

  if (p === '/v1/places') { // ?ids=1,2,3 — لـ«رحلتي» و«المفضلة»
    const ids = (q.get('ids') || '').split(',').map(Number).filter(Boolean).slice(0, 100);
    if (!ids.length) return J({ places: [] });
    const { results } = await env.DB.prepare(`SELECT * FROM places WHERE deleted=0 AND id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    return J({ places: results.map((r) => placeLite(r)) }, 200, 300);
  }

  if (p === '/v1/search' || p === '/v1/search/popular') return searchRoute(request, env, p, q);

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
  /* ملف تقويم للفعالية: الآيفون يفتحه ويعرض «أضف للتقويم» مع تنبيه قبلها بساعتين */
  if ((m = p.match(/^\/v1\/events\/(\d+)\.ics$/))) {
    const r = await env.DB.prepare('SELECT * FROM events WHERE id=? AND deleted=0').bind(+m[1]).first();
    if (!r || !r.start) return J({ error: 'not_found' }, 404);
    const t = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const d8 = (iso) => new Date(new Date(iso).getTime() + 3 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
    const esc = (x) => String(x || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
    const plain = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
    const end = r.end && r.end > r.start ? r.end : new Date(new Date(r.start).getTime() + 2 * 3600e3).toISOString();
    const long = new Date(end) - new Date(r.start) > 2 * 86400e3; // فعالية طويلة: نحطها يوم البداية بس
    const link = (r.tickets && /^https?:/.test(r.tickets) ? r.tickets : '') || r.link || '';
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Saudi Guide//AR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:event-${r.id}@saudi-guide`, `DTSTAMP:${t(new Date().toISOString())}`,
      ...(r.all_day || long
        ? [`DTSTART;VALUE=DATE:${d8(r.start)}`, `DTEND;VALUE=DATE:${d8(new Date(new Date(long && new Date(end) - new Date(r.start) > 14 * 86400e3 ? r.start : end).getTime() + 86400e3).toISOString())}`]
        : [`DTSTART:${t(r.start)}`, `DTEND:${t(end)}`]),
      `SUMMARY:${esc(r.title)}`, `DESCRIPTION:${esc((r.summary || plain(r.body)) + (link ? '\n' + link : '') + '\n— دليل السعودية')}`,
      ...(r.address ? [`LOCATION:${esc(r.address)}`] : []), ...(r.lat && r.lng ? [`GEO:${r.lat};${r.lng}`] : []), ...(link ? [`URL:${link}`] : []),
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(r.title)}`, `TRIGGER:${r.all_day || long ? '-PT15H' : '-PT2H'}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'];
    return new Response(lines.join('\r\n'), { headers: { ...CORS, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="event-${r.id}.ics"`, 'Cache-Control': 'public, max-age=300' } });
  }
  if ((m = p.match(/^\/v1\/events\/(\d+)$/))) {
    const r = await env.DB.prepare('SELECT * FROM events WHERE id=? AND deleted=0').bind(+m[1]).first();
    return r ? J({ event: eventRow(r, true) }, 200, 300) : J({ error: 'not_found' }, 404);
  }

  if (p === '/v1/articles') {
    const page = Math.max(1, +q.get('page') || 1);
    // ?cat= تصنيف الخبر (نفس تصنيفات قودبابر: أخبار المشاريع، سياحة وفعاليات، مشاريع رؤية السعودية 2030)
    const cat = q.get('cat');
    const { results } = await env.DB.prepare(`SELECT * FROM articles WHERE deleted=0 ${cat ? 'AND cats LIKE ?' : ''} ORDER BY date DESC LIMIT 20 OFFSET ?`)
      .bind(...(cat ? [`%"${cat.replace(/["%_]/g, '')}"%`] : []), (page - 1) * 20).all();
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
      let res = await route(request, env, ctx);
      // النسخة الإنجليزية: نفس الرد بعد تبديل النصوص (?lang=en)
      const u = new URL(request.url);
      if (request.method === 'GET' && wantsEn(u.searchParams) && res.ok && (res.headers.get('Content-Type') || '').includes('json') && /^\/v1\/(home|cities|places|events|articles|search|nearby|seasons)/.test(u.pathname)) {
        const data = await localize(env, await res.json());
        res = new Response(JSON.stringify(data), { status: res.status, headers: res.headers });
      }
      // أي طلب كتابة ممكن يكون أضاف إشعار لمستخدم → نرسله للجوال بالخلفية
      if (request.method === 'POST' || request.method === 'PUT') ctx.waitUntil(pushPending(env).catch((e) => console.log('push', e && e.message)));
      return res;
    } catch (e) {
      console.log('error', e && e.stack);
      return J({ error: 'server_error' }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    await ensureSchema(env);
    // المزامنة من قودبابر متوقفة (قرار 0007) إلا لو SYNC_ENABLED=1؛ الكرون يشغّل الرسائل المجدولة وإشعارات الجوال
    if (env.SYNC_ENABLED === '1') ctx.waitUntil(runSync(env, 'cron').catch((e) => console.log('sync', e && e.message)));
    // إشعارات المحتوى أول، وبعدها إشعارات الجوال (عشان تطلع بنفس الدورة)
    ctx.waitUntil(runAlerts(env).catch((e) => console.log('alerts', e && e.message)).then(() => pushPending(env)).catch((e) => console.log('push', e && e.message)));
    ctx.waitUntil(runQueue(env).catch((e) => console.log('queue', e && e.message)));
    ctx.waitUntil(runTranslate(env).catch((e) => console.log('translate', e && e.message)));
    ctx.waitUntil(weeklyImpact(env).catch((e) => console.log('impact', e && e.message)));
    ctx.waitUntil(merchantWeekly(env).catch((e) => console.log('mweekly', e && e.message)));
    ctx.waitUntil(weeklyReport(env).catch((e) => console.log('report', e && e.message)));
    ctx.waitUntil(runPapers(env).catch((e) => console.log('papers', e && e.message)));
    ctx.waitUntil(planExpiry(env).catch((e) => console.log('plans', e && e.message)));
  },
};
