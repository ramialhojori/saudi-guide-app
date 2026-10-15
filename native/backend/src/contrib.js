/* المساهمة على طريقة «مرشدي قوقل المحليين»:
   - «تأثيرك»: كم مرة انشافت مساهماتك وكم شكروك (+ إشعار أسبوعي الخميس المغرب)
   - أسئلة سريعة عن الأماكن (نعم/لا) → +1 لكل جواب
   - اقتراح تعديل أو إضافة مكان ناقص → يوصل المشرف، وبعد الموافقة +5 / +15
   - أبطال الشهر في كل مدينة، والمشرف يكرّمهم من اللوحة
   - مفاتيح المميزات: المشرف يخفي أي ميزة من اللوحة بدون تحديث التطبيق */

import { sessionUser } from './auth.js';
import { CITIES, searchKey } from './normalize.js';

const now = () => Math.floor(Date.now() / 1000);
const parse = (s, d = []) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const str = (v, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
const addPoints = (env, uid, n) => env.DB.prepare('UPDATE users SET points=MAX(0,points+?) WHERE id=?').bind(n, uid);
const notify = (env, uid, text, link) => env.DB.prepare("INSERT INTO notifications (user_id,type,text,link,created) VALUES (?,'system',?,?,?)").bind(uid, String(text).slice(0, 160), link || null, now());

/* ═════════ مفاتيح المميزات ═════════ */
export const FEATURES = {
  coupons: 'الكوبونات وعروض المحلات',
  merchants: 'بوابة التجار («سجّل نشاطك»)',
  points: 'صرف النقاط على الكوبونات',
  reviews: 'تقييمات الأماكن',
  photos: 'صور الزوار',
  passport: 'جواز السعودية والختم',
  guides: 'طلب «مرشد موثّق»',
  impact: '«تأثيرك» والإشعار الأسبوعي',
  facts: 'الأسئلة السريعة عن الأماكن',
  suggest: 'اقتراح تعديل وإضافة مكان',
  heroes: 'أبطال الشهر',
  challenge: 'تحدي الأسبوع',
  ai_moderation: 'المراجعة الذكية لـ«اسأل أهل المدينة» قبل النشر',
};
export async function getFeatures(env) {
  const r = await env.DB.prepare("SELECT v FROM kv WHERE k='features'").first();
  const saved = parse(r?.v, {});
  return Object.fromEntries(Object.keys(FEATURES).map((k) => [k, saved[k] !== false]));
}

/* ═════════ الأسئلة السريعة ═════════ */
const Q = {
  family: 'مناسب للعائلة؟', parking: 'فيه مواقف سهلة؟', prayer: 'فيه مصلى أو مسجد قريب؟', access: 'مناسب لكبار السن والكراسي المتحركة؟',
  crowded: 'زحمة أغلب الوقت؟', outdoor: 'فيه جلسات خارجية؟', wifi: 'فيه واي فاي؟', kids: 'فيه شي للأطفال؟',
  free: 'الدخول مجاني؟', shade: 'فيه مظلات أو مكان مكيّف؟', toilets: 'فيه دورات مياه؟', night: 'حلو بالليل؟',
};
/** الأسئلة اللي تناسب نوع المكان */
function questionsFor(kinds) {
  const k = new Set(kinds);
  const list = ['family', 'parking'];
  if (k.has('food') || k.has('cafe')) list.push('outdoor', 'kids', 'crowded');
  if (k.has('cafe')) list.push('wifi');
  if (k.has('sights') || k.has('heritage') || k.has('nature') || k.has('fun')) list.push('free', 'shade', 'toilets', 'night');
  if (k.has('shopping')) list.push('crowded', 'toilets');
  list.push('prayer', 'access');
  return [...new Set(list)];
}
const DAILY_FACTS = 40;

export async function contribRoute(p, request, env, J, q) {
  const M = request.method;
  let m;

  if (p === '/v1/features' && M === 'GET') return J({ features: await getFeatures(env) }, 200, 60);

  /* الأسئلة السريعة عن مكان */
  if ((m = p.match(/^\/v1\/places\/(\d+)\/facts$/))) {
    const me = await sessionUser(env, request);
    const pid = +m[1];
    const place = await env.DB.prepare('SELECT id, kinds FROM places WHERE id=? AND deleted=0').bind(pid).first();
    if (!place) return J({ error: 'not_found' }, 404);
    const keys = questionsFor(parse(place.kinds));
    if (M === 'POST') {
      if (!me) return J({ error: 'login_required' }, 401);
      const b = await request.json().catch(() => ({}));
      if (!keys.includes(b.k) || ![0, 1].includes(b.v)) return J({ error: 'bad_request' }, 400);
      const n = await env.DB.prepare('SELECT COUNT(*) n FROM fact_votes WHERE user_id=? AND created>?').bind(me.id, now() - 86400).first();
      const old = await env.DB.prepare('SELECT v FROM fact_votes WHERE user_id=? AND place_id=? AND k=?').bind(me.id, pid, b.k).first();
      if (!old && n.n >= DAILY_FACTS) return J({ error: 'rate_limited' }, 429);
      await env.DB.prepare('INSERT INTO fact_votes (user_id,place_id,k,v,created) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(user_id,place_id,k) DO UPDATE SET v=?4').bind(me.id, pid, b.k, b.v, now()).run();
      if (!old) await addPoints(env, me.id, 1).run();
      return J({ ok: true, points: old ? 0 : 1 });
    }
    if (M === 'GET') {
      const { results } = await env.DB.prepare('SELECT k, SUM(v) yes, COUNT(*) n FROM fact_votes WHERE place_id=? GROUP BY k').bind(pid).all();
      const mine = me ? (await env.DB.prepare('SELECT k, v FROM fact_votes WHERE user_id=? AND place_id=?').bind(me.id, pid).all()).results : [];
      const my = Object.fromEntries(mine.map((x) => [x.k, x.v]));
      const agg = Object.fromEntries(results.map((x) => [x.k, x]));
      const facts = keys.map((k) => ({ k, q: Q[k], yes: agg[k]?.yes || 0, no: (agg[k]?.n || 0) - (agg[k]?.yes || 0), mine: k in my ? my[k] : null }));
      // نسأل أول سؤال ما جاوبه، ونبدأ بالأقل أجوبة
      const ask = facts.filter((f) => f.mine === null).sort((a, b) => a.yes + a.no - (b.yes + b.no))[0] || null;
      return J({ facts, ask: ask ? { k: ask.k, q: ask.q } : null });
    }
  }

  /* اقتراحات الزوار */
  if (p === '/v1/suggestions' && M === 'POST') {
    const me = await sessionUser(env, request);
    if (!me) return J({ error: 'login_required' }, 401);
    const b = await request.json().catch(() => ({}));
    const type = ['edit', 'new', 'closed'].includes(b.type) ? b.type : null;
    if (!type) return J({ error: 'bad_request' }, 400);
    const d = b.data || {};
    const data = {
      title: str(d.title, 120), city: str(d.city, 40), kind: str(d.kind, 30), address: str(d.address, 200), phone: str(d.phone, 20).replace(/[^\d+]/g, ''),
      website: str(d.website, 200), lat: num(d.lat), lng: num(d.lng), note: String(d.note || '').trim().slice(0, 600), hours: str(d.hours, 120),
    };
    if (type !== 'new') {
      const pl = await env.DB.prepare('SELECT id FROM places WHERE id=? AND deleted=0').bind(+b.placeId).first();
      if (!pl) return J({ error: 'not_found' }, 404);
    } else {
      if (data.title.length < 2) return J({ error: 'title_required' }, 400);
      if (!CITIES.some((c) => c[0] === data.city)) return J({ error: 'bad_city' }, 400);
    }
    if (type === 'edit' && !data.note && !data.title && !data.phone && !data.address && !data.website && !data.hours && !data.lat) return J({ error: 'empty' }, 400);
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM suggestions WHERE user_id=? AND created>?').bind(me.id, now() - 86400).first();
    if (n.n >= 10) return J({ error: 'rate_limited' }, 429);
    const r = await env.DB.prepare('INSERT INTO suggestions (user_id,type,place_id,data,created,updated) VALUES (?,?,?,?,?,?)')
      .bind(me.id, type, type === 'new' ? null : +b.placeId, JSON.stringify(data), now(), now()).run();
    return J({ id: r.meta.last_row_id });
  }

  /* أبطال الشهر */
  if (p === '/v1/community/heroes' && M === 'GET') return J(await heroes(env, q.get('city')), 200, 300);

  return null;
}

/* ═════════ «تأثيرك» ═════════ */
export async function impactOf(env, uid) {
  const r = await env.DB.prepare(`SELECT
      (SELECT COALESCE(SUM(views),0) FROM posts WHERE user_id=?1 AND status='visible') pv,
      (SELECT COALESCE(SUM(p.views),0) FROM posts p WHERE p.status='visible' AND p.user_id<>?1 AND p.id IN (SELECT post_id FROM answers WHERE user_id=?1 AND status='visible')) av,
      (SELECT COALESCE(SUM(views),0) FROM reviews WHERE user_id=?1 AND status='visible') rv,
      (SELECT COALESCE(SUM(views),0) FROM place_photos WHERE user_id=?1 AND status='approved') phv,
      (SELECT COUNT(*) FROM thanks t WHERE (t.target='p' AND t.target_id IN (SELECT id FROM posts WHERE user_id=?1)) OR (t.target='a' AND t.target_id IN (SELECT id FROM answers WHERE user_id=?1))) th,
      (SELECT COUNT(DISTINCT p.user_id) FROM posts p JOIN answers a ON a.post_id=p.id WHERE a.user_id=?1 AND a.status='visible' AND p.user_id<>?1) asked,
      (SELECT COUNT(*) FROM fact_votes WHERE user_id=?1) facts,
      (SELECT COUNT(*) FROM suggestions WHERE user_id=?1 AND status='approved') sugg`).bind(uid).first();
  return { views: r.pv + r.av + r.rv + r.phv, photoViews: r.phv, thanks: r.th, helped: r.asked, facts: r.facts, suggestions: r.sugg };
}

/** إشعار «تأثيرك هالأسبوع» — الخميس بعد المغرب تقريباً (الكرون كل ساعة) */
export async function weeklyImpact(env) {
  const f = await getFeatures(env);
  if (!f.impact) return;
  const mk = new Date(Date.now() + 3 * 3600e3);
  if (mk.getUTCDay() !== 4 || mk.getUTCHours() !== 18) return;
  const wk = mk.toISOString().slice(0, 10);
  const done = await env.DB.prepare("SELECT v FROM kv WHERE k='impact_week'").first();
  if (done?.v === wk) return;
  await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('impact_week',?)").bind(wk).run();
  const rs = await env.DB.batch(["SELECT DISTINCT user_id u FROM posts WHERE status='visible'", "SELECT DISTINCT user_id u FROM answers WHERE status='visible'",
    "SELECT DISTINCT user_id u FROM reviews WHERE status='visible'", "SELECT DISTINCT user_id u FROM place_photos WHERE status='approved'"].map((x) => env.DB.prepare(x)));
  const uids = [...new Set(rs.flatMap((r) => r.results.map((x) => x.u)))].slice(0, 3000);
  for (const uid of uids) {
    const im = await impactOf(env, uid);
    const k = `impact:${uid}`;
    const last = parse((await env.DB.prepare('SELECT v FROM kv WHERE k=?').bind(k).first())?.v, { views: 0, thanks: 0 });
    const dv = im.views - (last.views || 0), dt = im.thanks - (last.thanks || 0);
    await env.DB.prepare('INSERT OR REPLACE INTO kv (k,v) VALUES (?,?)').bind(k, JSON.stringify({ views: im.views, thanks: im.thanks })).run();
    if (dv < 5 && dt < 1) continue;
    const parts = [dv >= 5 ? `مساهماتك انشافت ${dv} مرة` : '', dt ? `وانشكرت ${dt} مرة` : ''].filter(Boolean).join(' ');
    await notify(env, uid, `تأثيرك هالأسبوع: ${parts}. شكراً لأنك تساعد الزوار!`, '/profile').run();
  }
}

/* ═════════ أبطال الشهر ═════════ */
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export async function heroes(env, city, limit = 5) {
  const mk = new Date(Date.now() + 3 * 3600e3);
  const start = Math.floor(Date.UTC(mk.getUTCFullYear(), mk.getUTCMonth(), 1) / 1000) - 3 * 3600;
  const ok = city && CITIES.some((c) => c[0] === city);
  // D1 ما يقبل UNION طويل، فنجمع كل نوع لحاله ونحسب هنا
  const C = ok ? ' AND city=?2' : '';
  const parts = [
    ['a', 5, `SELECT a.user_id u, COUNT(*) n FROM answers a JOIN posts p ON p.id=a.post_id WHERE a.status='visible' AND a.created>=?1${ok ? ' AND p.city=?2' : ''} GROUP BY a.user_id`],
    ['b', 15, `SELECT a.user_id u, COUNT(*) n FROM posts p JOIN answers a ON a.id=p.best_answer WHERE p.created>=?1${ok ? ' AND p.city=?2' : ''} GROUP BY a.user_id`],
    ['p', 2, `SELECT user_id u, COUNT(*) n FROM posts WHERE status='visible' AND created>=?1${C} GROUP BY user_id`],
    ['r', 3, `SELECT r.user_id u, COUNT(*) n FROM reviews r JOIN places pl ON pl.id=r.place_id WHERE r.status='visible' AND r.created>=?1${ok ? ' AND pl.city=?2' : ''} GROUP BY r.user_id`],
    ['v', 10, `SELECT user_id u, COUNT(*) n FROM visits WHERE created>=?1${C} GROUP BY user_id`],
    ['ph', 5, `SELECT ph.user_id u, COUNT(*) n FROM place_photos ph JOIN places pl ON pl.id=ph.place_id WHERE ph.status='approved' AND ph.created>=?1${ok ? ' AND pl.city=?2' : ''} GROUP BY ph.user_id`],
    ['f', 1, `SELECT f.user_id u, COUNT(*) n FROM fact_votes f JOIN places pl ON pl.id=f.place_id WHERE f.created>=?1${ok ? ' AND pl.city=?2' : ''} GROUP BY f.user_id`],
  ];
  const res = await env.DB.batch(parts.map(([, , sql]) => env.DB.prepare(sql).bind(start, ...(ok ? [city] : []))));
  const agg = {};
  res.forEach((r, i) => { const [t, w] = parts[i]; for (const x of r.results) { const a = (agg[x.u] ||= { score: 0, a: 0, r: 0, v: 0 }); a.score += w * x.n; if (t in a) a[t] += x.n; } });
  const top = Object.entries(agg).sort((x, y) => y[1].score - x[1].score).slice(0, limit * 2);
  const users = top.length ? (await env.DB.prepare(`SELECT id, name, role, city FROM users WHERE deleted=0 AND role<>'admin' AND id IN (${top.map(() => '?').join(',')})`).bind(...top.map((t) => t[0])).all()).results : [];
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  const results = top.filter(([id]) => byId[id]).slice(0, limit).map(([id, a]) => ({ user_id: id, score: a.score, answers: a.a, reviews: a.r, visits: a.v, name: byId[id].name, role: byId[id].role, city: byId[id].city }));
  return {
    month: MONTHS[mk.getUTCMonth()],
    heroes: results.map((r) => ({ id: r.user_id, name: r.name || 'مستخدم الدليل', city: r.city || '', score: r.score, answers: r.answers, reviews: r.reviews, visits: r.visits, guide: r.role === 'guide' })),
  };
}

/* ═════════ الإدارة ═════════ */
export async function contribAdmin(p, request, env, J, q) {
  const M = request.method;
  let m;
  if (p === '/admin/features') {
    if (M === 'POST') {
      const b = await request.json().catch(() => ({}));
      const cur = await getFeatures(env);
      for (const k of Object.keys(FEATURES)) if (typeof b[k] === 'boolean') cur[k] = b[k];
      await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('features',?)").bind(JSON.stringify(cur)).run();
      return J({ features: cur });
    }
    return J({ features: await getFeatures(env), labels: FEATURES });
  }
  if (p === '/admin/suggestions' && M === 'GET') {
    const st = ['pending', 'approved', 'rejected'].includes(q.get('status')) ? q.get('status') : 'pending';
    const { results } = await env.DB.prepare(`SELECT s.*, u.name u_name, pl.title p_title, pl.city p_city, pl.phone p_phone, pl.website p_website, pl.address p_address, pl.lat p_lat, pl.lng p_lng
      FROM suggestions s JOIN users u ON u.id=s.user_id LEFT JOIN places pl ON pl.id=s.place_id WHERE s.status=? ORDER BY s.id ${st === 'pending' ? 'ASC' : 'DESC'} LIMIT 150`).bind(st).all();
    return J({ suggestions: results.map((s) => ({ id: s.id, type: s.type, status: s.status, note: s.note || '', created: s.created, data: parse(s.data, {}), user: { id: s.user_id, name: s.u_name || 'مستخدم الدليل' },
      place: s.place_id ? { id: s.place_id, title: s.p_title || '', city: s.p_city || '', phone: s.p_phone || '', website: s.p_website || '', address: s.p_address || '', lat: s.p_lat, lng: s.p_lng } : null })) });
  }
  if ((m = p.match(/^\/admin\/suggestions\/(\d+)$/)) && M === 'POST') {
    const s = await env.DB.prepare('SELECT * FROM suggestions WHERE id=?').bind(+m[1]).first();
    if (!s || s.status !== 'pending') return J({ error: 'not_found' }, 404);
    const b = await request.json().catch(() => ({}));
    const st = b.status === 'approved' ? 'approved' : 'rejected';
    const d = parse(s.data, {});
    const note = str(b.note, 200);
    const ops = [env.DB.prepare('UPDATE suggestions SET status=?, note=?, updated=? WHERE id=?').bind(st, note || null, now(), s.id)];
    let placeId = s.place_id, pts = 0, msg = '';
    if (st === 'approved') {
      if (s.type === 'new') {
        const mx = await env.DB.prepare('SELECT MAX(id) m FROM places').first();
        placeId = Math.max(900000000, mx.m || 0) + 1;
        const kinds = d.kind ? [d.kind] : [];
        ops.push(env.DB.prepare(`INSERT INTO places (id,city,title,cats,kinds,summary,images,thumb,lat,lng,address,phone,website,search,sig,updated,deleted)
          VALUES (?,?,?,'[]',?,?,'[]','',?,?,?,?,?,?,'panel',?,2)`).bind(placeId, d.city, d.title, JSON.stringify(kinds), d.note || '', d.lat, d.lng, d.address || '', d.phone || '', d.website || '', searchKey(d.title), now()));
        pts = 15; msg = `انقبل اقتراحك «${d.title}» وانضاف للدليل، وينزل للناس بعد ما نكمّل صوره ومعلوماته. +15 نقطة`;
      } else if (s.type === 'closed') {
        ops.push(env.DB.prepare("UPDATE places SET deleted=1, sig='panel', updated=? WHERE id=?").bind(now(), s.place_id));
        pts = 5; msg = 'شكراً! أخفينا المكان المقفل من الدليل بناءً على بلاغك. +5 نقاط';
      } else {
        // نطبق الحقول اللي اختارها المشرف (أو كل اللي فيها قيمة)
        const pick = Array.isArray(b.apply) ? b.apply : ['title', 'phone', 'website', 'address', 'geo'];
        const sets = [], args = [];
        for (const f of ['title', 'phone', 'website', 'address']) if (pick.includes(f) && d[f]) { sets.push(`${f}=?`); args.push(d[f]); }
        if (pick.includes('geo') && d.lat && d.lng) { sets.push('lat=?', 'lng=?'); args.push(d.lat, d.lng); }
        if (sets.length) ops.push(env.DB.prepare(`UPDATE places SET ${sets.join(',')}, sig='panel', updated=? WHERE id=?`).bind(...args, now(), s.place_id));
        pts = 5; msg = 'انقبل تعديلك على المكان. شكراً إنك تحسّن الدليل! +5 نقاط';
      }
      ops.push(addPoints(env, s.user_id, pts), notify(env, s.user_id, msg, s.type === 'edit' && placeId ? `/place/${placeId}` : null));
    } else {
      ops.push(notify(env, s.user_id, `ما قدرنا نعتمد اقتراحك${note ? ': ' + note : ''}. شكراً على مساعدتك.`));
    }
    await env.DB.batch(ops);
    return J({ ok: true, placeId });
  }
  if (p === '/admin/heroes' && M === 'GET') return J(await heroes(env, q.get('city'), 10));
  if (p === '/admin/heroes/honor' && M === 'POST') {
    const b = await request.json().catch(() => ({}));
    const ids = (Array.isArray(b.userIds) ? b.userIds : []).map(String).slice(0, 20);
    const bonus = Math.max(0, Math.min(500, Math.round(+b.bonus || 0)));
    const text = str(b.text, 140) || `مبروك! أنت من أبطال الشهر في دليل السعودية${bonus ? ` وأضفنا لك ${bonus} نقطة` : ''}. شكراً على مساعدتك للزوار.`;
    if (!ids.length) return J({ error: 'bad_request' }, 400);
    await env.DB.batch(ids.flatMap((id) => [notify(env, id, text, '/profile'), ...(bonus ? [addPoints(env, id, bonus)] : [])]));
    return J({ ok: true, sent: ids.length });
  }
  return null;
}
