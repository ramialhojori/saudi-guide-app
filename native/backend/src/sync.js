/* المزامنة من قودبابر إلى D1
   قودبابر تبقى لوحة المحتوى: رامي يضيف ويعدّل وينشر هناك، والوركر ينسخ المنشور هنا كل ساعة.

   مصدران للبيانات بنفس الشكل (شكل واجهة قودبابر cms_list_*):
   1) runSync: يسحب من واجهة قودبابر الرسمية (API for Content applications) بالمفتاح GB_API_TOKEN.
      ⚠️ مسارات الواجهة في GB_PATHS تحتاج تأكيد من التوثيق بعد ما يتفعّل المفتاح (المرحلة 1، المهمة 1).
   2) importRaw: نرسل له JSON جاهز (مثلاً تصدير Claude من قودبابر) على /admin/import — يشتغل من اليوم. */

import { normPlace, normEvent, normArticle, CITIES } from './normalize.js';

const now = () => Math.floor(Date.now() / 1000);
const S = (v) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : v);

// TODO(المرحلة 1): تأكيد المسارات من https://classic.goodbarber.dev/publicapi/latest/documentation/
const GB_PATHS = {
  maps: '/content/maps',
  events: '/content/events',
  articles: '/content/articles',
};

async function gbListAll(env, type) {
  const base = (env.GB_API_BASE || '').replace(/\/$/, '');
  if (!base || !env.GB_API_TOKEN) throw new Error('gb_api_not_configured');
  const out = [];
  for (let page = 1; page <= 100; page++) {
    const u = `${base}${GB_PATHS[type]}?status=published&per_page=100&page=${page}`;
    const r = await fetch(u, { headers: { Authorization: `Bearer ${env.GB_API_TOKEN}`, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`gb_${type}_${r.status}`);
    const j = await r.json();
    out.push(...(j.items || []));
    if (!j.has_next_page) break;
  }
  return out;
}

/** يحفظ عناصر مطبّعة ويرجع: الجديد/المعدّل */
async function upsert(env, table, cols, rows, known) {
  const ts = now();
  const added = [], changed = [];
  const stmts = [];
  for (const r of rows) {
    const k = known.get(r.id);
    // اللوحة هي المرجع: أي شي انعدّل أو انخفى أو انحفظ مسودة من لوحتنا ما تلمسه مزامنة قودبابر
    if (k && (k.deleted !== 0 || k.sig === 'panel')) continue;
    const prev = k ? k.sig : undefined;
    const sig = JSON.stringify(cols.map((c) => r[c]));
    if (prev === undefined) added.push(r);
    else if (prev !== sig) changed.push(r);
    else continue;
    stmts.push(
      env.DB.prepare(
        `INSERT OR REPLACE INTO ${table} (${cols.map((c) => (c === 'end' ? '"end"' : c)).join(',')},sig,updated,deleted) VALUES (${cols.map(() => '?').join(',')},?,?,0)`,
      ).bind(...cols.map((c) => S(r[c])), sig, ts),
    );
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return { added, changed };
}

async function knownSigs(env, table) {
  const { results } = await env.DB.prepare(`SELECT id, sig, deleted FROM ${table}`).all();
  return new Map(results.map((r) => [r.id, { sig: r.sig || '', deleted: r.deleted }]));
}

async function markDeleted(env, table, seenIds, known) {
  // نخفي بس اللي جاء من قودبابر وانحذف هناك — مو اللي أضفناه أو عدّلناه من اللوحة
  const gone = [...known.entries()].filter(([id, k]) => !seenIds.has(id) && k.deleted === 0 && k.sig !== 'panel' && id < 900000000).map(([id]) => id);
  const stmts = gone.map((id) => env.DB.prepare(`UPDATE ${table} SET deleted=1, updated=? WHERE id=?`).bind(now(), id));
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return gone.length;
}

const PLACE_COLS = ['id', 'city', 'title', 'title_en', 'slug', 'cats', 'kinds', 'summary', 'body', 'images', 'thumb', 'lat', 'lng', 'address', 'phone', 'website', 'email', 'url', 'comments', 'premium', 'search'];
const EVENT_COLS = ['id', 'title', 'summary', 'body', 'images', 'thumb', 'start', 'end', 'all_day', 'cats', 'city', 'lat', 'lng', 'address', 'tickets', 'link', 'url'];
const ARTICLE_COLS = ['id', 'title', 'author', 'date', 'summary', 'body', 'images', 'thumb', 'cats', 'section', 'url'];

async function seedCities(env) {
  const stmts = CITIES.map((c, i) =>
    env.DB.prepare('INSERT INTO cities (id,name,gb_section,color,lat,lng,kind,sort) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, sort=excluded.sort')
      .bind(c[0], c[1], c[2], c[3], c[4], c[5], c[6], i));
  await env.DB.batch(stmts);
}

/** يطبّق تصدير كامل. full=true يعني القائمة شاملة، فاللي ما ظهر فيها ينحذف */
async function apply(env, raw, source, full) {
  await seedCities(env);
  const res = { source, added: 0, changed: 0, removed: 0, new_places: [], new_events: [] };
  const sets = [
    ['places', PLACE_COLS, (raw.maps || []).map(normPlace).filter(Boolean)],
    ['events', EVENT_COLS, (raw.events || []).map(normEvent)],
    ['articles', ARTICLE_COLS, (raw.articles || []).map(normArticle)],
  ];
  for (const [table, cols, rows] of sets) {
    if (!rows.length && !full) continue;
    const known = await knownSigs(env, table);
    const firstRun = known.size === 0;
    const { added, changed } = await upsert(env, table, cols, rows, known);
    res.added += added.length;
    res.changed += changed.length;
    if (full && rows.length) res.removed += await markDeleted(env, table, new Set(rows.map((r) => r.id)), known);
    // ما نرسل إشعارات في أول تعبئة (كل شي «جديد»)
    if (!firstRun && table === 'places') res.new_places = added.map((p) => ({ id: p.id, title: p.title, city: p.city }));
    if (!firstRun && table === 'events') res.new_events = added.map((e) => ({ id: e.id, title: e.title, city: e.city }));
  }
  // صورة غلاف المدينة: أول مكان فيه صورة لو ما فيه غلاف
  await env.DB.prepare("UPDATE cities SET cover=(SELECT json_extract(images,'$[0]') FROM places WHERE places.city=cities.id AND deleted=0 AND images!='[]' ORDER BY id LIMIT 1) WHERE cover IS NULL OR cover=''").run();
  await env.DB.prepare('INSERT INTO sync_log (ts,source,added,changed,removed,note) VALUES (?,?,?,?,?,?)')
    .bind(now(), source, res.added, res.changed, res.removed, JSON.stringify({ np: res.new_places.length, ne: res.new_events.length })).run();
  if (env.PUSH_ENABLED === '1') await notifyNew(env, res);
  return res;
}

export async function runSync(env, source = 'cron') {
  if (!env.GB_API_TOKEN) return { skipped: 'no_gb_token' };
  const [maps, events, articles] = await Promise.all([gbListAll(env, 'maps'), gbListAll(env, 'events'), gbListAll(env, 'articles')]);
  return apply(env, { maps, events, articles }, source, true);
}

/** استيراد يدوي: {maps, events, articles, full?} */
export async function importRaw(env, raw) {
  return apply(env, raw, 'import', !!raw.full);
}

/* ——— إشعارات المحتوى الجديد (Expo Push) ———
   مكان جديد → يوصل للي مختارين مدينته فقط. فعالية جديدة → نفس الشي، أو للكل لو ما لها مدينة.
   أكثر من 3 عناصر بنفس المزامنة = إشعار واحد مجمّع (ما نزعج الناس لو رامي نشر بالجملة). */
async function notifyNew(env, res) {
  const items = [
    ...res.new_places.map((p) => ({ ...p, type: 'place' })),
    ...res.new_events.map((e) => ({ ...e, type: 'event' })),
  ];
  if (!items.length) return;
  const { results: devs } = await env.DB.prepare('SELECT token, cities FROM devices').all();
  const cityName = Object.fromEntries(CITIES.map((c) => [c[0], c[1]]));
  const msgs = [];
  for (const d of devs) {
    const mine = JSON.parse(d.cities || '[]');
    const hit = items.filter((it) => !it.city ? it.type === 'event' : mine.includes(it.city));
    if (!hit.length) continue;
    const one = hit[0];
    msgs.push({
      to: d.token,
      sound: 'default',
      title: hit.length > 3 ? 'وجهات جديدة في دليل السعودية' : one.type === 'event' ? 'فعالية جديدة' : `جديد في ${cityName[one.city] || 'الدليل'}`,
      body: hit.length > 3 ? `${hit.length} أماكن وفعاليات جديدة تنتظرك` : one.title,
      data: hit.length > 3 ? { url: '/' } : { url: one.type === 'event' ? `/event/${one.id}` : `/place/${one.id}` },
    });
  }
  for (let i = 0; i < msgs.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}) },
      body: JSON.stringify(msgs.slice(i, i + 100)),
    }).catch(() => {});
  }
}
