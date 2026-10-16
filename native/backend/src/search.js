/**
 * البحث الذكي في الدليل (Search 2.0)
 *  - يفهم أكثر من كلمة: «مطعم بحري جدة» → كل الكلمات لازم تتطابق، واسم المدينة يصير فلتر
 *  - يرتب النتائج: تطابق العنوان أولاً، ثم اللي لها صور، ثم الأقرب لك (لو أرسلت موقعك) أو مدينتك
 *  - لو ما لقى شي: يوسّع البحث (أي كلمة، ثم بدون آخر حرف لتصحيح الأخطاء البسيطة) ويقول إنها «نتائج قريبة»
 *  - يرجّع كمان: فعاليات قادمة، كوبونات فعّالة، أسئلة المجتمع، والمدن المطابقة
 *  GET /v1/search?q=&city=&kind=&lat=&lng=&sort=near|best
 *  GET /v1/search/popular  → أكثر الكلمات بحثاً آخر 14 يوم (لشاشة البحث قبل ما يكتب)
 */
import { arTitle } from './titles.js';
import { searchKey, km, CITIES } from './normalize.js';
import { PUBLIC_SQL, publicCoupon } from './merchants.js';

const J = (d, s = 200, cache = 0) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', ...(cache ? { 'Cache-Control': `public, max-age=${cache}` } : {}) } });
const parse = (s, d = []) => { try { return JSON.parse(s || ''); } catch { return d; } };
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);

const CITY_KEYS = CITIES.map((c) => ({ id: c[0], name: c[1], key: searchKey(c[1]), lat: c[4], lng: c[5] }));
// أسماء شائعة ثانية للمدن
const CITY_ALIAS = { جده: 'jeddah', مكه: 'makkah-region', المدينه: 'medina', مدينه: 'medina', ابها: 'abha', عسير: 'asir-region', الشرقيه: 'eastern-region', الدمام: 'eastern-region', الخبر: 'eastern-region', تبوك: 'tabuk-region', القصيم: 'qassim-region', الباحه: 'albaha' };

// كلمة → نوع مكان (عشان «مطاعم» تلقى المطاعم حتى لو ما انكتب «مطعم» في العنوان)
const KIND_WORDS = { مطعم: 'food', مطاعم: 'food', اكل: 'food', عشاء: 'food', غداء: 'food', فطور: 'food', مقهي: 'cafe', مقاهي: 'cafe', كافيه: 'cafe', قهوه: 'cafe', كوفي: 'cafe', مسجد: 'islamic', مساجد: 'islamic', تراث: 'heritage', تراثي: 'heritage', متحف: 'heritage', طبيعه: 'nature', حديقه: 'nature', منتزه: 'nature', شلال: 'nature', وادي: 'nature', بحر: 'nature', شاطي: 'nature', ترفيه: 'fun', العاب: 'fun', تسوق: 'shopping', مول: 'shopping', سوق: 'shopping', معلم: 'sights', معالم: 'sights' };

function lite(r, from) {
  const o = { id: r.id, city: r.city, title: arTitle(r.title), kinds: parse(r.kinds), cat: parse(r.cats)[0] || '', thumb: r.thumb || '', image: parse(r.images)[0] || '', summary: (r.summary || '').slice(0, 160), lat: r.lat, lng: r.lng };
  if (from && r.lat && r.lng) o.km = Math.round(km(from.lat, from.lng, r.lat, r.lng) * 10) / 10;
  return o;
}

/** يفكك البحث: كلمات + مدينة + نوع */
export function parseQuery(raw) {
  const all = searchKey(raw).split(' ').filter(Boolean);
  let city = null, kind = null;
  const words = [];
  for (const w of all) {
    const c = CITY_ALIAS[w] || CITY_KEYS.find((x) => x.key === w || x.key.split(' ')[0] === w)?.id;
    if (c && !city && all.length > 1) { city = c; continue; }
    if (KIND_WORDS[w] && !kind) kind = KIND_WORDS[w];
    words.push(w);
  }
  return { words, city, kind, key: all.join(' ') };
}

function scorePlace(r, P, ctx) {
  const t = searchKey(r.title || ''), s = r.search || '', body = searchKey(r.summary || '', r.address || '');
  const tw = t.split(' '), hw = `${s} ${body}`.split(' ');
  // التطابق يبدأ من أول الكلمة (عشان «جدة» ما تجيب «السجدة»)
  const has = (arr, w) => arr.some((x) => x.startsWith(w));
  let sc = 0, hits = 0;
  for (const w of P.words) {
    const inTitle = has(tw, w), inHay = has(hw, w);
    const kindHit = KIND_WORDS[w] && parse(r.kinds).includes(KIND_WORDS[w]);
    if (inTitle) sc += 12; else if (inHay) sc += 5; else if (kindHit) sc += 6; else continue;
    hits++;
  }
  if (t === P.key) sc += 60; else if (t.startsWith(P.key)) sc += 35; else if (P.key.length > 2 && t.includes(P.key)) sc += 20;
  if (r.thumb) sc += 4;
  if (ctx.from && r.lat && r.lng) { const d = km(ctx.from.lat, ctx.from.lng, r.lat, r.lng); sc += d < 5 ? 8 : d < 25 ? 5 : d < 100 ? 2 : 0; }
  else if (ctx.home && r.city === ctx.home) sc += 4;
  return { sc, hits };
}

async function places(env, P, ctx, mode) {
  const ws = mode === 'fuzzy' ? P.words.filter((w) => w.length >= 4).map((w) => w.slice(0, -1)) : P.words;
  if (!ws.length) return [];
  const where = ['deleted=0'], args = [];
  // مرشحين: أي كلمة تطابق (نفلتر بدقة بعدين)
  where.push('(' + ws.map(() => '(search LIKE ? OR summary LIKE ?)').join(' OR ') + ')');
  ws.forEach((w) => args.push(`%${w}%`, `%${w}%`));
  if (P.kind && !ws.some((w) => !KIND_WORDS[w])) { where.length = 1; args.length = 0; where.push('kinds LIKE ?'); args.push(`%"${P.kind}"%`); }
  if (ctx.city) { where.push('city=?'); args.push(ctx.city); }
  if (ctx.kind) { where.push('kinds LIKE ?'); args.push(`%"${ctx.kind}"%`); }
  const { results } = await env.DB.prepare(`SELECT * FROM places WHERE ${where.join(' AND ')} LIMIT 500`).bind(...args).all();
  const need = mode === 'strict' ? P.words.length : 1;
  const Pm = mode === 'fuzzy' ? { ...P, words: ws } : P;
  const out = [];
  for (const r of results) {
    const { sc, hits } = scorePlace(r, Pm, ctx);
    if (hits >= need) out.push([sc, r]);
  }
  out.sort((a, b) => b[0] - a[0]);
  let list = out.slice(0, 60).map(([, r]) => lite(r, ctx.from));
  if (ctx.sort === 'near' && ctx.from) list = list.filter((x) => x.km != null).sort((a, b) => a.km - b.km);
  return list;
}

const match = (text, words) => { const k = searchKey(text).split(' '); return words.every((w) => k.some((x) => x.startsWith(w))); };

export async function searchRoute(request, env, p, q) {
  if (p === '/v1/search/popular') {
    const d14 = new Date(Date.now() - 14 * 86400e3).toISOString().slice(0, 10);
    const r = await env.DB.prepare("SELECT k, SUM(n) n FROM stats_daily WHERE metric='search' AND day>=? AND LENGTH(k)>=2 GROUP BY k ORDER BY n DESC LIMIT 12").bind(d14).all().catch(() => ({ results: [] }));
    return J({ popular: (r.results || []).map((x) => x.k) }, 200, 600);
  }
  if (p !== '/v1/search') return null;

  const raw = q.get('q') || '';
  const P = parseQuery(raw);
  const lat = +q.get('lat'), lng = +q.get('lng');
  const ctx = { city: q.get('city') || P.city || null, kind: q.get('kind') || null, from: lat && lng ? { lat, lng } : null, home: q.get('home') || null, sort: q.get('sort') || 'best' };
  const cities = P.key.length >= 2 ? CITY_KEYS.filter((c) => c.key.includes(P.key) || P.key.includes(c.key) || CITY_ALIAS[P.key] === c.id).map((c) => ({ id: c.id, name: c.name })).slice(0, 3) : [];

  // لو كتب اسم مدينة بس → نعرض المدينة وأفضل أماكنها
  if (!P.words.length && P.city) { P.words = []; }
  if (P.key.length < 2 && !ctx.kind) return J({ places: [], events: [], coupons: [], questions: [], cities: [], parsed: P });

  let relaxed = false;
  let list = P.words.length ? await places(env, P, ctx, 'strict') : [];
  if (!list.length && P.words.length > 1) { list = await places(env, P, ctx, 'any'); relaxed = !!list.length; }
  if (!list.length && P.words.length) { list = await places(env, P, ctx, 'fuzzy'); relaxed = !!list.length; }
  if (!list.length && cities.length === 1) {
    const { results } = await env.DB.prepare("SELECT * FROM places WHERE deleted=0 AND city=? ORDER BY (thumb IS NULL OR thumb='') ASC, updated DESC LIMIT 30").bind(cities[0].id).all();
    list = results.map((r) => lite(r, ctx.from));
  }

  const words = P.words.length ? P.words : [P.key];
  const [ev, cp, qs] = await Promise.all([
    env.DB.prepare("SELECT * FROM events WHERE deleted=0 AND COALESCE(NULLIF(\"end\",''),start) >= ? ORDER BY start LIMIT 300").bind(new Date().toISOString()).all().catch(() => ({ results: [] })),
    env.DB.prepare(PUBLIC_SQL + ' LIMIT 300').bind(today()).all().catch(() => ({ results: [] })),
    env.DB.prepare("SELECT p.id, p.text, p.city, p.answers, p.created FROM posts p WHERE p.status='visible' AND p.kind='question' ORDER BY p.id DESC LIMIT 600").all().catch(() => ({ results: [] })),
  ]);
  const events = ev.results.filter((r) => (!ctx.city || r.city === ctx.city) && match(`${r.title} ${r.summary || ''} ${r.address || ''} ${parse(r.cats).join(' ')}`, words)).slice(0, 10)
    .map((r) => ({ id: r.id, title: arTitle(r.title), summary: r.summary || '', thumb: r.thumb || '', image: parse(r.images)[0] || '', start: r.start, end: r.end, all_day: !!r.all_day, cats: parse(r.cats), city: r.city, address: r.address || '' }));
  const coupons = cp.results.filter((r) => (!ctx.city || r.m_city === ctx.city) && match(`${r.title} ${r.m_name} ${r.m_area || ''}`, words)).slice(0, 6).map((r) => publicCoupon(r, false));
  const questions = qs.results.filter((r) => (!ctx.city || r.city === ctx.city) && match(r.text, words)).slice(0, 6).map((r) => ({ id: r.id, text: r.text.slice(0, 160), city: r.city || '', answers: r.answers }));

  return J({ places: list, events, coupons, questions, cities, relaxed, parsed: { city: ctx.city, kind: P.kind } }, 200, 120);
}
