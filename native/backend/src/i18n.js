/* النسخة الإنجليزية من المحتوى
   - الترجمات محفوظة في جدول tr (نوع + رقم + لغة): العنوان t، الملخص s، النص b، العنوان البريدي a
   - أي طلب قراءة فيه ?lang=en يرجع نفس الشكل لكن بالإنجليزي (اللي ما له ترجمة يبقى عربي)
   - المحتوى الموجود ترجمه Claude مرة وحدة واستوردناه من الملفات (POST /admin/translations)
   - الجديد: لما يصير مكان/فعالية/خبر منشور، السيرفر يترجمه تلقائياً (الميزة «translate» في اللوحة) */
import { getFeatures } from './contrib.js';

export const CITY_EN = {
  riyadh: 'Riyadh', medina: 'Madinah', 'makkah-region': 'Makkah', alula: 'AlUla', 'asir-region': 'Asir', taif: 'Taif', jeddah: 'Jeddah',
  jizan: 'Jazan', abha: 'Abha', diriyah: 'Diriyah', yanbu: 'Yanbu', albaha: 'Al-Baha', 'riyadh-region': 'Riyadh Region', 'tabuk-region': 'Tabuk',
  'qassim-region': 'Al-Qassim', 'eastern-region': 'Eastern Province', umluj: 'Umluj & the Red Sea', hail: 'Hail', 'aljawf-region': 'Al-Jouf',
  najran: 'Najran', 'northern-border': 'Northern Borders',
};
export const KIND_EN = { sights: 'Sights', heritage: 'Heritage & Culture', islamic: 'Islamic Landmarks', nature: 'Nature & Valleys', fun: 'Entertainment', food: 'Restaurants', cafe: 'Cafés', shopping: 'Shopping' };
const CAT_EN = {
  'أماكن سياحية': 'Sights', 'التراث والثقافة': 'Heritage & Culture', 'مطاعم': 'Restaurants', 'سياحة وترفيه': 'Tourism & Entertainment',
  'مطاعم وكافيهات': 'Restaurants & Cafés', 'مقاهي': 'Cafés', 'ترفيه واستجمام': 'Leisure & Relaxation', 'أسواق': 'Markets', 'معالم إسلامية': 'Islamic Landmarks',
  'الشلالات والأودية': 'Waterfalls & Valleys', 'مقاهي ومخبوزات': 'Cafés & Bakeries', 'إفطار': 'Breakfast', 'المولات': 'Malls', 'مخبوزات': 'Bakeries',
  'المطاعم والمقاهي': 'Restaurants & Cafés', 'مزارع': 'Farms', 'التاريخ والثقافة': 'History & Culture', 'أماكن للزيارة': 'Places to Visit', 'كافيهات': 'Cafés',
  'أسواق شعبية': 'Traditional Markets', 'آبار ومزارع': 'Wells & Farms', 'موسم الرياض': 'Riyadh Season', 'التسوق': 'Shopping', 'تراث وثقافة': 'Heritage & Culture',
  'طبيعة وأودية': 'Nature & Valleys', 'ترفيه': 'Entertainment', 'تسوق': 'Shopping', 'معارض ومؤتمرات': 'Exhibitions & Conferences', 'غنائية ومسرحية': 'Concerts & Theatre',
  'المهرجانات': 'Festivals', 'رياضية': 'Sports', 'لحظات العلا': 'AlUla Moments', 'موسم جدة': 'Jeddah Season', 'تجارب ومغامرات': 'Experiences & Adventures',
  'موسم الدرعية': 'Diriyah Season', 'تراثي ثقافي': 'Heritage & Culture',
};
export const catEn = (c) => CAT_EN[c] || c;

const now = () => Math.floor(Date.now() / 1000);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** النص الإنجليزي محفوظ فقرات عادية؛ التطبيق يعرض HTML */
const toHtml = (b) => String(b || '').split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).map((x) => `<p>${esc(x).replace(/\n/g, '<br/>')}</p>`).join('');

export const wantsEn = (q) => q.get('lang') === 'en';

/** يجيب ترجمات مجموعة عناصر من نوع واحد */
async function load(env, kind, ids) {
  const uniq = [...new Set(ids.filter(Boolean).map(Number))];
  const out = new Map();
  for (let i = 0; i < uniq.length; i += 90) {
    const part = uniq.slice(i, i + 90);
    const { results } = await env.DB.prepare(`SELECT id,t,s,b,a FROM tr WHERE kind=? AND lang='en' AND id IN (${part.map(() => '?').join(',')})`).bind(kind, ...part).all();
    for (const r of results) out.set(r.id, r);
  }
  return out;
}

function applyItem(o, tr) {
  if (!o || typeof o !== 'object') return o;
  const x = tr?.get(Number(o.id));
  if (x) {
    if (x.t) o.title = x.t;
    if (x.s) o.summary = 'body' in o ? x.s : x.s.slice(0, 160);
    if (x.b && 'body' in o) o.body = toHtml(x.b);
    if (x.a && 'address' in o) o.address = x.a;
    o.lang = 'en';
  }
  if (typeof o.cat === 'string') o.cat = catEn(o.cat);
  if (Array.isArray(o.cats)) o.cats = o.cats.map(catEn);
  if (typeof o.city === 'string' && CITY_EN[o.city] && 'cityName' in o) o.cityName = CITY_EN[o.city];
  return o;
}

/** يمشي على رد الـJSON ويبدل النصوص بالإنجليزي */
export async function localize(env, data) {
  const places = [], events = [], articles = [];
  const walk = (v, key) => {
    if (Array.isArray(v)) { v.forEach((x) => walk(x, key)); return; }
    if (!v || typeof v !== 'object') return;
    if (key === 'places' || key === 'place' || (key === 'picks' && v.kinds)) places.push(v);
    else if (key === 'events' || key === 'event') events.push(v);
    else if (key === 'articles' || key === 'article') articles.push(v);
    else if (key === 'cities' && v.id && v.name) { v.name = CITY_EN[v.id] || v.name; return; }
    else if (key === 'kinds' && v.id && v.name) { v.name = KIND_EN[v.id] || v.name; return; }
    for (const [k, x] of Object.entries(v)) if (x && typeof x === 'object') walk(x, k);
  };
  walk(data, '');
  const [tp, te, ta] = await Promise.all([load(env, 'place', places.map((x) => x.id)), load(env, 'event', events.map((x) => x.id)), load(env, 'article', articles.map((x) => x.id))]);
  places.forEach((x) => applyItem(x, tp));
  events.forEach((x) => applyItem(x, te));
  articles.forEach((x) => applyItem(x, ta));
  return data;
}

/** استيراد دفعة ترجمات: { kind, items: { id: {t,s,b,a} } } */
export async function importTranslations(env, body) {
  const kind = ['place', 'event', 'article'].includes(body?.kind) ? body.kind : null;
  if (!kind || !body.items || typeof body.items !== 'object') return { error: 'bad_request' };
  const table = kind === 'place' ? 'places' : kind + 's';
  const ids = Object.keys(body.items).map(Number).filter(Boolean);
  const sigs = new Map();
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90);
    const { results } = await env.DB.prepare(`SELECT id, sig FROM ${table} WHERE id IN (${part.map(() => '?').join(',')})`).bind(...part).all();
    results.forEach((r) => sigs.set(r.id, r.sig || ''));
  }
  const t = now();
  const stmts = [];
  let skipped = 0;
  for (const id of ids) {
    if (!sigs.has(id)) { skipped++; continue; }
    const x = body.items[id] || {};
    const cut = (v, n) => String(v || '').trim().slice(0, n);
    stmts.push(env.DB.prepare('INSERT OR REPLACE INTO tr (kind,id,lang,t,s,b,a,src,updated) VALUES (?,?,\'en\',?,?,?,?,?,?)')
      .bind(kind, id, cut(x.t, 200), cut(x.s, 1200), cut(x.b, 12000), cut(x.a, 300), sigs.get(id), t));
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return { ok: true, saved: stmts.length, skipped };
}

/** كم مترجم من كل نوع (للوحة) */
export async function trStats(env) {
  const out = {};
  for (const [kind, table] of [['place', 'places'], ['event', 'events'], ['article', 'articles']]) {
    const r = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM ${table} WHERE deleted=0) total,
      (SELECT COUNT(*) FROM tr JOIN ${table} x ON x.id=tr.id WHERE tr.kind=? AND tr.lang='en' AND x.deleted=0) done,
      (SELECT COUNT(*) FROM tr JOIN ${table} x ON x.id=tr.id WHERE tr.kind=? AND tr.lang='en' AND x.deleted=0 AND x.updated>tr.updated) stale`).bind(kind, kind).first();
    out[kind] = r;
  }
  return out;
}

const plain = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const RULES = `You translate content of the "Saudi Guide" travel app from Arabic to English for international tourists.
Clear, warm, factual travel-guide English. Keep every fact, add none, no emoji.
If the Arabic title contains an English name after " - ", use it as the English title. Use common English names: Madinah, Makkah, AlUla, the Prophet's Mosque, the Grand Mosque, Saudi Vision 2030.
Omit the line "الصور لأغراض تعريفية، وتعود حقوقها لأصحابها".
Reply with JSON only: {"t":"title","s":"summary","b":"body paragraphs separated by \\n\\n","a":"address or empty"}`;

/** ترجمة عنصر واحد بـClaude (للمحتوى الجديد فقط) */
async function translateOne(env, kind, r) {
  const src = { title: r.title, summary: r.summary || '', body: plain(r.body).slice(0, 6000), address: r.address || '' };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: env.MODERATION_MODEL || 'claude-haiku-5-5', max_tokens: 2500, system: RULES, messages: [{ role: 'user', content: JSON.stringify(src) }] }),
  });
  if (!res.ok) throw new Error('anthropic_' + res.status);
  const j = await res.json();
  const txt = String(j.content?.[0]?.text || '');
  const x = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  await importTranslations(env, { kind, items: { [r.id]: x } });
}

/** الكرون: يترجم الجديد أو اللي تغيّر (حد أقصى 6 كل مرة عشان ما يطوّل) */
export async function runTranslate(env) {
  if (!env.ANTHROPIC_API_KEY || !(await getFeatures(env)).translate) return;
  // المحتوى القديم ترجمناه هنا بالمحادثة (مجاناً)، فالسيرفر يترجم بس اللي انضاف بعد أول تشغيل أو انعدل بعد ترجمته
  let since = +(await env.DB.prepare("SELECT v FROM kv WHERE k='translate_since'").first())?.v || 0;
  if (!since) { since = now(); await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('translate_since',?)").bind(String(since)).run(); }
  let left = 6;
  for (const [kind, table] of [['place', 'places'], ['event', 'events'], ['article', 'articles']]) {
    if (left <= 0) break;
    const { results } = await env.DB.prepare(`SELECT x.* FROM ${table} x LEFT JOIN tr ON tr.kind=? AND tr.id=x.id AND tr.lang='en'
      WHERE x.deleted=0 AND ((tr.id IS NULL AND x.updated>?) OR x.updated>tr.updated) ORDER BY x.updated DESC LIMIT ?`).bind(kind, since, left).all();
    for (const r of results) {
      try { await translateOne(env, kind, r); left--; } catch (e) { console.log('translate', kind, r.id, e && e.message); return; }
    }
  }
}
