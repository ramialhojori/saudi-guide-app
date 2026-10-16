/* دخول لوحة التحكم بالحساب (بدل نسخ المفتاح):
   - رامي يدخل بحسابه في دليل السعودية (قوقل أو آبل) — ولازم يكون حسابه «مشرف» (role=admin)
   - السيرفر يصدر «جلسة لوحة» خاصة (مو نفس جلسة التطبيق) صالحة 30 يوم، وصلاحية الحساب تنفحص مع كل طلب
     (لو انشال المشرف من حساب، يطلع من اللوحة فوراً)
   - «اطلع من كل الأجهزة» يلغي كل الجلسات القديمة
   - كل محاولة دخول (ناجحة أو مرفوضة) تنسجل: الحساب، الجهاز، الوقت
   - مفتاح الإدارة (X-Admin-Key) يبقى للأدوات الآلية بس: موصل Claude والمهام المجدولة */
import { verifyIdToken, audiencesFor } from './auth.js';

const enc = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);
const DAYS = 30;
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const key = (env) => crypto.subtle.importKey('raw', enc.encode('panel:' + env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS admin_logins ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, email TEXT, provider TEXT, ok INTEGER NOT NULL, reason TEXT, ip TEXT, ua TEXT, at INTEGER NOT NULL )',
  'CREATE INDEX IF NOT EXISTS admin_logins_at ON admin_logins(at DESC)',
];
let ready = false;
async function ensure(env) { if (!ready) { await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))); ready = true; } }

async function version(env) {
  const r = await env.DB.prepare("SELECT v FROM kv WHERE k='panel_ver'").first();
  return +(r?.v || 1);
}
async function sign(env, uid) {
  const p = b64u(enc.encode(JSON.stringify({ sub: uid, pnl: 1, ver: await version(env), iat: now(), exp: now() + DAYS * 86400 })));
  const sig = await crypto.subtle.sign('HMAC', await key(env), enc.encode(p));
  return `pnl.${p}.${b64u(sig)}`;
}

/** مين يطلب؟ { via: 'key' } للأدوات، أو { via: 'user', user } للمشرف المسجّل، أو null */
export async function adminAuth(env, request) {
  if (env.ADMIN_KEY && request.headers.get('X-Admin-Key') === env.ADMIN_KEY) return { via: 'key' };
  const m = (request.headers.get('Authorization') || '').match(/^Bearer pnl\.([^.]+)\.([^.]+)$/);
  if (!m || !env.SESSION_SECRET) return null;
  const ok = await crypto.subtle.verify('HMAC', await key(env), unb64u(m[2]), enc.encode(m[1])).catch(() => false);
  if (!ok) return null;
  let pl; try { pl = JSON.parse(new TextDecoder().decode(unb64u(m[1]))); } catch { return null; }
  if (!pl.pnl || !pl.sub || pl.exp < now() || pl.ver !== (await version(env))) return null;
  const user = await env.DB.prepare("SELECT id, name, email, role, avatar FROM users WHERE id=? AND deleted=0 AND role='admin'").bind(pl.sub).first();
  return user ? { via: 'user', user, exp: pl.exp } : null;
}

const meta = (request) => [(request.headers.get('CF-Connecting-IP') || '').slice(0, 45), (request.headers.get('User-Agent') || '').slice(0, 200)];

/** POST /v1/admin/login  { provider: 'google'|'apple', idToken } */
export async function adminLoginRoute(p, request, env, J) {
  if (p !== '/v1/admin/login' || request.method !== 'POST') return null;
  await ensure(env);
  if (!env.SESSION_SECRET) return J({ error: 'auth_not_configured' }, 503);
  const [ip, ua] = meta(request);
  // حماية بسيطة: أكثر من 10 محاولات مرفوضة من نفس العنوان خلال ساعة → ننتظر
  const bad = await env.DB.prepare('SELECT COUNT(*) n FROM admin_logins WHERE ip=? AND ok=0 AND at>?').bind(ip, now() - 3600).first();
  if ((bad?.n || 0) >= 10) return J({ error: 'too_many' }, 429);
  const b = await request.json().catch(() => ({}));
  const provider = b.provider === 'apple' ? 'apple' : 'google';
  const log = (uid, email, ok, reason) => env.DB.prepare('INSERT INTO admin_logins (user_id,email,provider,ok,reason,ip,ua,at) VALUES (?,?,?,?,?,?,?,?)').bind(uid, email, provider, ok ? 1 : 0, reason, ip, ua, now()).run();
  let pl;
  try { pl = await verifyIdToken(provider, b.idToken, audiencesFor(env, provider)); }
  catch (e) { await log(null, null, false, 'bad_token: ' + String(e.message || e).slice(0, 60)); return J({ error: 'bad_token' }, 401); }
  const col = provider === 'apple' ? 'apple_sub' : 'google_sub';
  let u = await env.DB.prepare(`SELECT * FROM users WHERE ${col}=? AND deleted=0`).bind(pl.sub).first();
  // نفس الإيميل الموثّق مربوط بحساب ثاني (آبل ↔ قوقل)
  if (!u && pl.email && (pl.email_verified === true || pl.email_verified === 'true')) u = await env.DB.prepare('SELECT * FROM users WHERE lower(email)=lower(?) AND deleted=0').bind(pl.email).first();
  if (!u) { await log(null, pl.email || null, false, 'no_account'); return J({ error: 'no_account' }, 403); }
  if (u.role !== 'admin') { await log(u.id, pl.email || u.email, false, 'not_admin'); return J({ error: 'not_admin' }, 403); }
  await log(u.id, pl.email || u.email, true, null);
  return J({ token: await sign(env, u.id), user: { name: u.name || '', email: u.email || pl.email || '', avatar: u.avatar || '' }, days: DAYS });
}

/** مسارات /admin/session/* (بعد التحقق) */
export async function adminSessionRoute(p, request, env, J, who) {
  if (!p.startsWith('/admin/session')) return null;
  await ensure(env);
  if (p === '/admin/session' && request.method === 'GET') {
    return J({ via: who.via, user: who.user ? { name: who.user.name || '', email: who.user.email || '', avatar: who.user.avatar || '' } : null, exp: who.exp || null });
  }
  if (p === '/admin/session/logout-all' && request.method === 'POST') {
    const v = (await version(env)) + 1;
    await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('panel_ver',?)").bind(String(v)).run();
    return J({ ok: true });
  }
  if (p === '/admin/session/logins' && request.method === 'GET') {
    const { results } = await env.DB.prepare(`SELECT l.*, u.name FROM admin_logins l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.at DESC LIMIT 60`).all();
    return J({ logins: results });
  }
  return null;
}
