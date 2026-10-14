/* بوابة التجار والكوبونات
   - التاجر يسجّل نشاطه من التطبيق (مربوط بحسابه) → «قيد المراجعة» لين توافق الإدارة من اللوحة
   - الباقة المجانية: كوبون واحد فعّال (max_coupons)، وكل كوبون جديد أو تعديل يرجع للمراجعة
   - الاستخدام عند الكاشير: المستخدم يفتح الكوبون فيظهر له رمز من 4 أرقام يتغير كل 30 ثانية
     (موقّع بسر السيرفر ومربوط بالمستخدم والكوبون)، والكاشير يدخله في «لوحة التاجر»
   - ما نحذف شي: الحذف = إخفاء */

import { sessionUser } from './auth.js';
import { CITIES } from './normalize.js';
import { LEVELS } from './community.js';

/** المستوى من مجموع النقاط اللي جمعها (الصرف ما ينزّل المستوى) */
export const levelOf = (pts) => { let l = 1; LEVELS.forEach(([at], i) => { if ((pts || 0) >= at) l = i + 1; }); return l; };
const balanceOf = (u) => Math.max(0, (u.points || 0) - (u.spent || 0));

const now = () => Math.floor(Date.now() / 1000);
const parse = (s, d = []) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const str = (v, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
const cityOk = (c) => CITIES.some((x) => x[0] === c);
const KINDS = ['restaurant', 'cafe', 'sweets', 'juice', 'dates', 'perfume', 'gifts', 'clothing', 'shop', 'mall', 'hotel', 'resort', 'experience', 'tours', 'fun', 'car', 'umrah', 'salon', 'other'];
const CKINDS = ['percent', 'amount', 'bogo', 'gift'];
const SLOT = 30; // ثانية
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); // بتوقيت مكة

/* ——— الرمز المتغير ——— */
const enc = new TextEncoder();
let keyP = null;
async function codeFor(env, couponId, uid, slot) {
  if (!keyP) keyP = crypto.subtle.importKey('raw', enc.encode('coupon:' + (env.SESSION_SECRET || 'x')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await keyP, enc.encode(`${couponId}:${uid}:${slot}`)));
  const n = ((sig[0] << 24) | (sig[1] << 16) | (sig[2] << 8) | sig[3]) >>> 0;
  return String(n % 10000).padStart(4, '0');
}

/* ——— الشكل اللي يطلع للتطبيق ——— */
export function offText(c) {
  if (c.kind === 'percent') return `خصم ${c.value}%`;
  if (c.kind === 'amount') return `خصم ${c.value} ر.س`;
  if (c.kind === 'bogo') return '1+1 مجاناً';
  return c.value ? `هدية: ${c.value}` : 'هدية مع طلبك';
}
const merchantOut = (m) => ({
  id: m.id, name: m.name, name_en: m.name_en || '', kind: m.kind, city: m.city, area: m.area || '', lat: m.lat, lng: m.lng,
  placeId: m.place_id || null, photos: parse(m.photos), hours: m.hours || '', phone: m.phone || '', cr: m.cr || '',
  verified: !!m.verified, maxCoupons: m.max_coupons, status: m.status, note: m.note || '', created: m.created, updated: m.updated,
});
const couponOut = (c, extra = {}) => ({
  id: c.id, kind: c.kind, value: c.value || '', off: offText(c), title: c.title, terms: c.terms || '', minOrder: c.min_order || null,
  perUser: !!c.per_user, qty: c.qty || null, used: c.used, left: c.qty ? Math.max(0, c.qty - c.used) : null, views: c.views,
  hours: c.hours || '', start: c.start || '', end: c.end || '', status: c.status, note: c.note || '', created: c.created,
  points: c.points || 0, minLevel: c.min_level || 0, levelName: c.min_level ? (LEVELS[c.min_level - 1] || [])[1] || '' : '',
  ...extra,
});
/** كوبون عام مع بيانات المحل (للتطبيق) */
const publicCoupon = (r, saved) => couponOut(r, {
  saved: !!saved,
  biz: { id: r.merchant_id, name: r.m_name, kind: r.m_kind, city: r.m_city, area: r.m_area || '', photo: parse(r.m_photos)[0] || '', verified: !!r.m_verified, placeId: r.m_place || null, lat: r.m_lat, lng: r.m_lng },
});
const PUBLIC_SQL = `SELECT c.*, m.name m_name, m.kind m_kind, m.city m_city, m.area m_area, m.photos m_photos, m.verified m_verified, m.place_id m_place, m.lat m_lat, m.lng m_lng
  FROM coupons c JOIN merchants m ON m.id=c.merchant_id
  WHERE c.status='active' AND m.status='approved' AND (c.start IS NULL OR c.start='' OR c.start<=?1) AND (c."end" IS NULL OR c."end"='' OR c."end">=?1)
    AND (c.qty IS NULL OR c.used<c.qty)`;

function merchantFields(b) {
  const photos = (Array.isArray(b.photos) ? b.photos : []).map((x) => str(x, 300)).filter((x) => x.includes('/media/c/')).slice(0, 8);
  return {
    name: str(b.name, 80), name_en: str(b.name_en, 80), kind: KINDS.includes(b.kind) ? b.kind : 'restaurant', city: str(b.city, 40),
    area: str(b.area, 60), lat: num(b.lat), lng: num(b.lng), photos: JSON.stringify(photos), hours: str(b.hours, 120),
    phone: str(b.phone, 20).replace(/[^\d+]/g, ''), cr: str(b.cr, 20).replace(/[^\d]/g, ''),
  };
}
function couponFields(b) {
  const kind = CKINDS.includes(b.kind) ? b.kind : 'percent';
  let value = str(b.value, 40);
  if (kind === 'percent') value = String(Math.min(90, Math.max(5, Math.round(+value || 0))));
  if (kind === 'amount') value = String(Math.min(5000, Math.max(1, Math.round(+value || 0))));
  const d = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x || '')) ? x : '');
  return {
    kind, value, title: str(b.title, 90), terms: String(b.terms ?? '').trim().slice(0, 600), min_order: num(b.minOrder) ? Math.round(+b.minOrder) : null,
    per_user: b.perUser === false ? 0 : 1, qty: num(b.qty) && +b.qty > 0 ? Math.min(100000, Math.round(+b.qty)) : null,
    hours: str(b.hours, 80), start: d(b.start), end: d(b.end),
    points: num(b.points) && +b.points > 0 ? Math.min(100000, Math.round(+b.points)) : null,
    min_level: num(b.minLevel) && +b.minLevel > 1 ? Math.min(LEVELS.length, Math.round(+b.minLevel)) : null,
  };
}
const notify = (env, userId, text) =>
  env.DB.prepare("INSERT INTO notifications (user_id,type,text,created) VALUES (?,'system',?,?)").bind(userId, String(text).slice(0, 140), now());

/* ═════════ مسارات التطبيق ═════════ */
export async function merchantRoute(p, request, env, J, q) {
  const M = request.method;
  const me = await sessionUser(env, request);
  const uid = me ? me.id : '';
  let m;

  /* ——— كوبونات المدينة (عام) ——— */
  if (p === '/v1/coupons' && M === 'GET') {
    const args = [today()];
    let sql = PUBLIC_SQL;
    if (q.get('city')) { sql += ' AND m.city=?2'; args.push(q.get('city')); }
    if (+q.get('place')) { sql += ` AND m.place_id=?${args.length + 1}`; args.push(+q.get('place')); }
    if (+q.get('merchant')) { sql += ` AND m.id=?${args.length + 1}`; args.push(+q.get('merchant')); }
    if (q.get('rewards')) sql += ' AND (c.points>0 OR c.min_level>1)';
    const { results } = await env.DB.prepare(sql + ' ORDER BY m.verified DESC, c.used DESC, c.id DESC LIMIT 100').bind(...args).all();
    let saved = new Set();
    if (uid && results.length) {
      const s = await env.DB.prepare('SELECT coupon_id FROM coupon_saves WHERE user_id=?').bind(uid).all();
      saved = new Set(s.results.map((x) => x.coupon_id));
    }
    return J({ coupons: results.map((r) => publicCoupon(r, saved.has(r.id))), me: me ? { balance: balanceOf(me), level: levelOf(me.points) } : null });
  }
  if ((m = p.match(/^\/v1\/coupons\/(\d+)$/)) && M === 'GET') {
    const r = await env.DB.prepare(PUBLIC_SQL + ' AND c.id=?2').bind(today(), +m[1]).first();
    if (!r) return J({ error: 'not_found' }, 404);
    await env.DB.prepare('UPDATE coupons SET views=views+1 WHERE id=?').bind(r.id).run();
    const s = uid ? await env.DB.prepare('SELECT 1 FROM coupon_saves WHERE user_id=? AND coupon_id=?').bind(uid, r.id).first() : null;
    const used = uid ? await env.DB.prepare('SELECT COUNT(*) n FROM redemptions WHERE user_id=? AND coupon_id=?').bind(uid, r.id).first() : { n: 0 };
    return J({ coupon: { ...publicCoupon(r, s), usedByMe: used.n }, me: me ? { balance: balanceOf(me), level: levelOf(me.points) } : null });
  }
  if ((m = p.match(/^\/v1\/coupons\/(\d+)\/save$/)) && M === 'POST') {
    if (!me) return J({ error: 'login_required' }, 401);
    const id = +m[1];
    const had = await env.DB.prepare('SELECT 1 FROM coupon_saves WHERE user_id=? AND coupon_id=?').bind(uid, id).first();
    if (had) await env.DB.prepare('DELETE FROM coupon_saves WHERE user_id=? AND coupon_id=?').bind(uid, id).run();
    else await env.DB.prepare('INSERT INTO coupon_saves (user_id,coupon_id,created) VALUES (?,?,?)').bind(uid, id, now()).run();
    return J({ saved: !had });
  }
  /* الرمز المتغير: يحفظ الكوبون تلقائياً ويسجل وقت الفتح (الكاشير يدور بين اللي فتحوه آخر 15 دقيقة) */
  if ((m = p.match(/^\/v1\/coupons\/(\d+)\/code$/)) && M === 'GET') {
    if (!me) return J({ error: 'login_required' }, 401);
    const c = await env.DB.prepare(PUBLIC_SQL + ' AND c.id=?2').bind(today(), +m[1]).first();
    const last = await env.DB.prepare('SELECT created FROM redemptions WHERE user_id=? AND coupon_id=? ORDER BY id DESC LIMIT 1').bind(uid, +m[1]).first();
    const since = +q.get('since') || 0;
    if (last && since && last.created >= since) return J({ redeemed: true, at: last.created });
    if (!c) return J({ error: 'not_available' }, 404);
    if (c.per_user && last) return J({ error: 'already_used', at: last.created }, 409);
    if (c.min_level && levelOf(me.points) < c.min_level) return J({ error: 'need_level', need: c.min_level }, 403);
    if (c.points && balanceOf(me) < c.points) return J({ error: 'need_points', need: c.points, have: balanceOf(me) }, 403);
    await env.DB.prepare('INSERT INTO coupon_saves (user_id,coupon_id,opened,created) VALUES (?1,?2,?3,?3) ON CONFLICT(user_id,coupon_id) DO UPDATE SET opened=?3').bind(uid, c.id, now()).run();
    const t = now(), slot = Math.floor(t / SLOT);
    return J({ code: await codeFor(env, c.id, uid, slot), left: SLOT - (t % SLOT), redeemed: false });
  }
  /* محفظتي */
  if (p === '/v1/me/coupons' && M === 'GET') {
    if (!me) return J({ error: 'login_required' }, 401);
    const { results } = await env.DB.prepare(PUBLIC_SQL.replace('SELECT c.*,', 'SELECT c.*, (SELECT COUNT(*) FROM redemptions x WHERE x.coupon_id=c.id AND x.user_id=?2) my_used,') + ' AND c.id IN (SELECT coupon_id FROM coupon_saves WHERE user_id=?2) ORDER BY c."end" IS NULL, c."end"').bind(today(), uid).all();
    return J({ coupons: results.map((r) => ({ ...publicCoupon(r, true), usedByMe: r.my_used })) });
  }

  /* ——— لوحة التاجر ——— */
  if (!p.startsWith('/v1/merchant')) return null;
  if (!me) return J({ error: 'login_required' }, 401);
  const mine = await env.DB.prepare('SELECT * FROM merchants WHERE user_id=?').bind(uid).first();

  if (p === '/v1/merchant' && M === 'GET') {
    if (!mine) return J({ merchant: null, coupons: [] });
    const cs = await env.DB.prepare("SELECT * FROM coupons WHERE merchant_id=? AND status!='hidden' ORDER BY id DESC").bind(mine.id).all();
    const since = now() - 7 * 86400;
    const red = await env.DB.prepare('SELECT created FROM redemptions WHERE merchant_id=? AND created>?').bind(mine.id, since).all();
    const week = [0, 0, 0, 0, 0, 0, 0]; // من 6 أيام قبل لين اليوم
    const d0 = Math.floor((now() + 3 * 3600) / 86400);
    for (const r of red.results) { const i = 6 - (d0 - Math.floor((r.created + 3 * 3600) / 86400)); if (i >= 0 && i < 7) week[i]++; }
    const tot = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM redemptions WHERE merchant_id=?1) used,
        (SELECT COUNT(*) FROM coupon_saves s JOIN coupons c ON c.id=s.coupon_id WHERE c.merchant_id=?1) saves,
        (SELECT COALESCE(SUM(views),0) FROM coupons WHERE merchant_id=?1) views`).bind(mine.id).first();
    return J({ merchant: merchantOut(mine), coupons: cs.results.map((c) => couponOut(c)), stats: { ...tot, week, today: d0 } });
  }
  if (p === '/v1/merchant' && M === 'POST') {
    const b = await request.json().catch(() => ({}));
    const f = merchantFields(b);
    if (f.name.length < 2) return J({ error: 'name_required' }, 400);
    if (!cityOk(f.city)) return J({ error: 'bad_city' }, 400);
    if (!mine) {
      const r = await env.DB.prepare(`INSERT INTO merchants (user_id,name,name_en,kind,city,area,lat,lng,photos,hours,phone,cr,created,updated)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uid, f.name, f.name_en, f.kind, f.city, f.area, f.lat, f.lng, f.photos, f.hours, f.phone, f.cr, now(), now()).run();
      return J({ id: r.meta.last_row_id, status: 'pending' });
    }
    if (mine.status === 'hidden') return J({ error: 'suspended' }, 403);
    // تعديل الاسم أو المدينة لنشاط معتمد يرجعه للمراجعة؛ باقي التفاصيل تتحدث مباشرة
    const big = mine.status === 'approved' && (f.name !== mine.name || f.city !== mine.city || f.cr !== (mine.cr || ''));
    const status = mine.status === 'rejected' || big ? 'pending' : mine.status;
    await env.DB.prepare(`UPDATE merchants SET name=?,name_en=?,kind=?,city=?,area=?,lat=?,lng=?,photos=?,hours=?,phone=?,cr=?,status=?,verified=?,updated=? WHERE id=?`)
      .bind(f.name, f.name_en, f.kind, f.city, f.area, f.lat, f.lng, f.photos, f.hours, f.phone, f.cr, status, f.cr === (mine.cr || '') ? mine.verified : 0, now(), mine.id).run();
    return J({ id: mine.id, status });
  }
  if (!mine) return J({ error: 'no_merchant' }, 404);

  if (p === '/v1/merchant/coupons' && M === 'POST') {
    if (mine.status === 'hidden' || mine.status === 'rejected') return J({ error: 'merchant_not_active' }, 403);
    const b = await request.json().catch(() => ({}));
    const f = couponFields(b);
    if (f.title.length < 4) return J({ error: 'title_required' }, 400);
    if ((f.kind === 'percent' || f.kind === 'amount') && !+f.value) return J({ error: 'value_required' }, 400);
    if (f.end && f.start && f.end < f.start) return J({ error: 'bad_dates' }, 400);
    const live = await env.DB.prepare("SELECT COUNT(*) n FROM coupons WHERE merchant_id=? AND status IN ('pending','active','paused')").bind(mine.id).first();
    if (live.n >= mine.max_coupons) return J({ error: 'limit', max: mine.max_coupons }, 409);
    const r = await env.DB.prepare(`INSERT INTO coupons (merchant_id,kind,value,title,terms,min_order,per_user,qty,hours,start,"end",points,min_level,created,updated)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(mine.id, f.kind, f.value, f.title, f.terms, f.min_order, f.per_user, f.qty, f.hours, f.start, f.end, f.points, f.min_level, now(), now()).run();
    return J({ id: r.meta.last_row_id, status: 'pending' });
  }
  if ((m = p.match(/^\/v1\/merchant\/coupons\/(\d+)$/)) && (M === 'PATCH' || M === 'POST')) {
    const c = await env.DB.prepare('SELECT * FROM coupons WHERE id=? AND merchant_id=?').bind(+m[1], mine.id).first();
    if (!c || c.status === 'hidden') return J({ error: 'not_found' }, 404);
    const b = await request.json().catch(() => ({}));
    if (b.action === 'pause' && c.status === 'active') { await env.DB.prepare("UPDATE coupons SET status='paused',updated=? WHERE id=?").bind(now(), c.id).run(); return J({ status: 'paused' }); }
    if (b.action === 'resume' && c.status === 'paused') { await env.DB.prepare("UPDATE coupons SET status='active',updated=? WHERE id=?").bind(now(), c.id).run(); return J({ status: 'active' }); }
    if (b.action === 'remove') { await env.DB.prepare("UPDATE coupons SET status='hidden',updated=? WHERE id=?").bind(now(), c.id).run(); return J({ status: 'hidden' }); }
    // تعديل كامل → يرجع للمراجعة
    const f = couponFields(b);
    if (f.title.length < 4) return J({ error: 'title_required' }, 400);
    await env.DB.prepare(`UPDATE coupons SET kind=?,value=?,title=?,terms=?,min_order=?,per_user=?,qty=?,hours=?,start=?,"end"=?,points=?,min_level=?,status='pending',note='',updated=? WHERE id=?`)
      .bind(f.kind, f.value, f.title, f.terms, f.min_order, f.per_user, f.qty, f.hours, f.start, f.end, f.points, f.min_level, now(), c.id).run();
    return J({ status: 'pending' });
  }
  /* الكاشير يدخل الرمز */
  if (p === '/v1/merchant/redeem' && M === 'POST') {
    if (mine.status !== 'approved') return J({ error: 'merchant_not_active' }, 403);
    const b = await request.json().catch(() => ({}));
    const code = String(b.code || '').replace(/\D/g, '');
    if (code.length !== 4) return J({ error: 'bad_code' }, 400);
    // حد للمحاولات: 20 محاولة خاطئة بالدقيقة
    const k = `redeem_try:${mine.id}:${Math.floor(now() / 60)}`;
    const tries = await env.DB.prepare('SELECT v FROM kv WHERE k=?').bind(k).first();
    if (tries && +tries.v >= 20) return J({ error: 'rate_limited' }, 429);
    const t = now(), slot = Math.floor(t / SLOT);
    const { results } = await env.DB.prepare(`SELECT s.user_id, c.* FROM coupon_saves s JOIN coupons c ON c.id=s.coupon_id
      WHERE c.merchant_id=? AND c.status='active' AND s.opened>? LIMIT 500`).bind(mine.id, t - 900).all();
    for (const r of results) {
      for (const sl of [slot, slot - 1]) {
        if ((await codeFor(env, r.id, r.user_id, sl)) !== code) continue;
        if (r.qty && r.used >= r.qty) return J({ error: 'sold_out' }, 409);
        if (r.per_user) {
          const u = await env.DB.prepare('SELECT 1 FROM redemptions WHERE user_id=? AND coupon_id=?').bind(r.user_id, r.id).first();
          if (u) return J({ error: 'already_used' }, 409);
        }
        if (r.points || r.min_level) {
          const cu = await env.DB.prepare('SELECT points, spent FROM users WHERE id=?').bind(r.user_id).first();
          if (!cu || (r.min_level && levelOf(cu.points) < r.min_level)) return J({ error: 'customer_level' }, 409);
          if (r.points) {
            const d = await env.DB.prepare('UPDATE users SET spent=spent+?1 WHERE id=?2 AND points-spent>=?1').bind(r.points, r.user_id).run();
            if (!d.meta.changes) return J({ error: 'customer_points' }, 409);
          }
        }
        await env.DB.batch([
          env.DB.prepare('INSERT INTO redemptions (coupon_id,merchant_id,user_id,created) VALUES (?,?,?,?)').bind(r.id, mine.id, r.user_id, t),
          env.DB.prepare('UPDATE coupons SET used=used+1 WHERE id=?').bind(r.id),
          env.DB.prepare('UPDATE coupon_saves SET opened=NULL WHERE user_id=? AND coupon_id=?').bind(r.user_id, r.id),
          notify(env, r.user_id, `تم استخدام كوبون «${r.title}» في ${mine.name}${r.points ? ` وانخصم ${r.points} نقطة` : ''}. بالعافية!`),
        ]);
        return J({ ok: true, coupon: { id: r.id, title: r.title, off: offText(r) } });
      }
    }
    await env.DB.prepare("INSERT INTO kv (k,v) VALUES (?,'1') ON CONFLICT(k) DO UPDATE SET v=CAST(v AS INTEGER)+1").bind(k).run();
    return J({ error: 'wrong_code' }, 404);
  }
  return J({ error: 'not_found' }, 404);
}

/* ═════════ مسارات الإدارة (/admin/merchants و /admin/coupons) ═════════ */
export async function merchantAdmin(p, request, env, J, q) {
  const M = request.method;
  let m;
  if (p === '/admin/merchants' && M === 'GET') {
    const st = q.get('status') || 'pending';
    const { results } = await env.DB.prepare(`SELECT m.*, u.name u_name, u.email u_email,
        (SELECT COUNT(*) FROM coupons c WHERE c.merchant_id=m.id AND c.status!='hidden') n_coupons,
        (SELECT COUNT(*) FROM redemptions r WHERE r.merchant_id=m.id) n_used,
        (SELECT title FROM places WHERE id=m.place_id) place_title
      FROM merchants m LEFT JOIN users u ON u.id=m.user_id ${st === 'all' ? '' : 'WHERE m.status=?'} ORDER BY m.updated DESC LIMIT 200`).bind(...(st === 'all' ? [] : [st])).all();
    return J({ merchants: results.map((r) => ({ ...merchantOut(r), owner: r.u_name || '', ownerEmail: r.u_email || '', coupons: r.n_coupons, used: r.n_used, placeTitle: r.place_title || '' })) });
  }
  if ((m = p.match(/^\/admin\/merchants\/(\d+)$/)) && M === 'POST') {
    const r = await env.DB.prepare('SELECT * FROM merchants WHERE id=?').bind(+m[1]).first();
    if (!r) return J({ error: 'not_found' }, 404);
    const b = await request.json().catch(() => ({}));
    const status = ['pending', 'approved', 'rejected', 'hidden'].includes(b.status) ? b.status : r.status;
    const verified = b.verified == null ? r.verified : b.verified ? 1 : 0;
    const maxc = b.maxCoupons == null ? r.max_coupons : Math.max(0, Math.min(20, +b.maxCoupons || 0));
    const place = b.placeId === undefined ? r.place_id : num(b.placeId);
    const note = b.note === undefined ? r.note : str(b.note, 300);
    const lat = b.lat === undefined ? r.lat : num(b.lat), lng = b.lng === undefined ? r.lng : num(b.lng);
    await env.DB.prepare('UPDATE merchants SET status=?,verified=?,max_coupons=?,place_id=?,note=?,lat=?,lng=?,updated=? WHERE id=?')
      .bind(status, verified, maxc, place, note, lat, lng, now(), r.id).run();
    if (status !== r.status && (status === 'approved' || status === 'rejected')) {
      await notify(env, r.user_id, status === 'approved' ? `تمت الموافقة على «${r.name}» في دليل السعودية للأعمال. أضف كوبونك الأول!` : `ما قدرنا نعتمد «${r.name}»${note ? ': ' + note : ''}. تقدر تعدّل الطلب وترسله مرة ثانية.`).run();
    }
    return J({ ok: true });
  }
  if (p === '/admin/coupons' && M === 'GET') {
    const st = q.get('status') || 'pending';
    const { results } = await env.DB.prepare(`SELECT c.*, m.name m_name, m.city m_city, m.status m_status, m.user_id m_user
      FROM coupons c JOIN merchants m ON m.id=c.merchant_id ${st === 'all' ? "WHERE c.status!='hidden'" : 'WHERE c.status=?'} ORDER BY c.updated DESC LIMIT 200`).bind(...(st === 'all' ? [] : [st])).all();
    return J({ coupons: results.map((c) => couponOut(c, { merchant: { id: c.merchant_id, name: c.m_name, city: c.m_city, status: c.m_status } })) });
  }
  if ((m = p.match(/^\/admin\/coupons\/(\d+)$/)) && M === 'POST') {
    const c = await env.DB.prepare('SELECT c.*, m.user_id m_user, m.status m_status FROM coupons c JOIN merchants m ON m.id=c.merchant_id WHERE c.id=?').bind(+m[1]).first();
    if (!c) return J({ error: 'not_found' }, 404);
    const b = await request.json().catch(() => ({}));
    const status = ['pending', 'active', 'paused', 'rejected', 'hidden'].includes(b.status) ? b.status : c.status;
    const note = b.note === undefined ? c.note : str(b.note, 300);
    await env.DB.prepare('UPDATE coupons SET status=?,note=?,updated=? WHERE id=?').bind(status, note, now(), c.id).run();
    if (status !== c.status && (status === 'active' || status === 'rejected') && c.status === 'pending') {
      await notify(env, c.m_user, status === 'active' ? `كوبون «${c.title}» صار فعّال ويظهر للزوار${c.m_status !== 'approved' ? ' بعد اعتماد نشاطك' : ''}.` : `كوبون «${c.title}» يحتاج تعديل${note ? ': ' + note : ''}.`).run();
    }
    return J({ ok: true });
  }
  return null;
}
