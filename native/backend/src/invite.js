/* «ادعُ صديق»: كل حساب له كود دعوة ورابط. الصديق يسجّل حساب جديد ويدخل الكود → الاثنين ياخذون 3 أيام دليل+
   الحماية من التلاعب:
   - الكود ينقبل بس لحساب جديد (أقل من 7 أيام) ومرة وحدة بس، ومو كود صاحب الحساب نفسه
   - صاحب الدعوة ياخذ مكافأة 10 أصدقاء كحد أقصى كل 30 يوم (اللي بعدهم ينحسبون بس بدون أيام)
   - المكافأة «منحة» (plus_grant_until) تنضاف فوق أي منحة موجودة، والاشتراك الفعلي يتحسب من syncPlus */
import { sessionUser } from './auth.js';
import { syncPlus } from './iap.js';

const now = () => Math.floor(Date.now() / 1000);
const DAYS = 3, NEW_ACCOUNT_DAYS = 7, CAP = 10;
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS referrals ( invitee_id TEXT PRIMARY KEY, inviter_id TEXT NOT NULL, code TEXT NOT NULL, rewarded INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL )',
  'CREATE INDEX IF NOT EXISTS referrals_inviter ON referrals(inviter_id, created)',
];
let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.prepare('ALTER TABLE users ADD COLUMN invite_code TEXT').run().catch(() => {});
  await env.DB.batch([...SCHEMA, 'CREATE UNIQUE INDEX IF NOT EXISTS users_invite ON users(invite_code)'].map((s) => env.DB.prepare(s)));
  ready = true;
}

async function codeOf(env, u) {
  if (u.invite_code) return u.invite_code;
  for (let i = 0; i < 6; i++) {
    const c = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ABC[b % ABC.length]).join('');
    const r = await env.DB.prepare('UPDATE users SET invite_code=? WHERE id=? AND invite_code IS NULL').bind(c, u.id).run().catch(() => null);
    if (r?.meta?.changes) return c;
    const again = await env.DB.prepare('SELECT invite_code FROM users WHERE id=?').bind(u.id).first();
    if (again?.invite_code) return again.invite_code;
  }
  throw new Error('code_failed');
}
async function grant(env, uid, days) {
  await env.DB.prepare('UPDATE users SET plus_grant_until=MAX(COALESCE(plus_grant_until,0),?)+? WHERE id=?').bind(now(), days * 86400, uid).run();
  return syncPlus(env, uid);
}

export async function inviteRoute(p, request, env, J) {
  if (!p.startsWith('/v1/invite')) return null;
  await ensure(env);
  const me = await sessionUser(env, request);
  if (!me) return J({ error: 'login_required' }, 401);
  const web = env.WEB_URL || 'https://saudi-guide-web.saudi-guide2030.workers.dev';

  if (p === '/v1/invite' && request.method === 'GET') {
    const code = await codeOf(env, me);
    const st = await env.DB.prepare('SELECT COUNT(*) n, SUM(rewarded) r FROM referrals WHERE inviter_id=?').bind(me.id).first();
    const used = await env.DB.prepare('SELECT inviter_id FROM referrals WHERE invitee_id=?').bind(me.id).first();
    return J({
      code, link: `${web}/invite/${code}`, invited: st?.n || 0, daysEarned: (st?.r || 0) * DAYS, rewardDays: DAYS,
      canRedeem: !used && now() - me.created < NEW_ACCOUNT_DAYS * 86400, redeemed: !!used,
    });
  }
  if (p === '/v1/invite/redeem' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (code.length < 6) return J({ error: 'bad_code' }, 400);
    if (await env.DB.prepare('SELECT 1 FROM referrals WHERE invitee_id=?').bind(me.id).first()) return J({ error: 'already_used' }, 409);
    if (now() - me.created > NEW_ACCOUNT_DAYS * 86400) return J({ error: 'old_account' }, 403);
    const inviter = await env.DB.prepare('SELECT id, name FROM users WHERE invite_code=? AND deleted=0').bind(code).first();
    if (!inviter) return J({ error: 'bad_code' }, 404);
    if (inviter.id === me.id) return J({ error: 'own_code' }, 400);
    const recent = await env.DB.prepare('SELECT COUNT(*) n FROM referrals WHERE inviter_id=? AND rewarded=1 AND created>?').bind(inviter.id, now() - 30 * 86400).first();
    const reward = (recent?.n || 0) < CAP;
    await env.DB.prepare('INSERT INTO referrals (invitee_id,inviter_id,code,rewarded,created) VALUES (?,?,?,?,?)').bind(me.id, inviter.id, code, reward ? 1 : 0, now()).run();
    const until = await grant(env, me.id, DAYS);
    if (reward) {
      await grant(env, inviter.id, DAYS);
      await env.DB.prepare("INSERT INTO notifications (user_id,type,text,link,created) VALUES (?,'system',?,?,?)")
        .bind(inviter.id, `${me.name || 'صديقك'} انضم لدليل السعودية بدعوتك. أضفنا لك ${DAYS} أيام دليل+ هدية`, '/invite', now()).run();
    }
    return J({ ok: true, days: DAYS, plusUntil: until, inviter: inviter.name || '' });
  }
  return null;
}

/** للوحة: كم دعوة وكم يوم انعطى */
export async function inviteStats(env) {
  await ensure(env);
  const r = await env.DB.prepare('SELECT COUNT(*) n, SUM(rewarded) r FROM referrals').first();
  return { invites: r?.n || 0, rewarded: r?.r || 0 };
}
