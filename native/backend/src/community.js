/* المجتمع: أسئلة ونصائح وصور، إجابات، شكر، أفضل إجابة، إبلاغ وحظر.
   قواعد:
   - ما نحذف شي من القاعدة: الحذف = إخفاء (status='hidden')
   - 3 بلاغات من 3 أشخاص مختلفين → يختفي تلقائياً لين تراجعه الإدارة
   - المستخدم يقدر يحظر مستخدم ثاني فما يشوف مشاركاته (شرط آبل للمحتوى من المستخدمين)
   - النقاط: سؤال +2، إجابة +5، أفضل إجابة +15، شكر +1 */

import { sessionUser } from './auth.js';
import { CITIES, km } from './normalize.js';
import { impactOf, getFeatures } from './contrib.js';
import { moderate, modMessage } from './moderation.js';

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
    // صاحب المشاركة يشوف حالتها لو ما انتشرت (تنتظر المراجعة أو انرفضت) — غيره ما يوصلها أصلاً
    ...(r.status && r.status !== 'visible' && me && me.id === r.user_id ? { status: r.status, modReason: r.mod_reason || '' } : {}),
  };
}
function answerRow(r, me) {
  return { id: r.id, text: r.text, thanks: r.thanks, created: r.created, author: author(r), mine: !!me && me.id === r.user_id, thanked: !!r.my_thanks };
}

const recount = (env, postId) => env.DB.prepare("UPDATE posts SET answers=(SELECT COUNT(*) FROM answers WHERE post_id=?1 AND status='visible') WHERE id=?1").bind(postId);
/** إشعار داخل التطبيق (ما نشعر الشخص بفعله هو) */
const notify = (env, userId, type, actorId, postId, text) =>
  userId && userId !== actorId ? env.DB.prepare('INSERT INTO notifications (user_id,type,actor_id,post_id,text,created) VALUES (?,?,?,?,?,?)').bind(userId, type, actorId || null, postId || null, String(text || '').slice(0, 140), now()) : null;
const addPoints = (env, uid, n) => env.DB.prepare('UPDATE users SET points=MAX(0,points+?) WHERE id=?').bind(n, uid);

/* ——— قواعد المجتمع والتنبيهات: تذكير أول، تنبيه ثاني، وبعدها إيقاف مؤقت عن المشاركة ———
   نحسب المشاركات اللي ما انتشرت (فلتر أو مراجعة ذكية أو رفض المشرف) خلال آخر 30 يوم */
const RULES_LINE = 'قواعد المجتمع باختصار: أسئلة وإجابات عن المدن والأماكن، بدون أرقام أو روابط أو إعلانات، وبأسلوب محترم مع الكل.';
const dayAr = (t) => new Date(t * 1000).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long' });
async function banState(env, uid) {
  const u = await env.DB.prepare('SELECT community_ban_until b FROM users WHERE id=?').bind(uid).first();
  return u && u.b && u.b > now() ? u.b : 0;
}
function banMessage(until) {
  return `مشاركتك في «اسأل أهل المدينة» موقوفة مؤقتاً لين ${dayAr(until)}، بسبب تكرار مشاركات تخالف قواعد المجتمع. تقدر تتصفح وتستفيد من المجتمع عادي، وترجع تشارك بعدها. ${RULES_LINE}`;
}
/** بعد رفض مشاركة: نحسب المخالفات ونرجع رسالة مناسبة (ونوقف مؤقتاً من الثالثة) */
async function afterReject(env, uid, reason) {
  const since = now() - 30 * 86400;
  const r = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM posts WHERE user_id=?1 AND status='rejected' AND created>?2) + (SELECT COUNT(*) FROM answers WHERE user_id=?1 AND status='rejected' AND created>?2) n`).bind(uid, since).first();
  const n = r?.n || 0;
  const base = reason || 'ما قدرنا ننشر مشاركتك لأنها تخالف قواعد المجتمع.';
  if (n <= 1) return `${base}\n${RULES_LINE}`;
  if (n === 2) return `${base}\nتنبيه ودّي: هذي ثاني مشاركة ما تنتشر خلال شهر. لو تكرر الشي، بنوقف مشاركتك في المجتمع لفترة مؤقتة. ${RULES_LINE}`;
  const days = n >= 5 ? 30 : 7;
  const until = now() + days * 86400;
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET community_ban_until=? WHERE id=?').bind(until, uid),
    env.DB.prepare("INSERT INTO notifications (user_id,type,text,created) VALUES (?,'system',?,?)").bind(uid, `وقفنا مشاركتك في المجتمع مؤقتاً لين ${dayAr(until)} بسبب تكرار المخالفات. نشوفك بعدها!`, now()),
  ]);
  return `${base}\n${banMessage(until)}`;
}

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
  /* المدن ونشاطها: عدد المشاركات آخر 90 يوم وعدد الأسئلة اللي تنتظر رد */
  if (p === '/v1/community/cities' && M === 'GET') {
    const { results } = await env.DB.prepare(`SELECT p.city, COUNT(*) n,
        SUM(CASE WHEN p.kind='question' AND NOT EXISTS (SELECT 1 FROM answers x WHERE x.post_id=p.id AND x.status='visible') THEN 1 ELSE 0 END) open
      FROM posts p WHERE p.status='visible' AND p.city IS NOT NULL AND p.created>? GROUP BY p.city`).bind(now() - 90 * 86400).all();
    return J({ cities: results.map((r) => ({ id: r.city, posts: r.n, open: r.open || 0 })) }, 200, 120);
  }

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
    const city = q.get('city'), kind = q.get('kind'), before = +q.get('before') || 0, mine = q.get('mine'), place = +q.get('place') || 0;
    if (place) { sql += ' AND p.place_id=?'; args.push(place); }
    if (city) { sql += ' AND p.city=?'; args.push(city); }
    if (KINDS.includes(kind)) { sql += ' AND p.kind=?'; args.push(kind); }
    if (mine && uid) { sql += ' AND p.user_id=?'; args.push(uid); }
    // «تحتاج إجابة»: أسئلة ما لها رد للحين (لأهل المدينة اللي يبون يساعدون)
    if (q.get('open') === '1') sql += " AND p.kind='question' AND NOT EXISTS (SELECT 1 FROM answers x WHERE x.post_id=p.id AND x.status='visible')";
    if (before) { sql += ' AND p.id<?'; args.push(before); }
    const { results } = await env.DB.prepare(sql + ' ORDER BY p.id DESC LIMIT 20').bind(...args).all();
    return J({ posts: results.map((r) => postRow(r, me)) });
  }

  /* ——— تحدي الأسبوع (تديره من اللوحة) ——— */
  if (p === '/v1/community/challenge' && M === 'GET') {
    const r = await env.DB.prepare("SELECT v FROM kv WHERE k='challenge'").first();
    let c = null; try { c = r ? JSON.parse(r.v) : null; } catch {}
    if (!c || !c.title || (c.end && c.end < new Date().toISOString())) return J({ challenge: null });
    const n = c.tag ? await env.DB.prepare("SELECT COUNT(*) n FROM posts WHERE status='visible' AND created>? AND text LIKE ?").bind(Math.floor(new Date(c.start || 0).getTime() / 1000), `%${c.tag}%`).first() : { n: 0 };
    return J({ challenge: { ...c, count: n.n } });
  }

  /* ——— ملخص المكان من المجتمع: كم زاره، وآخر نصيحة، وعدد الأسئلة ——— */
  if ((m = p.match(/^\/v1\/community\/place\/(\d+)$/)) && M === 'GET') {
    const id = +m[1];
    const v = await env.DB.prepare('SELECT COUNT(*) n FROM visits WHERE place_id=?').bind(id).first();
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM posts WHERE place_id=? AND status='visible'").bind(id).first();
    const tip = await env.DB.prepare(`SELECT p.id, p.text, u.name, u.role, u.points FROM posts p JOIN users u ON u.id=p.user_id
      WHERE p.place_id=? AND p.kind='tip' AND p.status='visible' AND u.deleted=0 ORDER BY p.thanks DESC, p.id DESC LIMIT 1`).bind(id).first();
    const been = uid ? !!(await env.DB.prepare('SELECT 1 FROM visits WHERE user_id=? AND place_id=?').bind(uid, id).first()) : false;
    return J({ visits: v.n, posts: n.n, been, tip: tip ? { id: tip.id, text: tip.text, name: tip.name || 'مستخدم الدليل', badge: badgeOf(tip.role, tip.points || 0) } : null });
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
    const ban = await banState(env, uid);
    if (ban) return J({ id: null, status: 'rejected', message: banMessage(ban) });
    // اسم المكان يروح لـ Claude عشان سؤال قصير مثل «فيه مواقف؟» يكون مفهوم
    const pl = +b.placeId ? await env.DB.prepare('SELECT title FROM places WHERE id=?').bind(+b.placeId).first() : null;
    const mod = await moderate(env, 'post', text, { city: b.city, place: pl?.title || '' }, (await getFeatures(env)).ai_moderation);
    const r = await env.DB.prepare('INSERT INTO posts (user_id,kind,city,place_id,text,photo,created,status,hidden_by,mod,mod_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(uid, kind, b.city || null, +b.placeId || null, text, photo || null, now(), mod.status, mod.status === 'visible' ? null : 'moderation', mod.by, mod.reason || null).run();
    if (mod.status === 'visible') await addPoints(env, uid, 2).run();
    if (mod.status === 'visible' && kind === 'question') await notifyLocals(env, r.meta.last_row_id).catch(() => {});
    const message = mod.status === 'rejected' ? await afterReject(env, uid, mod.reason) : modMessage(mod.status, mod.reason);
    return J({ id: r.meta.last_row_id, status: mod.status, message });
  }

  /* ——— سؤال واحد مع إجاباته ——— */
  if ((m = p.match(/^\/v1\/community\/(\d+)$/)) && M === 'GET') {
    const r = await env.DB.prepare(`SELECT p.*, u.name u_name, u.city u_city, u.role u_role, u.points u_points,
        (SELECT 1 FROM thanks t WHERE t.user_id=? AND t.target='p' AND t.target_id=p.id) my_thanks
      FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=? AND (p.status='visible' OR (p.user_id=? AND p.status IN ('pending','rejected')))`).bind(uid, +m[1], uid || '-').first();
    if (!r) return J({ error: 'not_found' }, 404);
    if (r.user_id !== uid) await env.DB.prepare('UPDATE posts SET views=views+1 WHERE id=?').bind(r.id).run().catch(() => {});
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
    const ban = await banState(env, uid);
    if (ban) return J({ id: null, status: 'rejected', message: banMessage(ban) });
    const mod = await moderate(env, 'answer', text, { city: post.city, question: post.text }, (await getFeatures(env)).ai_moderation);
    const r = await env.DB.prepare('INSERT INTO answers (post_id,user_id,text,created,status,hidden_by,mod,mod_reason) VALUES (?,?,?,?,?,?,?,?)')
      .bind(post.id, uid, text, now(), mod.status, mod.status === 'visible' ? null : 'moderation', mod.by, mod.reason || null).run();
    if (mod.status === 'visible') {
      await env.DB.batch([
        env.DB.prepare('UPDATE posts SET answers=answers+1 WHERE id=?').bind(post.id),
        ...(post.user_id !== uid ? [addPoints(env, uid, 5)] : []),
        notify(env, post.user_id, 'answer', uid, post.id, text),
      ].filter(Boolean));
    }
    const message = mod.status === 'rejected' ? await afterReject(env, uid, mod.reason) : modMessage(mod.status, mod.reason);
    return J({ id: r.meta.last_row_id, status: mod.status, message });
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
      // نشعر بالشكر مرة وحدة لكل مشاركة في اليوم عشان ما تزحم الإشعارات
      ...(!had && !(await env.DB.prepare("SELECT 1 FROM notifications WHERE user_id=? AND type='thanks' AND post_id=? AND created>?").bind(row.user_id, target === 'a' ? row.post_id : row.id, now() - 86400).first())
        ? [notify(env, row.user_id, 'thanks', uid, target === 'a' ? row.post_id : row.id, row.text)] : []),
    ].filter(Boolean));
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
    if (a && a.user_id !== uid) { ops.push(addPoints(env, a.user_id, 15)); ops.push(notify(env, a.user_id, 'best', uid, post.id, a.text)); }
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

/** حساب «فريق دليل السعودية» الرسمي (شارة «فريق الدليل») — ينشأ أول مرة */
const TEAM_ID = 'dalil-team';
async function teamUser(env) {
  await env.DB.prepare("INSERT OR IGNORE INTO users (id,name,city,bio,role,points,created,seen) VALUES (?, 'فريق دليل السعودية', '', 'الحساب الرسمي لتطبيق دليل السعودية', 'admin', 0, ?, ?)").bind(TEAM_ID, now(), now()).run();
  return TEAM_ID;
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
  /* ——— «اسأل أهل المدينة» من الإدارة: نقرأ سؤال مع إجاباته، ونرد أو ننشر باسم «فريق دليل السعودية» ——— */
  const q = new URL(request.url).searchParams;
  if (p === '/admin/community/list' && request.method === 'GET') {
    const where = ['1=1'], args = [];
    if (q.get('city')) { where.push('p.city=?'); args.push(q.get('city')); }
    if (q.get('kind')) { where.push('p.kind=?'); args.push(q.get('kind')); }
    if (['hidden', 'pending', 'rejected'].includes(q.get('status'))) { where.push('p.status=?'); args.push(q.get('status')); } else if (q.get('status') !== 'all') where.push("p.status='visible'");
    if (q.get('unanswered') === '1' || q.get('unanswered') === 'true') where.push('p.answers=0');
    if (q.get('q')) { where.push('p.text LIKE ?'); args.push(`%${q.get('q')}%`); }
    const { results } = await env.DB.prepare(`SELECT p.id,p.kind,p.city,p.place_id,p.text,p.photo,p.answers,p.thanks,p.best_answer,p.reports,p.status,p.created,u.name,u.role
      FROM posts p JOIN users u ON u.id=p.user_id WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT ?`).bind(...args, Math.min(100, +q.get('limit') || 50)).all();
    return J({ posts: results });
  }
  if (p === '/admin/community/thread' && request.method === 'GET') {
    const post = await env.DB.prepare('SELECT p.*, u.name, u.role FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?').bind(+q.get('id')).first();
    if (!post) return J({ error: 'not_found' }, 404);
    const { results } = await env.DB.prepare('SELECT a.id,a.user_id,a.text,a.thanks,a.reports,a.status,a.created,u.name,u.role FROM answers a JOIN users u ON u.id=a.user_id WHERE a.post_id=? ORDER BY a.id').bind(post.id).all();
    return J({ post, answers: results });
  }
  if ((p === '/admin/community/post' || p === '/admin/community/answer' || p === '/admin/community/best') && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const team = await teamUser(env);
    if (p === '/admin/community/post') {
      const text = clean(b.text, 1500);
      if (text.length < 4) return J({ error: 'too_short' }, 400);
      const kind = ['question', 'tip', 'photo'].includes(b.kind) ? b.kind : 'tip';
      const r = await env.DB.prepare('INSERT INTO posts (user_id,kind,city,place_id,text,photo,created) VALUES (?,?,?,?,?,?,?)')
        .bind(team, kind, clean(b.city, 40) || null, +b.placeId || null, text, clean(b.photo, 300) || null, now()).run();
      return J({ ok: true, id: r.meta.last_row_id });
    }
    const post = await env.DB.prepare("SELECT * FROM posts WHERE id=? AND status='visible'").bind(+b.postId).first();
    if (!post) return J({ error: 'not_found' }, 404);
    if (p === '/admin/community/answer') {
      const text = clean(b.text, 1500);
      if (text.length < 2) return J({ error: 'too_short' }, 400);
      const r = await env.DB.prepare('INSERT INTO answers (post_id,user_id,text,created) VALUES (?,?,?,?)').bind(post.id, team, text, now()).run();
      await env.DB.batch([recount(env, post.id), notify(env, post.user_id, 'answer', team, post.id, text)].filter(Boolean));
      return J({ ok: true, id: r.meta.last_row_id });
    }
    // أفضل إجابة: نفس منطق صاحب السؤال (+15 لصاحب الإجابة، وتنسحب من القديمة)
    const a = b.answerId ? await env.DB.prepare("SELECT * FROM answers WHERE id=? AND post_id=? AND status='visible'").bind(+b.answerId, post.id).first() : null;
    if (b.answerId && !a) return J({ error: 'not_found' }, 404);
    const ops = [env.DB.prepare('UPDATE posts SET best_answer=? WHERE id=?').bind(a ? a.id : null, post.id)];
    if (post.best_answer && post.best_answer !== (a && a.id)) {
      const old = await env.DB.prepare('SELECT user_id FROM answers WHERE id=?').bind(post.best_answer).first();
      if (old && old.user_id !== team) ops.push(addPoints(env, old.user_id, -15));
    }
    if (a && a.id !== post.best_answer && a.user_id !== team) ops.push(addPoints(env, a.user_id, 15), notify(env, a.user_id, 'best', team, post.id, a.text));
    await env.DB.batch(ops.filter(Boolean));
    return J({ ok: true });
  }
  /* ——— طابور المراجعة: اللي حوّلتها المراجعة الذكية لك، واللي رفضتها (تقدر ترجعها) ——— */
  if (p === '/admin/community/pending' && request.method === 'GET') {
    const st = q.get('status') === 'rejected' ? 'rejected' : 'pending';
    const posts = await env.DB.prepare("SELECT p.id,p.kind,p.city,p.text,p.photo,p.mod,p.mod_reason,p.created,u.name,u.id user_id FROM posts p JOIN users u ON u.id=p.user_id WHERE p.status=? ORDER BY p.id DESC LIMIT 100").bind(st).all();
    const answers = await env.DB.prepare("SELECT a.id,a.post_id,a.text,a.mod,a.mod_reason,a.created,u.name,u.id user_id,(SELECT text FROM posts WHERE id=a.post_id) question FROM answers a JOIN users u ON u.id=a.user_id WHERE a.status=? ORDER BY a.id DESC LIMIT 100").bind(st).all();
    return J({ status: st, posts: posts.results, answers: answers.results });
  }
  if (p === '/admin/community/review' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const t = b.target === 'a' ? 'answers' : 'posts';
    const row = await env.DB.prepare(`SELECT * FROM ${t} WHERE id=?`).bind(+b.id).first();
    if (!row || !['pending', 'rejected'].includes(row.status)) return J({ error: 'not_found' }, 404);
    const ok = b.decision === 'approve';
    const ops = [env.DB.prepare(`UPDATE ${t} SET status=?, hidden_by=?, mod=? WHERE id=?`).bind(ok ? 'visible' : 'rejected', ok ? null : 'moderation', ok ? 'admin_ok' : 'admin_no', row.id)];
    if (ok) {
      if (t === 'answers') {
        const post = await env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(row.post_id).first();
        ops.push(recount(env, row.post_id));
        if (post && post.user_id !== row.user_id) ops.push(addPoints(env, row.user_id, 5), notify(env, post.user_id, 'answer', row.user_id, post.id, row.text));
      } else { ops.push(addPoints(env, row.user_id, 2)); if (row.kind === 'question') await notifyLocals(env, row.id).catch(() => {}); }
      ops.push(env.DB.prepare("INSERT INTO notifications (user_id,type,post_id,text,created) VALUES (?,'system',?,?,?)").bind(row.user_id, t === 'answers' ? row.post_id : row.id, 'انتشرت مشاركتك في «اسأل أهل المدينة» بعد المراجعة. شكراً لك!', now()));
    }
    await env.DB.batch(ops.filter(Boolean));
    if (!ok && row.status === 'pending') {
      const note = clean(b.note, 160);
      const msg = await afterReject(env, row.user_id, `ما قدرنا ننشر مشاركتك في «اسأل أهل المدينة»${note ? ': ' + note : ' لأنها تخالف قواعد المجتمع'}.`);
      await env.DB.prepare("INSERT INTO notifications (user_id,type,text,created) VALUES (?,'system',?,?)").bind(row.user_id, msg.replace(/\n/g, ' ').slice(0, 300), now()).run();
    }
    return J({ ok: true, status: ok ? 'visible' : 'rejected' });
  }
  if (p === '/admin/community/mute' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const days = Math.max(0, Math.min(365, Math.round(+b.days || 0)));
    const until = days ? now() + days * 86400 : null;
    await env.DB.prepare('UPDATE users SET community_ban_until=? WHERE id=?').bind(until, String(b.userId)).run();
    if (days) await env.DB.prepare("INSERT INTO notifications (user_id,type,text,created) VALUES (?,'system',?,?)").bind(String(b.userId), `وقفنا مشاركتك في المجتمع مؤقتاً لين ${dayAr(until)}.${b.note ? ' ' + clean(b.note, 140) : ''}`, now()).run();
    return J({ ok: true, until });
  }
  if (p === '/admin/community/role' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (!['user', 'guide', 'admin'].includes(b.role)) return J({ error: 'bad_role' }, 400);
    await env.DB.prepare('UPDATE users SET role=? WHERE id=?').bind(b.role, String(b.userId)).run();
    return J({ ok: true });
  }
  return null;
}

/* ——— ملفي: النقاط والمستوى والأوسمة وآخر نشاط ——— */
export const LEVELS = [
  [0, 'زائر جديد'], [20, 'مستكشف'], [60, 'رحّال'], [150, 'دليل نشيط'], [300, 'ابن الديرة'],
  [500, 'خبير المدينة'], [800, 'مرجع الديرة'], [1200, 'سفير الدليل'], [1800, 'حكيم الدليل'], [2500, 'أسطورة الدليل'],
];
export const GUIDE_AT = 500; // من 500 نقطة يقدر يطلب «مرشد موثّق»

export const BADGES = [
  ['first', 'أول سؤال', 'chat', 'questions', 1],
  ['tips', 'ناصح الديرة', 'star', 'tips', 10],
  ['answers', 'مرجع الديرة', 'chat', 'answers', 100],
  ['best', 'الجواب الذهبي', 'crown', 'best', 10],
  ['lens', 'عدسة الدليل', 'cam', 'photos', 40],
  ['loved', 'محبوب المجتمع', 'heart', 'thanks', 100],
  ['trip', 'رحّالة', 'route', 'trip', 20],
  ['helper', 'فزعة', 'people', 'answers', 10],
  ['explorer', 'جوّال', 'pin', 'visits', 10],
  ['regions', 'رحّال المناطق', 'flag', 'cities', 5],
  ['critic', 'ذوّاق الدليل', 'star', 'reviews', 10],
];

export async function myStats(env, u) {
  const c = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM posts WHERE user_id=?1 AND status='visible' AND kind='question') questions,
      (SELECT COUNT(*) FROM posts WHERE user_id=?1 AND status='visible' AND kind='tip') tips,
      (SELECT COUNT(*) FROM posts WHERE user_id=?1 AND status='visible' AND photo IS NOT NULL) photos,
      (SELECT COUNT(*) FROM answers WHERE user_id=?1 AND status='visible') answers,
      (SELECT COUNT(*) FROM posts p JOIN answers a ON a.id=p.best_answer WHERE a.user_id=?1 AND p.status='visible') best,
      (SELECT COALESCE(SUM(thanks),0) FROM posts WHERE user_id=?1 AND status='visible') + (SELECT COALESCE(SUM(thanks),0) FROM answers WHERE user_id=?1 AND status='visible') thanks,
      (SELECT COUNT(*) FROM user_trip WHERE user_id=?1) trip,
      (SELECT COUNT(DISTINCT city) FROM visits WHERE user_id=?1) cities,
      (SELECT COUNT(*) FROM visits WHERE user_id=?1) visits,
      (SELECT COUNT(*) FROM reviews WHERE user_id=?1 AND status='visible') reviews,
      (SELECT COUNT(*) FROM place_photos WHERE user_id=?1 AND status='approved') placePhotos`).bind(u.id).first();
  c.photos = (c.photos || 0) + (c.placePhotos || 0);
  const pts = u.points || 0;
  let lv = 0;
  LEVELS.forEach(([at], i) => { if (pts >= at) lv = i; });
  const next = LEVELS[lv + 1];
  const acts = await env.DB.prepare(`SELECT * FROM (
      SELECT 'post' t, p.id post_id, p.kind, p.text, p.thanks, p.created FROM posts p WHERE p.user_id=?1 AND p.status='visible'
      UNION ALL
      SELECT 'answer' t, a.post_id, (SELECT text FROM posts WHERE id=a.post_id) kind, a.text, a.thanks, a.created FROM answers a WHERE a.user_id=?1 AND a.status='visible'
    ) ORDER BY created DESC LIMIT 8`).bind(u.id).all();
  const gr = await env.DB.prepare('SELECT status, note FROM guide_requests WHERE user_id=?').bind(u.id).first();
  const impact = await impactOf(env, u.id).catch(() => null);
  return {
    balance: Math.max(0, pts - (u.spent || 0)), spent: u.spent || 0, role: u.role, impact,
    guide: { eligible: pts >= GUIDE_AT && u.role === 'user', at: GUIDE_AT, request: gr ? { status: gr.status, note: gr.note || '' } : null },
    points: pts, level: lv + 1, levelName: LEVELS[lv][1], nextAt: next ? next[0] : null, nextName: next ? next[1] : null, levelAt: LEVELS[lv][0],
    counts: c,
    badges: BADGES.map(([id, name, icon, key, goal]) => ({ id, name, icon, goal, have: Math.min(c[key] || 0, goal), earned: (c[key] || 0) >= goal })),
    activity: acts.results.map((r) => ({ type: r.t, postId: r.post_id, text: r.t === 'answer' ? r.kind : r.text, kind: r.t === 'post' ? r.kind : 'answer', thanks: r.thanks, created: r.created })),
  };
}

/* ——— إشعاراتي ——— */
export async function myNotifications(env, u, request, J) {
  if (request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    await env.DB.prepare('UPDATE notifications SET read=1 WHERE user_id=? AND read=0').bind(u.id).run();
    return J({ ok: true });
  }
  const { results } = await env.DB.prepare(`SELECT n.*, a.name actor_name, p.text post_text FROM notifications n
      LEFT JOIN users a ON a.id=n.actor_id LEFT JOIN posts p ON p.id=n.post_id
      WHERE n.user_id=? ORDER BY n.id DESC LIMIT 60`).bind(u.id).all();
  const unread = await env.DB.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0').bind(u.id).first();
  return J({ unread: unread.n, items: results.map((r) => ({ id: r.id, type: r.type, postId: r.post_id, actor: r.actor_name || 'مستخدم الدليل', text: r.text || '', link: r.link || '', post: (r.post_text || '').slice(0, 90), read: !!r.read, created: r.created })) });
}

/* ——— جواز السعودية ——— */
const VISIT_RADIUS_KM = 0.5;
export async function passportRoute(p, env, u, request, J) {
  if (p === '/v1/me/visits' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const place = await env.DB.prepare('SELECT id,city,title,lat,lng FROM places WHERE id=? AND deleted=0').bind(+b.placeId).first();
    if (!place) return J({ error: 'not_found' }, 404);
    if (!place.lat || !place.lng) return J({ error: 'place_has_no_location' }, 400);
    const lat = +b.lat, lng = +b.lng;
    if (!lat || !lng) return J({ error: 'location_required' }, 400);
    const d = km(lat, lng, place.lat, place.lng);
    if (d > VISIT_RADIUS_KM) return J({ error: 'too_far', km: Math.round(d * 10) / 10 }, 400);
    const had = await env.DB.prepare('SELECT 1 FROM visits WHERE user_id=? AND place_id=?').bind(u.id, place.id).first();
    if (had) return J({ ok: true, already: true });
    const newCity = !(await env.DB.prepare('SELECT 1 FROM visits WHERE user_id=? AND city=?').bind(u.id, place.city).first());
    const pts = 10 + (newCity ? 25 : 0);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO visits (user_id,place_id,city,dist,created) VALUES (?,?,?,?,?)').bind(u.id, place.id, place.city, Math.round(d * 1000), now()),
      addPoints(env, u.id, pts),
    ]);
    return J({ ok: true, newCity, city: place.city, points: pts });
  }
  if (p === '/v1/me/passport') {
    const { results } = await env.DB.prepare('SELECT city, COUNT(*) n, MIN(created) first FROM visits WHERE user_id=? GROUP BY city ORDER BY first').bind(u.id).all();
    const recent = await env.DB.prepare('SELECT v.place_id id, p.title, v.city, v.created FROM visits v JOIN places p ON p.id=v.place_id WHERE v.user_id=? ORDER BY v.created DESC LIMIT 10').bind(u.id).all();
    const total = await env.DB.prepare('SELECT COUNT(*) n FROM visits WHERE user_id=?').bind(u.id).first();
    return J({ cities: results.map((r) => ({ id: r.city, count: r.n, first: r.first })), recent: recent.results, places: total.n, all: CITIES.map((c) => ({ id: c[0], name: c[1] })) });
  }
  return null;
}

/* ——— «أنا رايح» ——— */
export async function goingRoute(id, env, u, request, J) {
  if (request.method === 'POST') {
    if (!u) return J({ error: 'login_required' }, 401);
    const ev = await env.DB.prepare('SELECT id FROM events WHERE id=? AND deleted=0').bind(id).first();
    if (!ev) return J({ error: 'not_found' }, 404);
    const had = await env.DB.prepare('SELECT 1 FROM event_going WHERE user_id=? AND event_id=?').bind(u.id, id).first();
    await (had ? env.DB.prepare('DELETE FROM event_going WHERE user_id=? AND event_id=?').bind(u.id, id)
               : env.DB.prepare('INSERT INTO event_going (user_id,event_id,created) VALUES (?,?,?)').bind(u.id, id, now())).run();
  }
  const n = await env.DB.prepare('SELECT COUNT(*) n FROM event_going WHERE event_id=?').bind(id).first();
  const who = await env.DB.prepare('SELECT u.id, u.name FROM event_going g JOIN users u ON u.id=g.user_id WHERE g.event_id=? AND u.deleted=0 ORDER BY g.created DESC LIMIT 3').bind(id).all();
  const me = u ? !!(await env.DB.prepare('SELECT 1 FROM event_going WHERE user_id=? AND event_id=?').bind(u.id, id).first()) : false;
  return J({ count: n.n, going: me, who: who.results.map((r) => ({ id: r.id, name: r.name || 'د' })) });
}

/* ——— طلب «مرشد موثّق» ——— */
export async function guideRequest(env, u, request, J) {
  if (request.method !== 'POST') return J({ error: 'method_not_allowed' }, 405);
  if (u.role !== 'user') return J({ error: 'already_guide' }, 409);
  if ((u.points || 0) < GUIDE_AT) return J({ error: 'need_points', need: GUIDE_AT }, 403);
  const b = await request.json().catch(() => ({}));
  const about = clean(b.about, 600);
  if (about.length < 20) return J({ error: 'too_short' }, 400);
  const old = await env.DB.prepare('SELECT status, updated FROM guide_requests WHERE user_id=?').bind(u.id).first();
  if (old && old.status === 'pending') return J({ error: 'pending' }, 409);
  if (old && old.status === 'rejected' && old.updated > now() - 30 * 86400) return J({ error: 'wait' }, 429);
  await env.DB.prepare(`INSERT INTO guide_requests (user_id,about,status,created,updated) VALUES (?1,?2,'pending',?3,?3)
    ON CONFLICT(user_id) DO UPDATE SET about=?2, status='pending', note=NULL, updated=?3`).bind(u.id, about, now()).run();
  return J({ ok: true });
}
export async function guideAdmin(p, request, env, J) {
  let m;
  if (p === '/admin/guides' && request.method === 'GET') {
    const { results } = await env.DB.prepare(`SELECT g.*, u.name, u.city, u.points, u.role,
        (SELECT COUNT(*) FROM answers a WHERE a.user_id=g.user_id AND a.status='visible') answers,
        (SELECT COUNT(*) FROM posts p JOIN answers a ON a.id=p.best_answer WHERE a.user_id=g.user_id) best,
        (SELECT COUNT(*) FROM visits v WHERE v.user_id=g.user_id) visits
      FROM guide_requests g JOIN users u ON u.id=g.user_id WHERE u.deleted=0 ORDER BY g.status='pending' DESC, g.updated DESC LIMIT 100`).all();
    return J({ requests: results });
  }
  if ((m = p.match(/^\/admin\/guides\/([^/]+)$/)) && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const st = b.status === 'approved' ? 'approved' : 'rejected';
    const g = await env.DB.prepare('SELECT * FROM guide_requests WHERE user_id=?').bind(m[1]).first();
    if (!g) return J({ error: 'not_found' }, 404);
    const note = clean(b.note, 200);
    const ops = [env.DB.prepare('UPDATE guide_requests SET status=?, note=?, updated=? WHERE user_id=?').bind(st, note || null, now(), g.user_id)];
    if (st === 'approved') ops.push(env.DB.prepare("UPDATE users SET role='guide' WHERE id=? AND role='user'").bind(g.user_id));
    ops.push(env.DB.prepare("INSERT INTO notifications (user_id,type,text,created) VALUES (?,'system',?,?)").bind(g.user_id,
      st === 'approved' ? 'مبروك! صرت «مرشد موثّق» في دليل السعودية، والشارة تطلع جنب اسمك في المجتمع.' : `ما انقبل طلب «مرشد موثّق» هالمرة${note ? ': ' + note : ''}. تقدر تطلب مرة ثانية بعد شهر.`, now()));
    await env.DB.batch(ops);
    return J({ ok: true });
  }
  return null;
}


/* ═════════ «اسأل أهل المدينة» فعلاً ═════════
   سؤال جديد عن مدينة → يوصل إشعار لأهلها (مدينتهم في الحساب) اللي دخلوا التطبيق آخر 60 يوم
   - حد أقصى 25 شخص للسؤال، وكل شخص ما يوصله أكثر من 2 من هالإشعارات باليوم (ما نزعجهم)
   - نبدأ بالأكثر مساعدة (نقاط أعلى) عشان يجي الرد بسرعة
   - تقفلها من اللوحة: الميزات ← «تنبيه أهل المدينة» */
export async function notifyLocals(env, postId) {
  if (!(await getFeatures(env)).locals) return 0;
  const post = await env.DB.prepare("SELECT id, user_id, city, text FROM posts WHERE id=? AND status='visible' AND kind='question'").bind(postId).first();
  if (!post || !post.city) return 0;
  const name = CITIES.find((c) => c[0] === post.city)?.[1] || '';
  const tag = `سؤال عن ${name}`;
  const { results } = await env.DB.prepare(`SELECT u.id FROM users u WHERE u.deleted=0 AND u.city=? AND u.id<>? AND u.seen>?
      AND (SELECT COUNT(*) FROM notifications n WHERE n.user_id=u.id AND n.created>? AND n.text LIKE 'سؤال عن %') < 2
      AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE user_id=?) AND u.id NOT IN (SELECT user_id FROM blocks WHERE blocked_id=?)
    ORDER BY u.points DESC LIMIT 25`).bind(post.city, post.user_id, now() - 60 * 86400, now() - 86400, post.user_id, post.user_id).all();
  if (!results.length) return 0;
  const text = `${tag} يحتاج خبرتك: «${String(post.text).replace(/\s+/g, ' ').slice(0, 80)}»`;
  await env.DB.batch(results.map((u) => env.DB.prepare("INSERT INTO notifications (user_id,type,post_id,text,link,created) VALUES (?,'system',?,?,?,?)")
    .bind(u.id, post.id, text.slice(0, 140), `/question/${post.id}`, now())));
  return results.length;
}
