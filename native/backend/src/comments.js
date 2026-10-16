/* تعليقات الأخبار
   - التعليق يمر على الفلتر المجاني (أرقام، روابط، كلمات مسيئة) ثم مراجعة Claude قبل ما ينشر
     · مسيء أو إعلان أو خارج الموضوع ← ينرفض فوراً ويطلع للمستخدم السبب (وما ينشر أبداً)
     · غير متأكد ← «قيد المراجعة» لين يراجعه رامي من اللوحة
   - 3 بلاغات من 3 أشخاص ← يختفي تلقائياً ويروح للمراجعة
   - اللي ينرفض له 3 تعليقات خلال 24 ساعة يتوقف عن التعليق يوم، والموقوف من المجتمع ما يعلّق
   - ما نحذف شي من القاعدة: الحذف = إخفاء (hidden)
     GET  /v1/articles/:id/comments          POST /v1/articles/:id/comments {text}
     POST /v1/comments/:id/report            GET /admin/comments?status=   POST /admin/comments/:id {status} */
import { sessionUser } from './auth.js';
import { getFeatures } from './contrib.js';
import { quickFilter } from './moderation.js';

const now = () => Math.floor(Date.now() / 1000);
const clean = (s, max = 600) => String(s ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

const RULES = `أنت مشرف تعليقات على الأخبار في تطبيق "دليل السعودية" (دليل سياحي ومشاريع وفعاليات في السعودية).
اقبل (approve) أي تعليق محترم له علاقة بالخبر: رأي، سؤال، إضافة معلومة، شكر، أو حتى نقد هادئ — بلهجة عامية عادي.
ارفض (reject) إذا فيه: سب أو شتم أو سخرية جارحة أو تنمر أو عنصرية، إساءة لدين أو جنسية أو قبيلة أو منطقة أو أشخاص بأسمائهم أو للدولة وقيادتها،
محتوى سياسي أو طائفي أو تحريض، كلام جنسي أو خادش، إعلان أو ترويج أو طلب تواصل، أو كلام بلا معنى.
اختر review إذا كنت غير متأكد.
السبب (reason) يطلع للمستخدم لو رفضت: جملة وحدة لطيفة بلهجة سعودية بيضاء بدون اتهام.
أجب بـ JSON فقط: {"decision":"approve|reject|review","reason":"..."}`;

async function moderateComment(env, text, title, aiOn) {
  const bad = quickFilter(text);
  if (bad) return { status: 'rejected', reason: bad.replace('المشاركة فيها', 'التعليق فيه'), by: 'filter' };
  if (!aiOn || !env.ANTHROPIC_API_KEY) return { status: 'visible', reason: '', by: 'off' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.MODERATION_MODEL || 'claude-haiku-5-5', max_tokens: 200, system: RULES,
        messages: [{ role: 'user', content: `عنوان الخبر: ${title}\nالتعليق:\n${text}` }] }),
    });
    if (!r.ok) throw new Error('anthropic_' + r.status);
    const j = await r.json();
    const m = String(j.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
    const v = m ? JSON.parse(m[0]) : null;
    const d = v && ['approve', 'reject', 'review'].includes(v.decision) ? v.decision : 'review';
    return { status: d === 'approve' ? 'visible' : d === 'reject' ? 'rejected' : 'pending', reason: String(v?.reason || '').slice(0, 200), by: 'ai' };
  } catch {
    // Claude ما رد: التعليق يستنى مراجعة رامي بدل ما ينشر بدون فحص
    return { status: 'pending', reason: '', by: 'error' };
  } finally { clearTimeout(timer); }
}

const out = (r, me) => ({ id: r.id, text: r.text, created: r.created, mine: !!me && r.user_id === me.id, status: r.status,
  author: { name: r.u_name || 'مستخدم الدليل', city: r.u_city || '' } });

export async function commentsRoute(p, request, env, J) {
  let m;
  const me = await sessionUser(env, request);
  if ((m = p.match(/^\/v1\/articles\/(\d+)\/comments$/))) {
    const aid = +m[1];
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(`SELECT c.*, u.name u_name, u.city u_city FROM article_comments c LEFT JOIN users u ON u.id=c.user_id
        WHERE c.article_id=? AND (c.status='visible' OR (c.user_id=? AND c.status='pending')) ORDER BY c.id DESC LIMIT 200`).bind(aid, me?.id || '').all();
      return J({ comments: results.map((r) => out(r, me)), count: results.filter((r) => r.status === 'visible').length });
    }
    if (request.method === 'POST') {
      if (!me) return J({ error: 'login_required' }, 401);
      if (!(await getFeatures(env)).comments) return J({ error: 'disabled' }, 403);
      if (me.community_ban_until && me.community_ban_until > now()) return J({ error: 'suspended', until: me.community_ban_until }, 403);
      const a = await env.DB.prepare('SELECT id, title FROM articles WHERE id=? AND deleted=0').bind(aid).first();
      if (!a) return J({ error: 'not_found' }, 404);
      const b = await request.json().catch(() => ({}));
      const text = clean(b.text, 600);
      if (text.length < 2) return J({ error: 'too_short' }, 400);
      const day = now() - 86400;
      const st = await env.DB.prepare("SELECT COUNT(*) n, SUM(status='rejected') bad FROM article_comments WHERE user_id=? AND created>?").bind(me.id, day).first();
      if ((st.bad || 0) >= 3) return J({ error: 'cooldown' }, 429);
      if ((st.n || 0) >= 30) return J({ error: 'rate_limited' }, 429);
      const mod = await moderateComment(env, text, a.title, (await getFeatures(env)).ai_moderation);
      const r = await env.DB.prepare('INSERT INTO article_comments (article_id,user_id,text,status,reason,mod_by,created) VALUES (?,?,?,?,?,?,?)')
        .bind(aid, me.id, text, mod.status, mod.reason || null, mod.by, now()).run();
      if (mod.status === 'rejected') return J({ error: 'rejected', reason: mod.reason }, 422);
      return J({ id: r.meta.last_row_id, status: mod.status });
    }
  }
  if ((m = p.match(/^\/v1\/comments\/(\d+)\/report$/)) && request.method === 'POST') {
    if (!me) return J({ error: 'login_required' }, 401);
    const id = +m[1];
    const done = await env.DB.prepare('INSERT OR IGNORE INTO comment_reports (comment_id,user_id,created) VALUES (?,?,?)').bind(id, me.id, now()).run();
    if (!done.meta.changes) return J({ error: 'already_reported' }, 409);
    await env.DB.prepare('UPDATE article_comments SET reports=reports+1 WHERE id=?').bind(id).run();
    await env.DB.prepare("UPDATE article_comments SET status='pending', reason='بلاغات' WHERE id=? AND status='visible' AND reports>=3").bind(id).run();
    return J({ ok: true });
  }
  return null;
}

export async function commentsAdmin(p, request, env, J, q) {
  let m;
  if (p === '/admin/comments' && request.method === 'GET') {
    const st = ['visible', 'pending', 'rejected', 'hidden', 'reported'].includes(q.get('status')) ? q.get('status') : 'pending';
    const where = st === 'reported' ? "c.reports>0 AND c.status<>'hidden'" : 'c.status=?';
    const { results } = await env.DB.prepare(`SELECT c.*, u.name u_name, a.title a_title FROM article_comments c LEFT JOIN users u ON u.id=c.user_id LEFT JOIN articles a ON a.id=c.article_id
      WHERE ${where} ORDER BY c.id DESC LIMIT 200`).bind(...(st === 'reported' ? [] : [st])).all();
    return J({ comments: results.map((r) => ({ id: r.id, text: r.text, status: r.status, reason: r.reason || '', by: r.mod_by || '', reports: r.reports, created: r.created,
      user: { id: r.user_id, name: r.u_name || 'مستخدم الدليل' }, article: { id: r.article_id, title: r.a_title || '' } })) });
  }
  if ((m = p.match(/^\/admin\/comments\/(\d+)$/)) && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (!['visible', 'hidden', 'rejected'].includes(b.status)) return J({ error: 'bad_status' }, 400);
    await env.DB.prepare('UPDATE article_comments SET status=?, reports=CASE WHEN ?=\'visible\' THEN 0 ELSE reports END WHERE id=?').bind(b.status, b.status, +m[1]).run();
    return J({ ok: true });
  }
  return null;
}
