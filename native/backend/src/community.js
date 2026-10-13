/* المجتمع: أسئلة ونصائح وصور، إجابات، شكر، أفضل إجابة، إبلاغ وحظر.
   قواعد:
   - ما نحذف شي من القاعدة: الحذف = إخفاء (status='hidden')
   - 3 بلاغات من 3 أشخاص مختلفين → يختفي تلقائياً لين تراجعه الإدارة
   - المستخدم يقدر يحظر مستخدم ثاني فما يشوف مشاركاته (شرط آبل للمحتوى من المستخدمين)
   - النقاط: سؤال +2، إجابة +5، أفضل إجابة +15، شكر +1 */

import { sessionUser } from './auth.js';
import { CITIES } from './normalize.js';

const now = () => Math.floor(Date.now() / 1000);
const KINDS = ['question', 'tip', 'photo'];
const HIDE_AT = 3;
const DAILY_POSTS = 15, DAILY_ANSWERS = 60;

const clean = (s, max) => String(s || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const cityOk = (c) => !c || CITIES.some((x) => x[0] === c);

function badgeOf(role, points) {
  if (role === 'admin') return 'فريق الدليل';
  if (role === 'guide') return 'مرشد موثّق';
  if (points >= 500) return 'خبير المدينة';
  if (points >= 150) return 'دليل نشيط';
  return '';
}
const author = (r) => ({ id: r.user_id, name: r.u_name || 'مستخدم الدليل', city: r.u_city || '', badge: badgeOf(r.u_role, r.u_points || 0), points: r.u_points || 0 });

function postRow(r, me) {
  return {
    id: r.id, kind: r.kind, city: r.city || '', placeId: r.place_id || null, text: r.text, photo: r.photo || '',
    answers: r.answers, thanks: r.thanks, best: r.best_answer || null, created: r.created,
    author: author(r), mine: !!me && me.id === r.user_id, thanked: !!r.my_thanks,
    bestAnswer: r.b_text ? { text: r.b_text, name: r.b_name || 'مستخدم الدليل', badge: badgeOf(r.b_role, r.b_points || 0) } : null,
  };
}
function answerRow(r, me) {
  return { id: r.id, text: r.text, thanks: r.thanks, created: r.created, author: author(r), mine: !!me && me.id === r.user_id, thanked: !!r.my_thanks };
}

const recount = (env, postId) => env.DB.prepare("UPDATE posts SET answers=(SELECT COUNT(*) FROM answers WHERE post_id=?1 AND status='visible') WHERE id=?1").bind(postId);
const addPoints = (env, uid, n) => env.DB.prepare('UPDATE users SET points=MAX(0,points+?) WHERE id=?').bind(n, uid);

export async function communityRoute(p, request, env, J, q) {
  const M = request.method;
  const me = await sessionUser(env, request);
  const uid = me ? me.id : '';
  const need = () => (me ? null : J({ error: 'login_required' }, 401));
  let m;

  /* ——— الصور (R2) ——— */
  if (p === '/v1/community/upload' && M === 'POST') {
    if (need()) return need();
    if (!env.MEDIA) return J({ error: 'media_not_configured' }, 503);
    const type = request.headers.get('Content-Type') || '';
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' }[type];
    if (!ext) return J({ error: 'bad_type' }, 400);
    const buf = await request.arrayBuffer();
    if (buf.byteLength < 1000 || buf.byteLength > 6 * 1024 * 1024) return J({ error: 'bad_size' }, 400);
    const key = `c/${uid}/${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, buf, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
    return J({ url: `${new URL(request.url).origin}/media/${key}` });
  }

  /* ——— القائمة ——— */
  if (p === '/v1/community' && M === 'GET') {
    const args = [uid];
    let sql = `SELECT p.*, u.name u_name, u.city u_city, u.role u_role, u.points u_points,
        (SELECT 1 FROM thanks t WHERE t.user_id=? AND t.target='p' AND t.target_id=p.id) my_thanks,
        a.text b_text, bu.name b_name, bu.role b_role, bu.points b_points
      FROM posts p JOIN users u ON u.id=p.user_id
      LEFT JOIN answers a ON a.id=p.best_answer AND a.status='visible'
      LEFT JOIN users bu ON bu.id=a.user_id
      WHERE p.status='visible' AND u.deleted=0`;
    if (uid) { sql += ' AND p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE user_id=?)'; args.push(uid); }
    const city = q.get('city'), kind = q.get('kind'), before = +q.get('before') || 0, mine = q.get('mine');
    if (city) { sql += ' AND p.city=?'; args.push(city); }
    if (KINDS.includes(kind)) { sql += ' AND p.kind=?'; args.push(kind); }
    if (mine && uid) { sql += ' AND p.user_id=?'; args.push(uid); }
    if (before) { sql += ' AND p.id<?'; args.push(before); }
    const { results } = await env.DB.prepare(sql + ' ORDER BY p.id DESC LIMIT 20').bind(...args).all();
    return J({ posts: results.map((r) => postRow(r, me)) });
  }

  /* ——— أبطال المدينة: أكثر نقاط من إجابات الشهر ——— */
  if (p === '/v1/community/top' && M === 'GET') {
    const since = now() - 30 * 86400, city = q.get('city');
    const args = [since];
    let sql = `SELECT u.id, u.name, u.role, u.points, COUNT(a.id) n FROM answers a JOIN users u ON u.id=a.user_id JOIN posts p ON p.id=a.post_id
      WHERE a.status='visible' AND u.deleted=0 AND a.created>?`;
    if (city) { sql += ' AND p.city=?'; args.push(city); }
    const { results } = await env.DB.prepare(sql + ' GROUP BY u.id ORDER BY n DESC, u.points DESC LIMIT 3').bind(...args).all();
    return J({ top: results.map((r) => ({ id: r.id, name: r.name || 'مستخدم الدليل', answers: r.n, badge: badgeOf(r.role, r.points) })) });
  }

  /* ——— نشر ——— */
  if (p === '/v1/community' && M === 'POST') {
    if (need()) return need();
    const b = await request.json().catch(() => ({}));
    const kind = KINDS.includes(b.kind) ? b.kind : 'question';
    const text = clean(b.text, 1500), photo = String(b.photo || '').slice(0, 300);
    if (text.length < 8) return J({ error: 'too_short' }, 400);
    if (!cityOk(b.city)) return J({ error: 'bad_city' }, 400);
    if (photo && !photo.includes('/media/c/')) return J({ error: 'bad_photo' }, 400);
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM posts WHERE user_id=? AND created>?').bind(uid, now() - 86400).first();
    if (n.n >= DAILY_POSTS) return J({ error: 'rate_limited' }, 429);
    const r = await env.DB.prepare('INSERT INTO posts (user_id,kind,city,place_id,text,photo,created) VALUES (?,?,?,?,?,?,?)')
      .bind(uid, kind, b.city || null, +b.placeId || null, text, photo || null, now()).run();
    await addPoints(env, uid, 2).run();
    return J({ id: r.meta.last_row_id });
  }

  /* ——— سؤال واحد مع إجاباته ——— */
  if ((m = p.match(/^\/v1\/community\/(\d+)$/)) && M === 'GET') {
    const r = await env.DB.prepare(`SELECT p.*, u.name u_name, u.city u_city, u.role u_role, u.points u_points,
        (SELECT 1 FROM thanks t WHERE t.user_id=? AND t.target='p' AND t.target_id=p.id) my_thanks
      FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=? AND p.status='visible'`).bind(uid, +m[1]).first();
    if (!r) return J({ error: 'not_found' }, 404);
    const args = [uid, +m[1]];
    let sql = `SELECT a.*, u.name u_name, u.city u_city, u.role u_role, u.points u_points,
        (SELECT 1 FROM thanks t WHERE t.user_id=? AND t.target='a' AND t.target_id=a.id) my_thanks
      FROM answers a JOIN users u ON u.id=a.user_id WHERE a.post_id=? AND a.status='visible' AND u.deleted=0`;
    if (uid) { sql += ' AND a.user_id NOT IN (SELECT blocked_id FROM blocks WHERE user_id=?)'; args.push(uid); }
    const { results } = await env.DB.prepare(sql + ' ORDER BY (a.id=?) DESC, a.thanks DESC, a.id ASC LIMIT 200').bind(...args, r.best_answer || 0).all();
    return J({ post: postRow(r, me), answers: results.map((a) => answerRow(a, me)) });
  }

  /* ——— إخفاء مشاركتي (الحذف = إخفاء) ——— */
  if ((m = p.match(/^\/v1\/community\/(answers\/)?(\d+)$/)) && M === 'DELETE') {
    if (need()) return need();
    const t = m[1] ? 'answers' : 'posts';
    const row = await env.DB.prepare(`SELECT * FROM ${t} WHERE id=? AND user_id=?`).bind(+m[2], uid).first();
    if (!row) return J({ error: 'not_found' }, 404);
    const ops = [env.DB.prepare(`UPDATE ${t} SET status='hidden', hidden_by='owner' WHERE id=?`).bind(row.id)];
    if (t === 'answers') ops.push(env.DB.prepare('UPDATE posts SET best_answer=NULL WHERE id=? AND best_answer=?').bind(row.post_id, row.id), recount(env, row.post_id));
    await env.DB.batch(ops);
    return J({ ok: true });
  }

  /* ——— إجابة ——— */
  if ((m = p.match(/^\/v1\/community\/(\d+)\/answers$/)) && M === 'POST') {
    if (need()) return need();
    const post = await env.DB.prepare("SELECT * FROM posts WHERE id=? AND status='visible'").bind(+m[1]).first();
    if (!post) return J({ error: 'not_found' }, 404);
    const b = await request.json().catch(() => ({}));
    const text = clean(b.text, 1500);
    if (text.length < 2) return J({ error: 'too_short' }, 400);
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM answers WHERE user_id=? AND created>?').bind(uid, now() - 86400).first();
    if (n.n >= DAILY_ANSWERS) return J({ error: 'rate_limited' }, 429);
    const r = await env.DB.prepare('INSERT INTO answers (post_id,user_id,text,created) VALUES (?,?,?,?)').bind(post.id, uid, text, now()).run();
    await env.DB.batch([
      env.DB.prepare('UPDATE posts SET answers=answers+1 WHERE id=?').bind(post.id),
      ...(post.user_id !== uid ? [addPoints(env, uid, 5)] : []),
    ]);
    return J({ id: r.meta.last_row_id });
  }

  /* ——— شكر (يتبدّل: مرة يشكر ومرة يلغي) ——— */
  if ((m = p.match(/^\/v1\/community\/(answers\/)?(\d+)\/thanks$/)) && M === 'POST') {
    if (need()) return need();
    const target = m[1] ? 'a' : 'p', t = m[1] ? 'answers' : 'posts', id = +m[2];
    const row = await env.DB.prepare(`SELECT * FROM ${t} WHERE id=? AND status='visible'`).bind(id).first();
    if (!row) return J({ error: 'not_found' }, 404);
    if (row.user_id === uid) return J({ error: 'own_content' }, 400);
    const had = await env.DB.prepare('SELECT 1 FROM thanks WHERE user_id=? AND target=? AND target_id=?').bind(uid, target, id).first();
    const d = had ? -1 : 1;
    await env.DB.batch([
      had ? env.DB.prepare('DELETE FROM thanks WHERE user_id=? AND target=? AND target_id=?').bind(uid, target, id)
          : env.DB.prepare('INSERT INTO thanks (user_id,target,target_id,created) VALUES (?,?,?,?)').bind(uid, target, id, now()),
      env.DB.prepare(`UPDATE ${t} SET thanks=MAX(0,thanks+?) WHERE id=?`).bind(d, id),
      addPoints(env, row.user_id, d),
    ]);
    return J({ thanked: !had, thanks: Math.max(0, row.thanks + d) });
  }

  /* ——— أفضل إجابة (صاحب السؤال فقط) ——— */
  if ((m = p.match(/^\/v1\/community\/(\d+)\/best$/)) && M === 'POST') {
    if (need()) return need();
    const post = await env.DB.prepare("SELECT * FROM posts WHERE id=? AND user_id=? AND status='visible'").bind(+m[1], uid).first();
    if (!post) return J({ error: 'not_found' }, 404);
    const b = await request.json().catch(() => ({}));
    const a = b.answerId ? await env.DB.prepare("SELECT * FROM answers WHERE id=? AND post_id=? AND status='visible'").bind(+b.answerId, post.id).first() : null;
    if (b.answerId && !a) return J({ error: 'not_found' }, 404);
    const ops = [env.DB.prepare('UPDATE posts SET best_answer=? WHERE id=?').bind(a ? a.id : null, post.id)];
    if (post.best_answer) {
      const old = await env.DB.prepare('SELECT user_id FROM answers WHERE id=?').bind(post.best_answer).first();
      if (old && old.user_id !== uid) ops.push(addPoints(env, old.user_id, -15));
    }
    if (a && a.user_id !== uid) ops.push(addPoints(env, a.user_id, 15));
    await env.DB.batch(ops);
    return J({ best: a ? a.id : null });
  }

  /* ——— إبلاغ ——— */
  if (p === '/v1/community/report' && M === 'POST') {
    if (need()) return need();
    const b = await request.json().catch(() => ({}));
    const target = b.target === 'a' ? 'a' : 'p', t = target === 'a' ? 'answers' : 'posts', id = +b.id;
    const row = await env.DB.prepare(`SELECT * FROM ${t} WHERE id=?`).bind(id).first();
    if (!row) return J({ error: 'not_found' }, 404);
    const ins = await env.DB.prepare('INSERT OR IGNORE INTO reports (user_id,target,target_id,reason,created) VALUES (?,?,?,?,?)')
      .bind(uid, target, id, clean(b.reason, 200) || 'other', now()).run();
    if (ins.meta.changes) {
      await env.DB.prepare(`UPDATE ${t} SET reports=reports+1, status=CASE WHEN reports+1>=? AND status='visible' THEN 'hidden' ELSE status END, hidden_by=CASE WHEN reports+1>=? AND status='visible' THEN 'reports' ELSE hidden_by END WHERE id=?`)
        .bind(HIDE_AT, HIDE_AT, id).run();
      if (target === 'a') await recount(env, row.post_id).run();
    }
    return J({ ok: true });
  }

  /* ——— حظر مستخدم ——— */
  if (p === '/v1/community/block' && (M === 'POST' || M === 'DELETE')) {
    if (need()) return need();
    const b = await request.json().catch(() => ({}));
    const other = String(b.userId || '');
    if (!other || other === uid) return J({ error: 'bad_user' }, 400);
    await (M === 'POST'
      ? env.DB.prepare('INSERT OR IGNORE INTO blocks (user_id,blocked_id,created) VALUES (?,?,?)').bind(uid, other, now())
      : env.DB.prepare('DELETE FROM blocks WHERE user_id=? AND blocked_id=?').bind(uid, other)).run();
    return J({ ok: true });
  }

  return null;
}

/* ——— الإدارة: مراجعة البلاغات وإظهار/إخفاء ——— */
export async function communityAdmin(p, request, env, J) {
  if (p === '/admin/community/reported') {
    const posts = await env.DB.prepare("SELECT id,user_id,text,status,reports,hidden_by,created FROM posts WHERE reports>0 ORDER BY reports DESC, id DESC LIMIT 100").all();
    const answers = await env.DB.prepare("SELECT id,post_id,user_id,text,status,reports,hidden_by,created FROM answers WHERE reports>0 ORDER BY reports DESC, id DESC LIMIT 100").all();
    return J({ posts: posts.results, answers: answers.results });
  }
  if (p === '/admin/community/moderate' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const t = b.target === 'a' ? 'answers' : 'posts';
    await env.DB.prepare(`UPDATE ${t} SET status=?, hidden_by=? WHERE id=?`).bind(b.hidden ? 'hidden' : 'visible', b.hidden ? 'admin' : null, +b.id).run();
    if (t === 'answers') { const a = await env.DB.prepare('SELECT post_id FROM answers WHERE id=?').bind(+b.id).first(); if (a) await recount(env, a.post_id).run(); }
    return J({ ok: true });
  }
  if (p === '/admin/community/role' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (!['user', 'guide', 'admin'].includes(b.role)) return J({ error: 'bad_role' }, 400);
    await env.DB.prepare('UPDATE users SET role=? WHERE id=?').bind(b.role, String(b.userId)).run();
    return J({ ok: true });
  }
  return null;
}
