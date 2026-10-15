/* الذكاء الاصطناعي في التطبيق (دليل+):
   1) «اسأل الدليل»: مساعد يجاوب من محتوى الدليل فقط (الأماكن والفعاليات وإجابات أهل المدينة والأخبار)
      Claude يبحث بنفسه في قاعدة البيانات بأدوات، ويرجع جواب + بطاقات أماكن وفعاليات
   2) «خطط لي رحلة الذكية»: خطة يوم بيوم من أماكن الدليل وفعالياته في تواريخ الرحلة، مع سبب كل اختيار
   - الحد المجاني باليوم يتحدد من اللوحة (kv: ai_limits)، ومشترك دليل+ (users.plus_until) بلا حد
   - مفتاح Claude في السيرفر فقط (ANTHROPIC_API_KEY) */

import { sessionUser } from './auth.js';
import { CITIES, searchKey } from './normalize.js';
import { getFeatures } from './contrib.js';

const now = () => Math.floor(Date.now() / 1000);
const parse = (s, d = []) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const dayKey = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const cityName = (id) => (CITIES.find((c) => c[0] === id) || [])[1] || id || '';
const KIND_AR = { sights: 'معالم', heritage: 'تراث', islamic: 'معالم إسلامية', nature: 'طبيعة', food: 'مطاعم', cafe: 'مقاهي', shopping: 'تسوق', fun: 'ترفيه' };

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS ai_usage (user_id TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day, kind))',
  'CREATE TABLE IF NOT EXISTS ai_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, kind TEXT, q TEXT, ok INTEGER, ms INTEGER, tokens INTEGER, created INTEGER NOT NULL)',
];
let ready = false;
async function ensure(env) { if (!ready) { await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))); ready = true; } }

export async function aiLimits(env) {
  const r = await env.DB.prepare("SELECT v FROM kv WHERE k='ai_limits'").first();
  const v = parse(r?.v, {});
  return { chat: Number.isFinite(+v.chat) ? +v.chat : 5, plan: Number.isFinite(+v.plan) ? +v.plan : 2 };
}
async function quota(env, u, kind) {
  const plus = u.plus_until && u.plus_until > now();
  const lim = (await aiLimits(env))[kind];
  const row = await env.DB.prepare('SELECT n FROM ai_usage WHERE user_id=? AND day=? AND kind=?').bind(u.id, dayKey(), kind).first();
  const used = row?.n || 0;
  return { plus: !!plus, limit: plus ? null : lim, used, left: plus ? null : Math.max(0, lim - used) };
}
const useOne = (env, uid, kind) => env.DB.prepare('INSERT INTO ai_usage (user_id,day,kind,n) VALUES (?,?,?,1) ON CONFLICT(user_id,day,kind) DO UPDATE SET n=n+1').bind(uid, dayKey(), kind).run();

/* ═════════ أدوات البحث اللي يستخدمها Claude ═════════ */
const placeRow = (r) => ({ id: r.id, title: r.title, city: cityName(r.city), kinds: parse(r.kinds).map((k) => KIND_AR[k] || k), cats: parse(r.cats).slice(0, 3), summary: (r.summary || '').slice(0, 200), address: r.address || '', lat: r.lat, lng: r.lng, hasPhoto: !!(r.thumb) });
const eventRow = (r) => ({ id: r.id, title: r.title, city: cityName(r.city), start: r.start, end: r.end || '', cats: parse(r.cats), summary: (r.summary || '').slice(0, 200), address: r.address || '', tickets: r.tickets || '' });

async function toolSearchPlaces(env, a) {
  const where = ['deleted=0'], args = [];
  if (a.city && CITIES.some((c) => c[0] === a.city)) { where.push('city=?'); args.push(a.city); }
  if (a.kind && KIND_AR[a.kind]) { where.push('kinds LIKE ?'); args.push(`%"${a.kind}"%`); }
  const words = searchKey(a.query || '').split(' ').filter((w) => w.length > 1).slice(0, 4);
  if (words.length) { where.push('(' + words.map(() => 'search LIKE ?').join(' OR ') + ')'); args.push(...words.map((w) => `%${w}%`)); }
  const { results } = await env.DB.prepare(`SELECT id,title,city,kinds,cats,summary,address,lat,lng,thumb FROM places WHERE ${where.join(' AND ')} ORDER BY (thumb IS NULL OR thumb='') ASC, updated DESC LIMIT ?`).bind(...args, Math.min(+a.limit || 12, 25)).all();
  return results.map(placeRow);
}
async function toolEvents(env, a) {
  const from = a.from || new Date().toISOString(), to = a.to || new Date(Date.now() + 60 * 86400e3).toISOString();
  const where = ['deleted=0', "COALESCE(NULLIF(\"end\",''),start) >= ?", 'start <= ?'], args = [from, to];
  if (a.city && CITIES.some((c) => c[0] === a.city)) { where.push('city=?'); args.push(a.city); }
  if (a.query) { where.push('(title LIKE ? OR cats LIKE ? OR summary LIKE ?)'); args.push(`%${a.query}%`, `%${a.query}%`, `%${a.query}%`); }
  const { results } = await env.DB.prepare(`SELECT id,title,city,start,"end",cats,summary,address,tickets FROM events WHERE ${where.join(' AND ')} ORDER BY start LIMIT 20`).bind(...args).all();
  return results.map(eventRow);
}
async function toolCommunity(env, a) {
  const words = String(a.query || '').split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
  if (!words.length) return [];
  const args = [], cond = words.map(() => 'p.text LIKE ?').join(' OR ');
  words.forEach((w) => args.push(`%${w}%`));
  let sql = `SELECT p.id, p.city, p.text q, (SELECT a.text FROM answers a WHERE a.post_id=p.id AND a.status='visible' ORDER BY (a.id=p.best_answer) DESC, a.thanks DESC LIMIT 1) a
    FROM posts p WHERE p.status='visible' AND p.answers>0 AND (${cond})`;
  if (a.city) { sql += ' AND p.city=?'; args.push(a.city); }
  const { results } = await env.DB.prepare(sql + ' ORDER BY p.thanks DESC, p.id DESC LIMIT 6').bind(...args).all();
  return results.filter((r) => r.a).map((r) => ({ city: cityName(r.city), question: r.q.slice(0, 200), bestAnswer: r.a.slice(0, 300) }));
}
async function toolArticles(env, a) {
  const { results } = await env.DB.prepare("SELECT id,title,summary,date FROM articles WHERE deleted=0 AND (title LIKE ?1 OR summary LIKE ?1) ORDER BY date DESC LIMIT 5").bind(`%${a.query || ''}%`).all();
  return results.map((r) => ({ id: r.id, title: r.title, summary: (r.summary || '').slice(0, 200), date: r.date }));
}

const CITY_DESC = 'معرّف المدينة: ' + CITIES.map((c) => `${c[0]} (${c[1]})`).join('، ');
const TOOLS = [
  { name: 'search_places', description: 'يبحث في أماكن الدليل (معالم، مطاعم، مقاهي، طبيعة، تسوق، ترفيه، تراث، معالم إسلامية). استخدمه لأي سؤال عن أماكن.', input_schema: { type: 'object', properties: { query: { type: 'string', description: 'كلمات البحث بالعربي (اسم أو نوع أو صفة)، أو فاضي لأفضل الأماكن' }, city: { type: 'string', description: CITY_DESC }, kind: { type: 'string', enum: Object.keys(KIND_AR) }, limit: { type: 'number' } } } },
  { name: 'upcoming_events', description: 'الفعاليات القادمة أو الشغالة في فترة معيّنة (حفلات، رياضة، معارض، مواسم...).', input_schema: { type: 'object', properties: { city: { type: 'string', description: CITY_DESC }, from: { type: 'string', description: 'ISO date' }, to: { type: 'string', description: 'ISO date' }, query: { type: 'string', description: 'كلمة في اسم الفعالية أو تصنيفها (مثل: حفلات، موسم الرياض)' } } } },
  { name: 'community_answers', description: 'أسئلة أجاب عليها أهل المدن في مجتمع الدليل (نصائح محلية حقيقية).', input_schema: { type: 'object', properties: { query: { type: 'string' }, city: { type: 'string', description: CITY_DESC } }, required: ['query'] } },
  { name: 'news', description: 'أخبار الدليل.', input_schema: { type: 'object', properties: { query: { type: 'string' } } } },
];
const RUN = { search_places: toolSearchPlaces, upcoming_events: toolEvents, community_answers: toolCommunity, news: toolArticles };

async function claude(env, model, system, messages, tools, maxTokens = 1200) {
  const r = await fetch((env.ANTHROPIC_BASE || 'https://api.anthropic.com') + '/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages, ...(tools ? { tools } : {}) }),
  });
  if (!r.ok) throw new Error('anthropic_' + r.status);
  return r.json();
}

/** حلقة الأدوات: Claude يبحث لين يجهز جوابه النهائي (حد أقصى 5 جولات) */
async function runWithTools(env, model, system, messages, maxTokens) {
  const seen = { places: new Map(), events: new Map() };
  let tokens = 0;
  for (let i = 0; i < 5; i++) {
    const res = await claude(env, model, system, messages, TOOLS, maxTokens);
    tokens += (res.usage?.input_tokens || 0) + (res.usage?.output_tokens || 0);
    if (res.stop_reason !== 'tool_use') return { text: (res.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim(), seen, tokens };
    messages.push({ role: 'assistant', content: res.content });
    const results = [];
    for (const c of res.content.filter((x) => x.type === 'tool_use')) {
      let out;
      try { out = await RUN[c.name](env, c.input || {}); } catch (e) { out = { error: String(e.message || e) }; }
      if (c.name === 'search_places' && Array.isArray(out)) out.forEach((p) => seen.places.set(p.id, p));
      if (c.name === 'upcoming_events' && Array.isArray(out)) out.forEach((p) => seen.events.set(p.id, p));
      results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(out).slice(0, 12000) });
    }
    messages.push({ role: 'user', content: results });
  }
  throw new Error('too_many_steps');
}
const lastJson = (t) => { const m = String(t || '').match(/\{[\s\S]*\}\s*$/) || String(t || '').match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };

const ASK_RULES = (city) => `أنت «مساعد دليل السعودية»، مساعد سياحي داخل تطبيق دليل السعودية. اليوم ${dayKey()} (توقيت مكة).${city ? ` المستخدم مهتم بمدينة ${cityName(city)} (${city}).` : ''}
- جاوب فقط من محتوى الدليل: استخدم الأدوات للبحث في الأماكن والفعاليات وإجابات أهل المدن قبل ما تجاوب. لا تخترع أماكن أو أسعار أو مواعيد غير موجودة في نتائج الأدوات.
- لو ما لقيت شي مناسب في الدليل قلها بصراحة واقترح أقرب بديل من الدليل.
- لو السؤال خارج السياحة والسفر داخل السعودية (سياسة، دين بفتاوى، أمور شخصية...) اعتذر بلطف ورجّع الحديث للسياحة.
- اكتب بلهجة سعودية بيضاء ودودة ومختصرة (حتى 120 كلمة)، بدون رموز تعبيرية وبدون ماركداون ثقيل.
- في النهاية أرجع JSON فقط بهالشكل بدون أي نص بعده: {"answer":"نص الجواب","places":[أرقام الأماكن اللي ذكرتها بالترتيب، حتى 6],"events":[أرقام الفعاليات، حتى 4],"followups":["سؤال متابعة قصير","..."]}`;

const PLAN_RULES = (o) => `أنت مخطط رحلات في تطبيق دليل السعودية. خطط رحلة ${o.days} ${o.days === 1 ? 'يوم' : 'أيام'} في ${cityName(o.city)} (${o.city}) تبدأ ${o.start || 'قريباً'}.
المسافرين: ${o.party || 'غير محدد'}. الميزانية: ${o.budget || 'متوسطة'}. الإيقاع: ${o.pace || 'عادي'} (هادئ = 3 أماكن باليوم، عادي = 4، مكثف = 5-6). الاهتمامات: ${(o.interests || []).map((k) => KIND_AR[k] || k).join('، ') || 'منوّعة'}. ملاحظات المسافر: ${o.notes || 'لا يوجد'}.
- استخدم الأدوات: ابحث عن أماكن المدينة حسب الاهتمامات والأنواع (مطاعم للغداء والعشاء، مقاهي، معالم...)، وابحث عن الفعاليات في تواريخ الرحلة وأدخل المناسب منها.
- رتّب كل يوم جغرافياً (الأماكن القريبة من بعض ورا بعض حسب الإحداثيات)، ووزّع الأوقات بشكل منطقي: صباح، غداء، عصر، مغرب، عشاء. راعِ أوقات الصلاة (لا تحط زيارات طويلة وقت المغرب والعشاء بدون استراحة) وراعِ العائلة والأطفال لو موجودين.
- استخدم فقط أماكن وفعاليات رجعت من الأدوات بأرقامها. لا تكرر مكان.
- لكل محطة: سبب قصير (جملة) ليش اخترتها لهالمسافر، ووقت تقريبي.
- أرجع JSON فقط بدون أي نص بعده: {"title":"عنوان قصير للرحلة","days":[{"title":"عنوان اليوم","stops":[{"type":"place|event","id":رقم,"time":"9:00 ص","why":"السبب"}]}],"tips":["نصيحة قصيرة","..."]}`;

/* ═════════ المسارات ═════════ */
export async function aiRoute(p, request, env, J) {
  if (!p.startsWith('/v1/ai/')) return null;
  await ensure(env);
  const f = await getFeatures(env);
  const u = await sessionUser(env, request);
  if (p === '/v1/ai/status' && request.method === 'GET') {
    if (!u) return J({ login: false, chat: f.ai_chat, plan: f.ai_planner });
    const plusRow = await env.DB.prepare('SELECT plus_until FROM users WHERE id=?').bind(u.id).first();
    const uu = { ...u, plus_until: plusRow?.plus_until || 0 };
    return J({ login: true, chat: f.ai_chat, plan: f.ai_planner, quota: { chat: await quota(env, uu, 'chat'), plan: await quota(env, uu, 'plan') } });
  }
  if (request.method !== 'POST') return null;
  if (!u) return J({ error: 'login_required' }, 401);
  if (!env.ANTHROPIC_API_KEY) return J({ error: 'ai_not_configured' }, 503);
  const plusRow = await env.DB.prepare('SELECT plus_until FROM users WHERE id=?').bind(u.id).first();
  const uu = { ...u, plus_until: plusRow?.plus_until || 0 };
  const b = await request.json().catch(() => ({}));
  const t0 = Date.now();

  if (p === '/v1/ai/ask') {
    if (!f.ai_chat) return J({ error: 'feature_off' }, 403);
    const q = await quota(env, uu, 'chat');
    if (!q.plus && q.left <= 0) return J({ error: 'quota', quota: q }, 429);
    const hist = (Array.isArray(b.messages) ? b.messages : []).slice(-8)
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 1500) })).filter((m) => m.content);
    if (!hist.length || hist[hist.length - 1].role !== 'user') return J({ error: 'bad_request' }, 400);
    const question = hist[hist.length - 1].content;
    try {
      const out = await runWithTools(env, env.AI_MODEL || 'claude-haiku-5-5', ASK_RULES(b.city), hist, 1200);
      const j = lastJson(out.text) || { answer: out.text.replace(/\{[\s\S]*\}\s*$/, '').trim() };
      const places = (j.places || []).map(Number).filter((id) => out.seen.places.has(id)).slice(0, 6);
      const events = (j.events || []).map(Number).filter((id) => out.seen.events.has(id)).slice(0, 4);
      const ph = places.length ? (await env.DB.prepare(`SELECT id,title,city,kinds,thumb,images,summary FROM places WHERE id IN (${places.join(',')})`).all()).results : [];
      const ev = events.length ? (await env.DB.prepare(`SELECT id,title,city,start,"end",thumb,images FROM events WHERE id IN (${events.join(',')})`).all()).results : [];
      await useOne(env, u.id, 'chat');
      await env.DB.prepare('INSERT INTO ai_log (user_id,kind,q,ok,ms,tokens,created) VALUES (?,?,?,?,?,?,?)').bind(u.id, 'chat', question.slice(0, 300), 1, Date.now() - t0, out.tokens, now()).run();
      return J({
        answer: String(j.answer || '').slice(0, 2000),
        places: places.map((id) => ph.find((r) => r.id === id)).filter(Boolean).map((r) => ({ id: r.id, title: r.title, city: r.city, kinds: parse(r.kinds), thumb: r.thumb || parse(r.images)[0] || '', summary: (r.summary || '').slice(0, 120) })),
        events: events.map((id) => ev.find((r) => r.id === id)).filter(Boolean).map((r) => ({ id: r.id, title: r.title, city: r.city, start: r.start, end: r.end || '', thumb: r.thumb || parse(r.images)[0] || '' })),
        followups: (j.followups || []).map(String).slice(0, 3),
        quota: await quota(env, uu, 'chat'),
      });
    } catch (e) {
      await env.DB.prepare('INSERT INTO ai_log (user_id,kind,q,ok,ms,tokens,created) VALUES (?,?,?,?,?,?,?)').bind(u.id, 'chat', String(e.message || e).slice(0, 300), 0, Date.now() - t0, 0, now()).run();
      return J({ error: 'ai_failed' }, 502);
    }
  }

  if (p === '/v1/ai/plan') {
    if (!f.ai_planner) return J({ error: 'feature_off' }, 403);
    const q = await quota(env, uu, 'plan');
    if (!q.plus && q.left <= 0) return J({ error: 'quota', quota: q }, 429);
    if (!CITIES.some((c) => c[0] === b.city)) return J({ error: 'bad_city' }, 400);
    const o = { city: b.city, days: Math.max(1, Math.min(5, Math.round(+b.days || 1))), start: /^\d{4}-\d{2}-\d{2}$/.test(b.start || '') ? b.start : '', party: String(b.party || '').slice(0, 40), budget: String(b.budget || '').slice(0, 30), pace: String(b.pace || '').slice(0, 20), interests: (Array.isArray(b.interests) ? b.interests : []).filter((k) => KIND_AR[k]), notes: String(b.notes || '').slice(0, 300) };
    try {
      const out = await runWithTools(env, env.PLANNER_MODEL || 'claude-sonnet-5-5', PLAN_RULES(o), [{ role: 'user', content: 'خطط الرحلة الحين.' }], 3000);
      const j = lastJson(out.text);
      if (!j || !Array.isArray(j.days)) throw new Error('bad_plan');
      const used = new Set();
      const days = j.days.slice(0, o.days).map((d) => ({
        title: String(d.title || '').slice(0, 80),
        stops: (d.stops || []).map((s) => ({ type: s.type === 'event' ? 'event' : 'place', id: +s.id, time: String(s.time || '').slice(0, 20), why: String(s.why || '').slice(0, 200) }))
          .filter((s) => (s.type === 'event' ? out.seen.events.has(s.id) : out.seen.places.has(s.id)) && !used.has(s.type + s.id) && used.add(s.type + s.id)).slice(0, 7),
      })).filter((d) => d.stops.length);
      if (!days.length) throw new Error('empty_plan');
      const pids = days.flatMap((d) => d.stops.filter((s) => s.type === 'place').map((s) => s.id));
      const eids = days.flatMap((d) => d.stops.filter((s) => s.type === 'event').map((s) => s.id));
      const ph = pids.length ? (await env.DB.prepare(`SELECT id,title,city,kinds,thumb,images,summary,lat,lng FROM places WHERE id IN (${pids.join(',')})`).all()).results : [];
      const ev = eids.length ? (await env.DB.prepare(`SELECT id,title,city,start,"end",thumb,images,address FROM events WHERE id IN (${eids.join(',')})`).all()).results : [];
      const full = days.map((d) => ({ ...d, stops: d.stops.map((s) => {
        if (s.type === 'event') { const r = ev.find((x) => x.id === s.id); return { ...s, title: r.title, thumb: r.thumb || parse(r.images)[0] || '', start: r.start, address: r.address || '' }; }
        const r = ph.find((x) => x.id === s.id); return { ...s, title: r.title, thumb: r.thumb || parse(r.images)[0] || '', kinds: parse(r.kinds), lat: r.lat, lng: r.lng, summary: (r.summary || '').slice(0, 100) };
      }) }));
      await useOne(env, u.id, 'plan');
      await env.DB.prepare('INSERT INTO ai_log (user_id,kind,q,ok,ms,tokens,created) VALUES (?,?,?,?,?,?,?)').bind(u.id, 'plan', `${o.city} ${o.days}d`, 1, Date.now() - t0, out.tokens, now()).run();
      return J({ title: String(j.title || '').slice(0, 80), days: full, tips: (j.tips || []).map(String).slice(0, 4), quota: await quota(env, uu, 'plan') });
    } catch (e) {
      await env.DB.prepare('INSERT INTO ai_log (user_id,kind,q,ok,ms,tokens,created) VALUES (?,?,?,?,?,?,?)').bind(u.id, 'plan', String(e.message || e).slice(0, 300), 0, Date.now() - t0, 0, now()).run();
      return J({ error: 'ai_failed' }, 502);
    }
  }
  return null;
}

/* ═════════ الإدارة: الحدود المجانية والإحصاءات ومنح دليل+ ═════════ */
export async function aiAdmin(p, request, env, J) {
  if (!p.startsWith('/admin/ai')) return null;
  await ensure(env);
  if (p === '/admin/ai' && request.method === 'GET') {
    const since = now() - 30 * 86400;
    const st = await env.DB.prepare("SELECT kind, COUNT(*) n, SUM(ok) ok, SUM(tokens) tokens, AVG(ms) ms, COUNT(DISTINCT user_id) users FROM ai_log WHERE created>? GROUP BY kind").bind(since).all();
    const recent = await env.DB.prepare('SELECT l.kind, l.q, l.ok, l.created, u.name FROM ai_log l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.id DESC LIMIT 30').all();
    const plus = await env.DB.prepare('SELECT COUNT(*) n FROM users WHERE plus_until>?').bind(now()).first();
    return J({ limits: await aiLimits(env), stats: st.results, recent: recent.results, plusUsers: plus?.n || 0, configured: !!env.ANTHROPIC_API_KEY });
  }
  if (p === '/admin/ai/limits' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const v = { chat: Math.max(0, Math.min(100, Math.round(+b.chat))), plan: Math.max(0, Math.min(20, Math.round(+b.plan))) };
    if (!Number.isFinite(v.chat) || !Number.isFinite(v.plan)) return J({ error: 'bad_request' }, 400);
    await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('ai_limits',?)").bind(JSON.stringify(v)).run();
    return J({ ok: true, limits: v });
  }
  if (p === '/admin/ai/plus' && request.method === 'POST') {
    // منح دليل+ يدوياً (هدية أو تجربة) لين يجهز الاشتراك عن طريق آبل وقوقل
    const b = await request.json().catch(() => ({}));
    const days = Math.max(0, Math.min(366, Math.round(+b.days || 0)));
    await env.DB.prepare('UPDATE users SET plus_until=? WHERE id=?').bind(days ? now() + days * 86400 : null, String(b.userId)).run();
    return J({ ok: true });
  }
  return null;
}
