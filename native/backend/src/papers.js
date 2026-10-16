/* الصحف السعودية (مثل «نبض» و«نبأ»):
   - نسحب RSS من الصحف كل ~15 دقيقة (الكرون)، ونحفظ العنوان والصورة وسطرين بس + رابط الخبر في موقع الصحيفة
   - الخبر الكامل يفتح في موقع الصحيفة نفسها («اقرأ في المصدر») — ما ننسخ نص الخبر
   - المستخدم يتابع الصحف اللي يبيها → «أخباري»، وإشعار مجمّع كل كم ساعة («5 أخبار جديدة من عكاظ والرياض»)
   - المتابعة تنحفظ في الجهاز (devices.papers) وفي الحساب لو مسجّل (news_follows) عشان تنتقل بين أجهزته
   - اللوحة: إضافة صحيفة، إيقافها، تجربة الرابط، والسحب الحين
   - الصحيفة اللي رابطها ما يشتغل 6 مرات ورا بعض تتحول «error» تلقائياً وما تطلع في التطبيق */
import { sendPush } from './messages.js';
import { getFeatures } from './contrib.js';
import { sessionUser } from './auth.js';

const now = () => Math.floor(Date.now() / 1000);
const makkah = () => new Date(Date.now() + 3 * 3600e3);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 SaudiGuide/1.0';

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS news_sources ( id TEXT PRIMARY KEY, name TEXT NOT NULL, site TEXT, feed TEXT NOT NULL, lang TEXT NOT NULL DEFAULT 'ar', logo TEXT, status TEXT NOT NULL DEFAULT 'active', sort INTEGER NOT NULL DEFAULT 50, last_fetch INTEGER, last_ok INTEGER, last_error TEXT, fails INTEGER NOT NULL DEFAULT 0, items INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL )",
  'CREATE TABLE IF NOT EXISTS news_items ( id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, guid TEXT NOT NULL, title TEXT NOT NULL, link TEXT NOT NULL, image TEXT, snippet TEXT, published INTEGER NOT NULL, fetched INTEGER NOT NULL, opens INTEGER NOT NULL DEFAULT 0, UNIQUE(source, guid) )',
  'CREATE INDEX IF NOT EXISTS news_items_pub ON news_items(published DESC)',
  'CREATE INDEX IF NOT EXISTS news_items_src ON news_items(source, published DESC)',
  'CREATE INDEX IF NOT EXISTS news_items_fetched ON news_items(fetched)',
  'CREATE TABLE IF NOT EXISTS news_follows ( user_id TEXT NOT NULL, source TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, source) )',
];

/** الصحف الأولى (روابط RSS تأكدنا منها في فهرس Feedspot؛ اللي ما لقينا رابطها نجرب الشائع والكرون يتأكد بنفسه) */
const SEED = [
  ['spa', 'واس', 'spa.gov.sa', 'https://www.spa.gov.sa/rss', 'ar', 1],
  ['okaz', 'عكاظ', 'okaz.com.sa', 'https://www.okaz.com.sa/rssFeed/0', 'ar', 2],
  ['riyadh', 'الرياض', 'alriyadh.com', 'https://www.alriyadh.com/section.main.xml', 'ar', 3],
  ['sabq', 'سبق', 'sabq.org', 'https://sabq.org/api/rss/articles', 'ar', 4],
  ['madina', 'المدينة', 'al-madina.com', 'https://www.al-madina.com/rssFeed/1', 'ar', 5],
  ['watan', 'الوطن', 'alwatan.com.sa', 'https://www.alwatan.com.sa/rssFeed/0', 'ar', 6],
  ['makkah', 'مكة', 'makkahnewspaper.com', 'https://makkahnewspaper.com/rssFeed/0', 'ar', 7],
  ['alyaum', 'اليوم', 'alyaum.com', 'https://www.alyaum.com/rssFeed/0', 'ar', 8],
  ['jazirah', 'الجزيرة', 'al-jazirah.com', 'https://www.al-jazirah.com/rss/ln.xml', 'ar', 9],
  ['bilad', 'البلاد', 'albiladdaily.com', 'https://albiladdaily.com/feed/', 'ar', 10],
  ['aawsat', 'الشرق الأوسط', 'aawsat.com', 'https://aawsat.com/feed', 'ar', 11],
  ['arabnews', 'Arab News', 'arabnews.com', 'https://www.arabnews.com/rss.xml', 'en', 20],
  ['gazette', 'Saudi Gazette', 'saudigazette.com.sa', 'https://saudigazette.com.sa/rssFeed/74', 'en', 21],
];
const logoOf = (site) => (site ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=128` : null);

let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
  await env.DB.prepare('ALTER TABLE devices ADD COLUMN papers TEXT').run().catch(() => {});
  const t = now();
  // تصحيح روابط الدفعة الأولى (16 أكتوبر 2026، تأكدنا منها من موقع كل صحيفة): القسم القديم → آخر الأخبار
  const FIX = [['okaz', 'https://www.okaz.com.sa/rssFeed/190', 'https://www.okaz.com.sa/rssFeed/0'], ['riyadh', 'https://www.alriyadh.com/rss', 'https://www.alriyadh.com/section.main.xml'],
    ['sabq', 'https://sabq.org/rss', 'https://sabq.org/api/rss/articles'], ['madina', 'https://www.al-madina.com/rssFeed/193', 'https://www.al-madina.com/rssFeed/1'],
    ['watan', 'https://www.alwatan.com.sa/rssFeed/45', 'https://www.alwatan.com.sa/rssFeed/0'], ['alyaum', 'https://www.alyaum.com/rssFeed/1', 'https://www.alyaum.com/rssFeed/0'],
    ['makkah', 'https://makkahnewspaper.com/rssFeed/0', 'https://makkahnewspaper.com/rssFeed/0']];
  await env.DB.batch([
    ...FIX.map(([id, from, to]) => env.DB.prepare("UPDATE news_sources SET feed=?, fails=0, last_fetch=NULL, status=CASE WHEN status='error' THEN 'active' ELSE status END WHERE id=? AND feed=?").bind(to, id, from)),
    // واس ما عندها RSS عام (موقعها تطبيق ويب) → نوقفها لين نلقى مصدر
    env.DB.prepare("UPDATE news_sources SET status='paused', last_error='واس ما تنشر RSS' WHERE id='spa' AND status<>'paused' AND items=0"),
  ]);
  await env.DB.batch(SEED.map(([id, name, site, feed, lang, sort]) => env.DB.prepare('INSERT OR IGNORE INTO news_sources (id,name,site,feed,lang,logo,sort,created) VALUES (?,?,?,?,?,?,?,?)').bind(id, name, site, feed, lang, logoOf(site), sort, t)));
  ready = true;
}

/* ═════════ قراءة RSS / Atom (بدون مكتبات: الوركر ما فيه DOMParser) ═════════ */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export function decode(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1); try { return String.fromCodePoint(n); } catch { return ''; } }
    return ENT[e.toLowerCase()] ?? m;
  });
}
const cdata = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? cdata(m[1]).trim() : ''; };
const attr = (xml, name, a) => { const m = xml.match(new RegExp(`<${name}\\s[^>]*?${a}=["']([^"']+)["']`, 'i')); return m ? decode(m[1]) : ''; };
const strip = (html) => decode((/&lt;/.test(String(html)) ? decode(html) : String(html)).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const absUrl = (u, base) => { try { return new URL(u, base).href; } catch { return ''; } };
const okUrl = (u) => /^https?:\/\//i.test(u || '');

/** يرجع الأخبار من نص الـ RSS/Atom */
export function parseFeed(xml, base) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks.slice(0, 60)) {
    const title = strip(cdata(tag(b, 'title')));
    let link = decode(tag(b, 'link'));
    if (!okUrl(link)) link = attr(b, 'link', 'href');
    link = absUrl(link, base);
    if (!title || !okUrl(link)) continue;
    const desc = cdata(tag(b, 'description') || tag(b, 'summary') || '');
    const content = cdata(tag(b, 'content:encoded') || tag(b, 'content') || '');
    let image = attr(b, 'media:content', 'url') || attr(b, 'media:thumbnail', 'url');
    if (!image) { const enc = b.match(/<enclosure\s[^>]*>/i)?.[0] || ''; if (/type=["']image/i.test(enc) || /\.(jpe?g|png|webp)/i.test(enc)) image = attr(enc, 'enclosure', 'url'); }
    if (!image) { const m = decode(desc + ' ' + content).match(/<img\s[^>]*?src=["']([^"']+)["']/i); if (m) image = m[1]; }
    image = image ? absUrl(decode(image), link) : '';
    const dateS = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const d = Date.parse(dateS);
    const snippet = strip(desc || content).slice(0, 240);
    out.push({
      guid: (strip(tag(b, 'guid')) || tag(b, 'id') || link).slice(0, 300), title: title.slice(0, 220), link: link.slice(0, 600),
      image: okUrl(image) ? image.replace(/^http:/, 'https:').slice(0, 600) : null,
      snippet: snippet && snippet !== title ? snippet : '',
      published: Number.isFinite(d) ? Math.min(now(), Math.floor(d / 1000)) : now(),
    });
  }
  return out;
}

async function getFeed(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ar,en;q=0.8', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' }, signal: ctl.signal, redirect: 'follow', cf: { cacheTtl: 300 } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = (await r.text()).slice(0, 1_500_000);
    if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(xml)) throw new Error('ليس RSS');
    return { xml, base: r.url || url };
  } finally { clearTimeout(timer); }
}

/** يسحب صحيفة وحدة ويحفظ الجديد. يرجع {added, found} */
export async function fetchSource(env, s) {
  const t = now();
  try {
    const { xml, base } = await getFeed(s.feed);
    const items = parseFeed(xml, base).filter((x) => x.published > t - 4 * 86400);
    if (!items.length) throw new Error('ما فيه أخبار في الرابط');
    let added = 0;
    for (let i = 0; i < items.length; i += 25) {
      const res = await env.DB.batch(items.slice(i, i + 25).map((x) => env.DB.prepare('INSERT OR IGNORE INTO news_items (source,guid,title,link,image,snippet,published,fetched) VALUES (?,?,?,?,?,?,?,?)')
        .bind(s.id, x.guid, x.title, x.link, x.image, x.snippet, x.published, t)));
      added += res.reduce((n, r) => n + (r.meta?.changes || 0), 0);
    }
    const c = await env.DB.prepare('SELECT COUNT(*) n FROM news_items WHERE source=?').bind(s.id).first();
    await env.DB.prepare("UPDATE news_sources SET last_fetch=?, last_ok=?, last_error=NULL, fails=0, items=?, status=CASE WHEN status='error' THEN 'active' ELSE status END WHERE id=?").bind(t, t, c?.n || 0, s.id).run();
    return { added, found: items.length, sample: items[0] };
  } catch (e) {
    const msg = String((e && e.name === 'AbortError') ? 'انتهت المهلة' : (e && e.message) || e).slice(0, 200);
    await env.DB.prepare("UPDATE news_sources SET last_fetch=?, last_error=?, fails=fails+1, status=CASE WHEN fails+1>=6 AND status='active' THEN 'error' ELSE status END WHERE id=?").bind(t, msg, s.id).run();
    return { added: 0, found: 0, error: msg };
  }
}

/** الكرون: الصحف اللي صار لها 15 دقيقة (والمعطّلة نجربها كل 6 ساعات)، والإشعار المجمّع، وتنظيف القديم */
export async function runPapers(env) {
  await ensure(env);
  if ((await getFeatures(env)).papers === false) return;
  const t = now();
  const { results } = await env.DB.prepare(`SELECT * FROM news_sources WHERE (status='active' AND COALESCE(last_fetch,0)<?) OR (status='error' AND COALESCE(last_fetch,0)<?) ORDER BY COALESCE(last_fetch,0) LIMIT 8`)
    .bind(t - 14 * 60, t - 6 * 3600).all();
  await Promise.all(results.map((s) => fetchSource(env, s)));
  await papersDigest(env);
  if (makkah().getUTCHours() === 4 && makkah().getUTCMinutes() < 15) {
    await env.DB.prepare('DELETE FROM news_items WHERE published<?').bind(t - 10 * 86400).run(); // أخبار الصحف بس (روابط) — مو محتوى الدليل
  }
}

/* ═════════ الإشعار المجمّع: 9 ص، 1 ظ، 5 ع، 9 م بتوقيت مكة ═════════ */
const DIGEST_HOURS = [9, 13, 17, 21];
const joinAr = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join('، ')} و${a[a.length - 1]}`);
const newsCount = (n) => (n === 1 ? 'خبر جديد' : n === 2 ? 'خبرين جديدة' : n <= 10 ? `${n} أخبار جديدة` : `${n} خبر جديد`);

async function papersDigest(env, force = false) {
  const mk = makkah();
  const slot = `${mk.toISOString().slice(0, 10)}-${mk.getUTCHours()}`;
  if (!force && !DIGEST_HOURS.includes(mk.getUTCHours())) return null;
  const last = await env.DB.prepare("SELECT v FROM kv WHERE k='papers_digest'").first();
  let st = {}; try { st = JSON.parse(last?.v || '{}'); } catch { /* */ }
  if (!force && st.slot === slot) return null;
  const since = st.at || now() - 4 * 3600;
  await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('papers_digest',?)").bind(JSON.stringify({ slot, at: now() })).run();
  if (env.PUSH_ENABLED !== '1' && !force) return null;

  const { results: fresh } = await env.DB.prepare(`SELECT i.source, s.name, COUNT(*) n, MAX(i.published) p,
      (SELECT title FROM news_items x WHERE x.source=i.source AND x.fetched>? ORDER BY x.published DESC LIMIT 1) top
    FROM news_items i JOIN news_sources s ON s.id=i.source WHERE i.fetched>? AND s.status='active' GROUP BY i.source`).bind(since, since).all();
  if (!fresh.length) return { sent: 0 };
  const by = Object.fromEntries(fresh.map((r) => [r.source, r]));

  const { results: devs } = await env.DB.prepare(`SELECT d.token, d.prefs, d.papers, d.user_id,
      (SELECT group_concat(source) FROM news_follows f WHERE f.user_id=d.user_id) uf
    FROM devices d WHERE (d.papers IS NOT NULL AND d.papers<>'[]') OR d.user_id IN (SELECT user_id FROM news_follows)`).all();
  const groups = new Map(); // نفس النص → توكنات (عشان نرسلها دفعات)
  for (const d of devs) {
    try { if (JSON.parse(d.prefs || '{}').papers === false) continue; } catch { /* */ }
    let mine = []; try { mine = JSON.parse(d.papers || '[]'); } catch { /* */ }
    const f = [...new Set([...mine, ...String(d.uf || '').split(',').filter(Boolean)])].map((s) => by[s]).filter(Boolean).sort((a, b) => b.n - a.n);
    if (!f.length) continue;
    const total = f.reduce((n, x) => n + x.n, 0);
    const names = f.slice(0, 3).map((x) => x.name);
    const text = `${newsCount(total)} من ${joinAr(names)}${f.length > 3 ? ' وغيرها' : ''}${f[0].top ? `: ${f[0].top.slice(0, 90)}` : ''}`;
    if (!groups.has(text)) groups.set(text, []);
    groups.get(text).push(d.token);
  }
  let sent = 0;
  for (const [text, tokens] of groups) { const r = await sendPush(env, tokens, { title: 'أخبارك', text, link: '/news?tab=mine' }); sent += r.ok; }
  return { sent, groups: groups.size };
}

/* ═════════ المسارات العامة ═════════ */
const cleanIds = (a) => [...new Set((Array.isArray(a) ? a : String(a || '').split(',')).map((x) => String(x).trim().toLowerCase()).filter((x) => /^[a-z0-9_-]{2,30}$/.test(x)))].slice(0, 40);
const itemOut = (r) => ({ id: r.id, source: r.source, sourceName: r.name, logo: r.logo, title: r.title, link: r.link, image: r.image, snippet: r.snippet, at: r.published });

export async function papersRoute(p, request, env, J, q) {
  if (!p.startsWith('/v1/papers')) return null;
  await ensure(env);
  if (p === '/v1/papers' && request.method === 'GET') {
    const { results } = await env.DB.prepare("SELECT id, name, site, logo, lang, items, last_ok FROM news_sources WHERE status='active' AND items>0 ORDER BY sort, name").all();
    return J({ sources: results }, 200, 300);
  }
  if (p === '/v1/papers/feed' && request.method === 'GET') {
    const ids = cleanIds(q.get('s'));
    const before = +q.get('before') || 0;
    const limit = Math.min(40, Math.max(5, +q.get('limit') || 25));
    const lang = q.get('l') === 'en' ? 'en' : q.get('l') === 'ar' ? 'ar' : ''; // (مو lang: التطبيق يضيف lang=en للنسخة الإنجليزية)
    const where = ["s.status='active'"]; const args = [];
    if (ids.length) { where.push(`i.source IN (${ids.map(() => '?').join(',')})`); args.push(...ids); }
    else if (lang) { where.push('s.lang=?'); args.push(lang); }
    if (before) { where.push('i.published<?'); args.push(before); }
    const { results } = await env.DB.prepare(`SELECT i.*, s.name, s.logo FROM news_items i JOIN news_sources s ON s.id=i.source WHERE ${where.join(' AND ')} ORDER BY i.published DESC LIMIT ?`).bind(...args, limit).all();
    return J({ items: results.map(itemOut), more: results.length === limit }, 200, 120);
  }
  let m;
  if ((m = p.match(/^\/v1\/papers\/items\/(\d+)\/open$/)) && request.method === 'POST') {
    await env.DB.prepare('UPDATE news_items SET opens=opens+1 WHERE id=?').bind(+m[1]).run();
    return J({ ok: true });
  }
  if (p === '/v1/papers/follows') {
    const me = await sessionUser(env, request);
    if (!me) return J({ error: 'login_required' }, 401);
    if (request.method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const ids = cleanIds(b.sources);
      const t = now();
      await env.DB.batch([
        env.DB.prepare('DELETE FROM news_follows WHERE user_id=?').bind(me.id),
        ...ids.map((s) => env.DB.prepare('INSERT OR IGNORE INTO news_follows (user_id,source,created) VALUES (?,?,?)').bind(me.id, s, t)),
      ]);
      return J({ ok: true, sources: ids });
    }
    const { results } = await env.DB.prepare('SELECT source FROM news_follows WHERE user_id=? ORDER BY created').bind(me.id).all();
    return J({ sources: results.map((r) => r.source) });
  }
  return null;
}

/** حفظ متابعات الجهاز (من /v1/devices) */
export async function saveDevicePapers(env, token, papers) {
  if (!Array.isArray(papers)) return;
  await ensure(env);
  await env.DB.prepare('UPDATE devices SET papers=? WHERE token=?').bind(JSON.stringify(cleanIds(papers)), token).run();
}

/* ═════════ اللوحة ═════════ */
export async function papersAdmin(p, request, env, J) {
  if (!p.startsWith('/admin/papers')) return null;
  await ensure(env);
  let m;
  if (p === '/admin/papers' && request.method === 'GET') {
    const { results } = await env.DB.prepare(`SELECT s.*, (SELECT COUNT(*) FROM news_follows f WHERE f.source=s.id) followers,
        (SELECT COUNT(*) FROM devices d WHERE d.papers LIKE '%"' || s.id || '"%') devices,
        (SELECT COALESCE(SUM(opens),0) FROM news_items i WHERE i.source=s.id) opens,
        (SELECT MAX(published) FROM news_items i WHERE i.source=s.id) latest
      FROM news_sources s WHERE s.status<>'hidden' ORDER BY s.sort, s.name`).all();
    return J({ sources: results });
  }
  if (p === '/admin/papers' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const feed = String(b.feed || '').trim();
    if (!okUrl(feed)) return J({ error: 'رابط RSS مطلوب (يبدأ بـ https://)' }, 400);
    const site = String(b.site || '').trim() || (() => { try { return new URL(feed).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    const id = cleanIds([b.id || site.split('.')[0]])[0];
    const name = String(b.name || '').trim().slice(0, 40);
    if (!id || !name) return J({ error: 'الاسم والمعرّف مطلوبين' }, 400);
    await env.DB.prepare(`INSERT INTO news_sources (id,name,site,feed,lang,logo,sort,status,created) VALUES (?,?,?,?,?,?,?,'active',?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, site=excluded.site, feed=excluded.feed, lang=excluded.lang, logo=excluded.logo, status='active', fails=0`)
      .bind(id, name, site, feed, b.lang === 'en' ? 'en' : 'ar', b.logo || logoOf(site), +b.sort || 50, now()).run();
    const s = await env.DB.prepare('SELECT * FROM news_sources WHERE id=?').bind(id).first();
    return J({ ok: true, source: s, test: await fetchSource(env, s) });
  }
  if (p === '/admin/papers/fetch' && request.method === 'POST') {
    const { results } = await env.DB.prepare("SELECT * FROM news_sources WHERE status IN ('active','error')").all();
    const r = await Promise.all(results.map(async (s) => [s.id, await fetchSource(env, s)]));
    return J({ results: Object.fromEntries(r.map(([id, x]) => [id, { added: x.added, found: x.found, error: x.error }])) });
  }
  if (p === '/admin/papers/digest' && request.method === 'POST') return J(await papersDigest(env, true) || {});
  if ((m = p.match(/^\/admin\/papers\/([a-z0-9_-]+)\/test$/)) && request.method === 'POST') {
    const s = await env.DB.prepare('SELECT * FROM news_sources WHERE id=?').bind(m[1]).first();
    if (!s) return J({ error: 'not_found' }, 404);
    return J(await fetchSource(env, s));
  }
  if ((m = p.match(/^\/admin\/papers\/([a-z0-9_-]+)$/)) && request.method === 'POST') {
    const s = await env.DB.prepare('SELECT * FROM news_sources WHERE id=?').bind(m[1]).first();
    if (!s) return J({ error: 'not_found' }, 404);
    const b = await request.json().catch(() => ({}));
    const status = ['active', 'paused', 'hidden'].includes(b.status) ? b.status : s.status;
    const feed = okUrl(b.feed) ? String(b.feed).trim() : s.feed;
    await env.DB.prepare('UPDATE news_sources SET status=?, name=?, feed=?, sort=?, lang=?, fails=CASE WHEN ?<>feed THEN 0 ELSE fails END WHERE id=?')
      .bind(status, String(b.name || s.name).slice(0, 40), feed, b.sort != null ? +b.sort : s.sort, b.lang === 'en' || b.lang === 'ar' ? b.lang : s.lang, feed, s.id).run();
    return J({ ok: true, source: await env.DB.prepare('SELECT * FROM news_sources WHERE id=?').bind(s.id).first() });
  }
  return null;
}
