/* دليل السعودية للأعمال: الباقات + «سجّل اهتمامك»
   - الباقات المدفوعة مقفلة للبيع (PLANS_ON_SALE=false) لين يطلع السجل التجاري. ما فيه دفع ولا أسعار حالياً.
   - المشرف يقدر يعطي أي تاجر باقة يدوياً من اللوحة (هدية/تجربة) لمدة محددة، وتنتهي تلقائياً وترجع مجانية
   - «سجّل اهتمامك»: أي تاجر (بحساب أو بدون) يترك اسمه ووسيلة تواصل، وتوصلك في اللوحة
     GET  /v1/business            الباقات للعرض
     POST /v1/business/interest   {name, contact, city, kind, plan, note}
     GET  /admin/business/leads?status=   POST /admin/business/leads/:id {status, note}
   - ما نحذف شي: الطلبات تنقفل (done) أو تنخفى (hidden) */
import { sessionUser } from './auth.js';
import { CITIES } from './normalize.js';

const now = () => Math.floor(Date.now() / 1000);
const str = (v, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export const PLANS_ON_SALE = false;
/** كل باقة: كم كوبون فعّال، وهل تطلع قبل غيرها في كوبونات المدينة مع شارة «مميّز» */
export const PLANS = {
  free: { name: 'الباقة المجانية', name_en: 'Free', coupons: 1, featured: false },
  plus: { name: 'الباقة المميزة', name_en: 'Featured', coupons: 3, featured: true },
  pro: { name: 'باقة الشريك', name_en: 'Partner', coupons: 10, featured: true },
};
const FEATURES = {
  free: ['كوبون فعّال واحد', 'ظهور في كوبونات مدينتك وصفحة محلك', 'رمز يتغير كل 30 ثانية يمنع التلاعب', 'تقرير أسبوعي بالمشاهدات والاستخدام'],
  plus: ['3 كوبونات فعّالة', 'تطلع قبل غيرك في كوبونات مدينتك', 'شارة «مميّز» على عروضك', 'كل مزايا المجانية'],
  pro: ['10 كوبونات فعّالة', 'أعلى أولوية في الظهور', 'شارة «مميّز» على عروضك', 'تواصل مباشر مع فريق الدليل لعروض المواسم'],
};
const FEATURES_EN = {
  free: ['1 active coupon', 'Listed in your city coupons and on your place page', 'Code changes every 30 seconds to stop misuse', 'Weekly report of views and redemptions'],
  plus: ['3 active coupons', 'Shown before others in your city', '"Featured" badge on your offers', 'Everything in Free'],
  pro: ['10 active coupons', 'Top placement priority', '"Featured" badge on your offers', 'Direct line to the Guide team for seasonal offers'],
};

/** الباقة الفعلية للتاجر (المنتهية ترجع مجانية) */
export const planOf = (m) => (m && m.plan && m.plan !== 'free' && PLANS[m.plan] && (!m.plan_until || m.plan_until > now()) ? m.plan : 'free');
/** شرط SQL: التاجر m عنده باقة مميزة سارية */
export const FEATURED_SQL = "(COALESCE(m.plan,'free')<>'free' AND (m.plan_until IS NULL OR m.plan_until>strftime('%s','now')))";

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS business_leads ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, name TEXT NOT NULL, contact TEXT NOT NULL, city TEXT, kind TEXT, plan TEXT, note TEXT, ip TEXT, status TEXT NOT NULL DEFAULT 'new', admin_note TEXT, created INTEGER NOT NULL, updated INTEGER )",
  'CREATE INDEX IF NOT EXISTS leads_status ON business_leads(status, id)',
];
let ready = false;
async function ensure(env) { if (!ready) { await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))); ready = true; } }

const leadOut = (r) => ({ id: r.id, name: r.name, contact: r.contact, city: r.city || '', cityName: (CITIES.find((c) => c[0] === r.city) || [])[1] || '', kind: r.kind || '', plan: r.plan || '',
  planName: PLANS[r.plan]?.name || '', note: r.note || '', status: r.status, adminNote: r.admin_note || '', registered: !!r.user_id, merchant: r.m_name ? { name: r.m_name, status: r.m_status } : null, created: r.created });

export async function businessRoute(p, request, env, J, q) {
  if (!p.startsWith('/v1/business')) return null;
  const en = q.get('lang') === 'en';
  if (p === '/v1/business' && request.method === 'GET') {
    return J({ onSale: PLANS_ON_SALE, plans: Object.entries(PLANS).map(([id, x]) => ({ id, name: en ? x.name_en : x.name, coupons: x.coupons, featured: x.featured, features: (en ? FEATURES_EN : FEATURES)[id], available: id === 'free' || PLANS_ON_SALE })) });
  }
  if (p === '/v1/business/interest' && request.method === 'POST') {
    await ensure(env);
    const me = await sessionUser(env, request);
    const b = await request.json().catch(() => ({}));
    const name = str(b.name, 80), contact = str(b.contact, 120);
    if (name.length < 2 || contact.length < 5) return J({ error: 'bad_request' }, 400);
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM business_leads WHERE created>? AND ' + (me ? 'user_id=?' : 'ip=?')).bind(now() - 86400, me ? me.id : ip).first();
    if (n.n >= 3) return J({ error: 'too_many' }, 429);
    const city = CITIES.some((c) => c[0] === b.city) ? b.city : null;
    const plan = PLANS[b.plan] ? b.plan : 'plus';
    await env.DB.prepare('INSERT INTO business_leads (user_id,name,contact,city,kind,plan,note,ip,created) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(me ? me.id : null, name, contact, city, str(b.kind, 30) || null, plan, str(b.note, 500) || null, ip, now()).run();
    return J({ ok: true });
  }
  return null;
}

export async function businessAdmin(p, request, env, J, q) {
  if (!p.startsWith('/admin/business')) return null;
  await ensure(env);
  let m;
  if (p === '/admin/business/leads' && request.method === 'GET') {
    const st = ['new', 'contacted', 'done', 'hidden', 'all'].includes(q.get('status')) ? q.get('status') : 'new';
    const { results } = await env.DB.prepare(`SELECT l.*, m.name m_name, m.status m_status FROM business_leads l LEFT JOIN merchants m ON m.user_id=l.user_id
      ${st === 'all' ? "WHERE l.status<>'hidden'" : 'WHERE l.status=?'} ORDER BY l.id DESC LIMIT 300`).bind(...(st === 'all' ? [] : [st])).all();
    const c = await env.DB.prepare("SELECT COUNT(*) n FROM business_leads WHERE status='new'").first();
    return J({ leads: results.map(leadOut), newCount: c.n, onSale: PLANS_ON_SALE });
  }
  if ((m = p.match(/^\/admin\/business\/leads\/(\d+)$/)) && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const r = await env.DB.prepare('SELECT * FROM business_leads WHERE id=?').bind(+m[1]).first();
    if (!r) return J({ error: 'not_found' }, 404);
    const status = ['new', 'contacted', 'done', 'hidden'].includes(b.status) ? b.status : r.status;
    const note = b.note === undefined ? r.admin_note : str(b.note, 500);
    await env.DB.prepare('UPDATE business_leads SET status=?, admin_note=?, updated=? WHERE id=?').bind(status, note, now(), r.id).run();
    return J({ ok: true });
  }
  return null;
}

export const newLeads = async (env) => { await ensure(env); return (await env.DB.prepare("SELECT COUNT(*) n FROM business_leads WHERE status='new'").first()).n; };

/** الكرون: الباقات اللي قربت تنتهي (تنبيه قبل 3 أيام) أو انتهت (ترجع مجانية، والكوبونات الزايدة تتوقف مؤقتاً بدون حذف) */
export async function planExpiry(env) {
  const t = now();
  const soon = await env.DB.prepare("SELECT id, user_id, name, plan_until FROM merchants WHERE COALESCE(plan,'free')<>'free' AND plan_until BETWEEN ? AND ? AND COALESCE(plan_warned,0)=0").bind(t, t + 3 * 86400).all();
  for (const m of soon.results) {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO notifications (user_id,type,text,link,created) VALUES (?,'system',?,'/merchant',?)").bind(m.user_id, `باقة «${m.name}» المميزة تنتهي خلال 3 أيام، وبعدها ترجع للباقة المجانية (كوبون فعّال واحد).`, t),
      env.DB.prepare('UPDATE merchants SET plan_warned=1 WHERE id=?').bind(m.id),
    ]);
  }
  const done = await env.DB.prepare("SELECT id, user_id, name FROM merchants WHERE COALESCE(plan,'free')<>'free' AND plan_until IS NOT NULL AND plan_until<=?").bind(t).all();
  for (const m of done.results) {
    const live = await env.DB.prepare("SELECT id FROM coupons WHERE merchant_id=? AND status IN ('active','pending') ORDER BY (status='active') DESC, used DESC, id").bind(m.id).all();
    const extra = live.results.slice(PLANS.free.coupons).map((c) => c.id);
    const ops = [env.DB.prepare("UPDATE merchants SET plan='free', plan_until=NULL, plan_warned=0, max_coupons=?, updated=? WHERE id=?").bind(PLANS.free.coupons, t, m.id)];
    if (extra.length) ops.push(env.DB.prepare(`UPDATE coupons SET status='paused', updated=? WHERE id IN (${extra.join(',')})`).bind(t));
    ops.push(env.DB.prepare("INSERT INTO notifications (user_id,type,text,link,created) VALUES (?,'system',?,'/merchant',?)").bind(m.user_id,
      `انتهت الباقة المميزة لـ«${m.name}» ورجعت مجانية.${extra.length ? ` وقفنا ${extra.length} كوبون مؤقتاً (ما انحذف شي)، وتقدر تختار أي كوبون تشغّله.` : ''}`, t));
    await env.DB.batch(ops);
  }
}
