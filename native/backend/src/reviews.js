/* تقييمات الأماكن وصور الزوار
   - تقييم واحد لكل مستخدم لكل مكان (يقدر يعدّله)، نجوم 1–5 + وسوم + نص اختياري
   - الصور ما تظهر لين يوافق عليها المشرف من اللوحة (حقوق الصور وجودتها)
   - النقاط: أول تقييم للمكان +3، وكل صورة تنقبل +5
   - 3 بلاغات على تقييم → يختفي لين تراجعه الإدارة. ما نحذف شي */

import { sessionUser } from './auth.js';
import { moderateReview } from './moderation.js';
import { getFeatures } from './contrib.js';

const now = () => Math.floor(Date.now() / 1000);
const parse = (s, d = []) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
export const TAGS = ['مناسب للعائلة', 'منظّم', 'يستاهل الزيارة', 'تصوير حلو', 'أسعار معقولة', 'خدمة ممتازة', 'هادئ', 'زحمة', 'مواقف صعبة', 'غالي'];
const HIDE_AT = 3, DAILY = 30;

const addPoints = (env, uid, n) => env.DB.prepare('UPDATE users SET points=MAX(0,points+?) WHERE id=?').bind(n, uid);
const notify = (env, userId, text) =>
  env.DB.prepare("INSERT INTO notifications (user_id,type,text,created) VALUES (?,'system',?,?)").bind(userId, String(text).slice(0, 140), now());

const reviewOut = (r, uid) => ({
  id: r.id, stars: r.stars, tags: parse(r.tags), text: r.text || '', created: r.created, updated: r.updated,
  author: { id: r.user_id, name: r.u_name || 'مستخدم الدليل', city: r.u_city || '' }, mine: !!uid && uid === r.user_id,
  photos: r.photos ? String(r.photos).split('|').filter(Boolean) : [],
});

export async function reviewsRoute(p, request, env, J, q) {
  const M = request.method;
  let m;
  if ((m = p.match(/^\/v1\/places\/(\d+)\/reviews$/))) {
    const me = await sessionUser(env, request);
    const uid = me ? me.id : '';
    const pid = +m[1];
    if (M === 'GET') {
      const agg = await env.DB.prepare("SELECT COUNT(*) n, AVG(stars) a FROM reviews WHERE place_id=? AND status='visible'").bind(pid).first();
      const dist = await env.DB.prepare("SELECT stars, COUNT(*) n FROM reviews WHERE place_id=? AND status='visible' GROUP BY stars").bind(pid).all();
      const args = [pid];
      let sql = `SELECT r.*, u.name u_name, u.city u_city,
          (SELECT GROUP_CONCAT(url,'|') FROM place_photos ph WHERE ph.review_id=r.id AND ph.status='approved') photos
        FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.place_id=? AND r.status='visible' AND u.deleted=0`;
      if (uid) { sql += ' AND r.user_id NOT IN (SELECT blocked_id FROM blocks WHERE user_id=?)'; args.push(uid); }
      const { results } = await env.DB.prepare(sql + ' ORDER BY (LENGTH(COALESCE(r.text,""))>20) DESC, r.updated DESC LIMIT 30').bind(...args).all();
      // «تأثيرك»: نحسب مشاهدة لأول 4 تقييمات وأول 10 صور تطلع للزائر
      if (results.length) await env.DB.prepare(`UPDATE reviews SET views=views+1 WHERE id IN (${results.slice(0, 4).map((r) => +r.id).join(',')}) AND user_id<>?`).bind(uid).run().catch(() => {});
      const tags = {};
      for (const r of results) for (const t of parse(r.tags)) tags[t] = (tags[t] || 0) + 1;
      const photos = await env.DB.prepare(`SELECT ph.id, ph.url, u.name FROM place_photos ph JOIN users u ON u.id=ph.user_id
        WHERE ph.place_id=? AND ph.status='approved' AND u.deleted=0 ORDER BY ph.id DESC LIMIT 30`).bind(pid).all();
      if (photos.results.length) await env.DB.prepare(`UPDATE place_photos SET views=views+1 WHERE id IN (${photos.results.slice(0, 10).map((x) => +x.id).join(',')})`).run().catch(() => {});
      const mine = uid ? await env.DB.prepare('SELECT r.*, ? u_name FROM reviews r WHERE user_id=? AND place_id=?').bind(me.name || '', uid, pid).first() : null;
      const pending = uid ? await env.DB.prepare("SELECT COUNT(*) n FROM place_photos WHERE user_id=? AND place_id=? AND status='pending'").bind(uid, pid).first() : { n: 0 };
      return J({
        count: agg.n, avg: agg.a ? Math.round(agg.a * 10) / 10 : null,
        dist: Object.fromEntries(dist.results.map((d) => [d.stars, d.n])),
        tags: Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => ({ t, n })),
        reviews: results.map((r) => reviewOut(r, uid)),
        photos: photos.results.map((x) => ({ id: x.id, url: x.url, name: x.name || 'مستخدم الدليل' })),
        mine: mine ? { ...reviewOut(mine, uid), status: mine.status } : null, myPending: pending.n,
      });
    }
    if (M === 'POST') {
      if (!me) return J({ error: 'login_required' }, 401);
      const place = await env.DB.prepare('SELECT id, title FROM places WHERE id=? AND deleted=0').bind(pid).first();
      if (!place) return J({ error: 'not_found' }, 404);
      const b = await request.json().catch(() => ({}));
      const stars = Math.round(+b.stars);
      if (!(stars >= 1 && stars <= 5)) return J({ error: 'bad_stars' }, 400);
      const tags = (Array.isArray(b.tags) ? b.tags : []).filter((t) => TAGS.includes(t)).slice(0, 6);
      const text = String(b.text || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1200);
      const photos = (Array.isArray(b.photos) ? b.photos : []).map((x) => String(x).slice(0, 300)).filter((x) => x.includes('/media/c/' + me.id + '/')).slice(0, 6);
      if (photos.length && !b.consent) return J({ error: 'consent_required' }, 400);
      // نص التقييم: الرأي السلبي مسموح، بس بدون أرقام أو روابط أو إعلانات أو كلام مسيء
      const n = await env.DB.prepare('SELECT COUNT(*) n FROM reviews WHERE user_id=? AND updated>?').bind(me.id, now() - 86400).first();
      if (n.n >= DAILY) return J({ error: 'rate_limited' }, 429);
      // مراجعة النص: الفلتر المجاني ثم Claude (نفس مفتاح «المراجعة الذكية» في الميزات)
      const mod = text ? await moderateReview(env, text, { place: place.title, stars }, (await getFeatures(env)).ai_moderation) : { status: 'visible' };
      if (mod.status === 'rejected') return J({ id: null, status: 'rejected', message: mod.reason || 'ما قدرنا ننشر التقييم لأنه يخالف قواعد المجتمع.' });
      // غير متأكد → نحفظه مخفي لين تراجعه الإدارة (يطلع في اللوحة: التقييمات ← المخفية)
      const vis = mod.status === 'pending' ? 'hidden' : 'visible';
      const old = await env.DB.prepare('SELECT * FROM reviews WHERE user_id=? AND place_id=?').bind(me.id, pid).first();
      let id;
      if (old) {
        if (old.status === 'hidden' && old.reports >= HIDE_AT) return J({ error: 'under_review' }, 403);
        await env.DB.prepare('UPDATE reviews SET stars=?,tags=?,text=?,status=?,updated=? WHERE id=?').bind(stars, JSON.stringify(tags), text, vis, now(), old.id).run();
        id = old.id;
      } else {
        const r = await env.DB.prepare('INSERT INTO reviews (user_id,place_id,stars,tags,text,status,created,updated) VALUES (?,?,?,?,?,?,?,?)').bind(me.id, pid, stars, JSON.stringify(tags), text, vis, now(), now()).run();
        id = r.meta.last_row_id;
        await addPoints(env, me.id, 3).run();
      }
      if (photos.length) {
        const have = await env.DB.prepare('SELECT url FROM place_photos WHERE review_id=?').bind(id).all();
        const seen = new Set(have.results.map((x) => x.url));
        const add = photos.filter((u) => !seen.has(u));
        if (add.length) await env.DB.batch(add.map((u) => env.DB.prepare('INSERT INTO place_photos (user_id,place_id,review_id,url,created) VALUES (?,?,?,?,?)').bind(me.id, pid, id, u, now())));
      }
      return J({ id, points: old ? 0 : 3, photosPending: photos.length, ...(vis === 'hidden' ? { pending: true, message: 'وصل تقييمك، وبيظهر بعد مراجعة سريعة من فريق الدليل.' } : {}) });
    }
    if (M === 'DELETE') {
      if (!me) return J({ error: 'login_required' }, 401);
      await env.DB.prepare("UPDATE reviews SET status='hidden',updated=? WHERE user_id=? AND place_id=?").bind(now(), me.id, pid).run();
      return J({ ok: true });
    }
  }
  /* بلاغ على تقييم أو صورة */
  if ((m = p.match(/^\/v1\/(reviews|photos)\/(\d+)\/report$/)) && M === 'POST') {
    const me = await sessionUser(env, request);
    if (!me) return J({ error: 'login_required' }, 401);
    const t = m[1] === 'reviews' ? 'r' : 'ph', id = +m[2];
    const b = await request.json().catch(() => ({}));
    const ins = await env.DB.prepare('INSERT OR IGNORE INTO reports (user_id,target,target_id,reason,created) VALUES (?,?,?,?,?)').bind(me.id, t, id, String(b.reason || '').slice(0, 200), now()).run();
    if (ins.meta.changes) {
      if (t === 'r') await env.DB.prepare("UPDATE reviews SET reports=reports+1, status=CASE WHEN reports+1>=? THEN 'hidden' ELSE status END WHERE id=?").bind(HIDE_AT, id).run();
      else await env.DB.prepare("UPDATE place_photos SET reports=reports+1, status=CASE WHEN reports+1>=? AND status='approved' THEN 'pending' ELSE status END WHERE id=?").bind(2, id).run();
    }
    return J({ ok: true });
  }
  return null;
}

/* ═════════ الإدارة ═════════ */
export async function reviewsAdmin(p, request, env, J, q) {
  const M = request.method;
  let m;
  if (p === '/admin/photos' && M === 'GET') {
    const st = ['pending', 'approved', 'rejected'].includes(q.get('status')) ? q.get('status') : 'pending';
    const { results } = await env.DB.prepare(`SELECT ph.*, u.name u_name, pl.title p_title, pl.city p_city, r.stars r_stars, r.text r_text
      FROM place_photos ph JOIN users u ON u.id=ph.user_id LEFT JOIN places pl ON pl.id=ph.place_id LEFT JOIN reviews r ON r.id=ph.review_id
      WHERE ph.status=? ORDER BY ph.reports DESC, ph.id ${st === 'pending' ? 'ASC' : 'DESC'} LIMIT 120`).bind(st).all();
    return J({ photos: results.map((x) => ({ id: x.id, url: x.url, status: x.status, reports: x.reports, created: x.created, user: { id: x.user_id, name: x.u_name || 'مستخدم الدليل' }, place: { id: x.place_id, title: x.p_title || '', city: x.p_city || '' }, review: x.review_id ? { stars: x.r_stars, text: x.r_text || '' } : null })) });
  }
  if (p === '/admin/photos/bulk' && M === 'POST') {
    const b = await request.json().catch(() => ({}));
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Boolean).slice(0, 200);
    const st = b.status === 'approved' ? 'approved' : b.status === 'rejected' ? 'rejected' : null;
    if (!st || !ids.length) return J({ error: 'bad_request' }, 400);
    let n = 0;
    for (const id of ids) n += await setPhoto(env, id, st, b.note);
    return J({ ok: true, changed: n });
  }
  if ((m = p.match(/^\/admin\/photos\/(\d+)$/)) && M === 'POST') {
    const b = await request.json().catch(() => ({}));
    const st = ['approved', 'rejected', 'pending'].includes(b.status) ? b.status : null;
    if (!st) return J({ error: 'bad_status' }, 400);
    await setPhoto(env, +m[1], st, b.note);
    return J({ ok: true });
  }
  if (p === '/admin/reviews' && M === 'GET') {
    const st = q.get('status') === 'hidden' ? "r.status='hidden'" : q.get('status') === 'reported' ? 'r.reports>0' : "r.status='visible'";
    const { results } = await env.DB.prepare(`SELECT r.*, u.name u_name, pl.title p_title, pl.city p_city FROM reviews r JOIN users u ON u.id=r.user_id LEFT JOIN places pl ON pl.id=r.place_id
      WHERE ${st} ORDER BY r.updated DESC LIMIT 150`).all();
    return J({ reviews: results.map((r) => ({ id: r.id, stars: r.stars, tags: parse(r.tags), text: r.text || '', status: r.status, reports: r.reports, updated: r.updated, user: { id: r.user_id, name: r.u_name || 'مستخدم الدليل' }, place: { id: r.place_id, title: r.p_title || '', city: r.p_city || '' } })) });
  }
  if ((m = p.match(/^\/admin\/reviews\/(\d+)$/)) && M === 'POST') {
    const b = await request.json().catch(() => ({}));
    const st = b.status === 'hidden' ? 'hidden' : 'visible';
    await env.DB.prepare(`UPDATE reviews SET status=?${st === 'visible' ? ', reports=0' : ''} WHERE id=?`).bind(st, +m[1]).run();
    return J({ ok: true });
  }
  return null;
}

async function setPhoto(env, id, st, note) {
  const ph = await env.DB.prepare('SELECT ph.*, pl.title p_title FROM place_photos ph LEFT JOIN places pl ON pl.id=ph.place_id WHERE ph.id=?').bind(id).first();
  if (!ph || ph.status === st) return 0;
  const ops = [env.DB.prepare(`UPDATE place_photos SET status=?${st === 'approved' ? ', reports=0' : ''} WHERE id=?`).bind(st, id)];
  // النقاط مرة وحدة: أول ما تنقبل الصورة
  const paid = await env.DB.prepare("SELECT 1 FROM kv WHERE k=?").bind(`photo_paid:${id}`).first();
  if (st === 'approved' && !paid) {
    ops.push(addPoints(env, ph.user_id, 5), env.DB.prepare("INSERT OR IGNORE INTO kv (k,v) VALUES (?,'1')").bind(`photo_paid:${id}`));
    ops.push(notify(env, ph.user_id, `انقبلت صورتك لـ«${ph.p_title || 'المكان'}» وصارت تظهر للزوار. +5 نقاط`));
  } else if (st === 'rejected' && ph.status === 'pending') {
    ops.push(notify(env, ph.user_id, `ما قدرنا ننشر صورتك لـ«${ph.p_title || 'المكان'}»${note ? ': ' + String(note).slice(0, 80) : ''}.`));
  }
  await env.DB.batch(ops);
  return 1;
}
