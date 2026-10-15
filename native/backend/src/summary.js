/* «خلاصة الزوار»: Claude يلخّص اللي قاله الناس عن المكان (تقييمات + إجابات ونصايح المجتمع) في سطرين
   - تطلع أعلى صفحة المكان لما يكون فيه 3 مشاركات أو أكثر
   - تنحفظ، وتتجدد بالخلفية لما تزيد المشاركات 2 أو يمر عليها 30 يوم (ما يتأخر فتح الصفحة)
   - تقفلها من اللوحة: الميزات ← «خلاصة الزوار» */
import { getFeatures } from './contrib.js';

const now = () => Math.floor(Date.now() / 1000);
const MIN = 3;

async function sources(env, pid) {
  const rv = await env.DB.prepare("SELECT stars, tags, text FROM reviews WHERE place_id=? AND status='visible' ORDER BY updated DESC LIMIT 40").bind(pid).all();
  const cm = await env.DB.prepare(`SELECT p.kind, p.text q, (SELECT GROUP_CONCAT(a.text, ' | ') FROM answers a WHERE a.post_id=p.id AND a.status='visible') ans
    FROM posts p WHERE p.place_id=? AND p.status='visible' ORDER BY p.id DESC LIMIT 25`).bind(pid).all();
  const items = [];
  for (const r of rv.results) {
    let tags = [];
    try { tags = JSON.parse(r.tags || '[]'); } catch { /* */ }
    if (r.text || tags.length) items.push(`تقييم ${r.stars}/5${tags.length ? ` (${tags.join('، ')})` : ''}${r.text ? `: ${r.text}` : ''}`);
  }
  for (const c of cm.results) {
    if (c.kind === 'tip') items.push(`نصيحة: ${c.q}`);
    else if (c.ans) items.push(`سؤال: ${c.q} ← أجابوا: ${c.ans}`);
  }
  return items;
}

const RULES = `أنت محرر في تطبيق "دليل السعودية". يوصلك كلام زوار عن مكان واحد (تقييمات وإجابات ونصايح).
اكتب "خلاصة الزوار" في جملتين قصيرتين بالكثير (أقل من 220 حرف)، بلهجة سعودية بيضاء واضحة.
- اذكر اللي يتكرر فقط: الإيجابيات والسلبيات (زحمة، أسعار، مواقف، مناسب للعائلة...) وأفضل وقت لو ذكروه.
- لا تخترع أي معلومة ما قالوها، ولا تذكر أسماء أشخاص أو أرقام جوال أو روابط.
- لا تبدأ بـ"الزوار يقولون" ولا تستخدم إيموجي. اكتب الخلاصة نفسها مباشرة بدون أي مقدمة أو تنسيق.`;

async function generate(env, title, items) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: env.MODERATION_MODEL || 'claude-haiku-5-5', max_tokens: 220, system: RULES,
      messages: [{ role: 'user', content: `المكان: ${title}\n\n${items.slice(0, 60).map((x) => '- ' + String(x).slice(0, 400)).join('\n')}` }] }),
  });
  if (!r.ok) throw new Error('anthropic_' + r.status);
  const j = await r.json();
  return String(j.content?.[0]?.text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

async function refresh(env, pid) {
  const place = await env.DB.prepare('SELECT title FROM places WHERE id=? AND deleted=0').bind(pid).first();
  if (!place) return;
  const items = await sources(env, pid);
  if (items.length < MIN) return;
  const text = await generate(env, place.title, items);
  if (text) await env.DB.prepare('INSERT OR REPLACE INTO place_summary (place_id,text,n,updated) VALUES (?,?,?,?)').bind(pid, text, items.length, now()).run();
}

export async function summaryRoute(p, env, J, ctx) {
  const m = p.match(/^\/v1\/places\/(\d+)\/summary$/);
  if (!m) return null;
  const pid = +m[1];
  if (!(await getFeatures(env)).ai_summary || !env.ANTHROPIC_API_KEY) return J({ summary: null });
  const row = await env.DB.prepare('SELECT text, n, updated FROM place_summary WHERE place_id=?').bind(pid).first();
  // عدد المشاركات الحالي (رخيص) عشان نعرف هل الخلاصة قديمة
  const cnt = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM reviews WHERE place_id=?1 AND status='visible' AND (text<>'' OR tags<>'[]'))
      + (SELECT COUNT(*) FROM posts WHERE place_id=?1 AND status='visible' AND (kind='tip' OR answers>0)) n`).bind(pid).first();
  const n = cnt?.n || 0;
  const stale = n >= MIN && (!row || n - row.n >= 2 || now() - row.updated > 30 * 86400);
  if (stale) {
    // قفل بسيط: ما نولّد لنفس المكان أكثر من مرة كل 10 دقايق
    const lock = `sum_lock:${pid}`;
    const l = await env.DB.prepare('SELECT v FROM kv WHERE k=?').bind(lock).first();
    if (!l || now() - +l.v > 600) {
      await env.DB.prepare('INSERT OR REPLACE INTO kv (k,v) VALUES (?,?)').bind(lock, String(now())).run();
      ctx.waitUntil(refresh(env, pid).catch((e) => console.log('summary', e && e.message)));
    }
  }
  return J({ summary: row && n >= MIN ? { text: row.text, count: row.n } : null }, 200, 60);
}
