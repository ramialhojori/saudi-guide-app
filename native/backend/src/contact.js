/**
 * «تواصل معنا» من داخل التطبيق — كل الرسائل توصل لوحة التحكم، مفلترة حسب النوع.
 *  POST /v1/contact {kind, text, reply_to?}   (مسجّل أو زائر)
 *  GET  /v1/contact/mine                     (رسائلي وردود الفريق)
 *  GET  /admin/contact?kind=&status=          POST /admin/contact/:id {status?, reply?}
 */
import { sessionUser } from './auth.js';

const now = () => Math.floor(Date.now() / 1000);
export const CONTACT_KINDS = {
  suggestion: 'اقتراح أو فكرة',
  complaint: 'شكوى',
  correction: 'تصحيح معلومة',
  bug: 'مشكلة في التطبيق',
  ads: 'إعلان أو شراكة',
  merchant: 'استفسار تاجر',
  question: 'سؤال',
  other: 'شي ثاني',
};
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS contact_msgs ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, kind TEXT NOT NULL, text TEXT NOT NULL, reply_to TEXT, city TEXT, app TEXT, ip TEXT, status TEXT NOT NULL DEFAULT 'new', reply TEXT, replied INTEGER, created INTEGER NOT NULL )",
  'CREATE INDEX IF NOT EXISTS contact_status ON contact_msgs(status, kind, id)',
];
let ready = false;
async function ensure(env) { if (!ready) { await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))); ready = true; } }

const row = (r) => ({ id: r.id, kind: r.kind, kindName: CONTACT_KINDS[r.kind] || r.kind, text: r.text, replyTo: r.reply_to || '', status: r.status, reply: r.reply || '', replied: r.replied || null, created: r.created });

export async function contactRoute(request, env, p, J) {
  if (!p.startsWith('/v1/contact')) return null;
  await ensure(env);
  const me = await sessionUser(env, request);
  if (p === '/v1/contact/mine') {
    if (!me) return J({ items: [] });
    const { results } = await env.DB.prepare('SELECT * FROM contact_msgs WHERE user_id=? ORDER BY id DESC LIMIT 30').bind(me.id).all();
    return J({ items: results.map(row) });
  }
  if (p === '/v1/contact' && request.method === 'GET') return J({ kinds: Object.entries(CONTACT_KINDS).map(([id, name]) => ({ id, name })) }, 200);
  if (p === '/v1/contact' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const kind = CONTACT_KINDS[b.kind] ? b.kind : 'other';
    const text = String(b.text || '').trim().slice(0, 2000);
    if (text.length < 5) return J({ error: 'text_too_short' }, 400);
    const replyTo = String(b.reply_to || '').trim().slice(0, 120);
    if (!me && !replyTo) return J({ error: 'reply_to_required' }, 400);
    const ip = request.headers.get('CF-Connecting-IP') || '';
    // حد معقول ضد الإزعاج: 5 رسائل باليوم للشخص
    const since = now() - 86400;
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM contact_msgs WHERE created>? AND ' + (me ? 'user_id=?' : 'ip=?')).bind(since, me ? me.id : ip).first();
    if (n.n >= 5) return J({ error: 'too_many' }, 429);
    const r = await env.DB.prepare('INSERT INTO contact_msgs (user_id,kind,text,reply_to,city,app,ip,created) VALUES (?,?,?,?,?,?,?,?)')
      .bind(me ? me.id : null, kind, text, replyTo || null, me?.city || null, String(b.app || '').slice(0, 40), ip, now()).run();
    return J({ ok: true, id: r.meta.last_row_id });
  }
  return null;
}

export async function contactAdmin(request, env, p, q, J) {
  if (!p.startsWith('/admin/contact')) return null;
  await ensure(env);
  if (p === '/admin/contact' && request.method === 'GET') {
    const where = [], args = [];
    const st = q.get('status') || 'new';
    if (st !== 'all') { where.push('c.status=?'); args.push(st); }
    if (q.get('kind')) { where.push('c.kind=?'); args.push(q.get('kind')); }
    const { results } = await env.DB.prepare(`SELECT c.*, u.name u_name, u.city u_city FROM contact_msgs c LEFT JOIN users u ON u.id=c.user_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.id DESC LIMIT 200`).bind(...args).all();
    const counts = await env.DB.prepare("SELECT kind, SUM(status='new') n, COUNT(*) total FROM contact_msgs GROUP BY kind").all();
    return J({
      kinds: CONTACT_KINDS,
      counts: Object.fromEntries(counts.results.map((x) => [x.kind, { new: x.n, total: x.total }])),
      items: results.map((r) => ({ ...row(r), user: r.user_id ? { id: r.user_id, name: r.u_name || 'مستخدم', city: r.u_city || '' } : null, app: r.app || '' })),
    });
  }
  const m = p.match(/^\/admin\/contact\/(\d+)$/);
  if (m && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const c = await env.DB.prepare('SELECT * FROM contact_msgs WHERE id=?').bind(+m[1]).first();
    if (!c) return J({ error: 'not_found' }, 404);
    const reply = typeof b.reply === 'string' ? b.reply.trim().slice(0, 1000) : '';
    const status = ['new', 'done', 'archived'].includes(b.status) ? b.status : reply ? 'done' : c.status;
    await env.DB.prepare('UPDATE contact_msgs SET status=?, reply=COALESCE(?,reply), replied=CASE WHEN ? IS NULL THEN replied ELSE ? END WHERE id=?')
      .bind(status, reply || null, reply || null, now(), c.id).run();
    // الرد يوصل المستخدم إشعار داخل التطبيق ويفتح صفحة التواصل
    if (reply && c.user_id) await env.DB.prepare("INSERT INTO notifications (user_id,type,text,link,created) VALUES (?,'system',?,'/contact',?)").bind(c.user_id, `رد فريق الدليل على رسالتك: ${reply}`.slice(0, 160), now()).run();
    return J({ ok: true, status, notified: !!(reply && c.user_id) });
  }
  return null;
}
