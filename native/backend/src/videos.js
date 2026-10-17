/* مراجعات الفيديو: الزائر يرفع مقطع قصير (لين دقيقة، 40 ميقا) عن المكان
   - ينحفظ في R2، ويبقى «قيد المراجعة» لين رامي يعتمده من اللوحة (الفيديو ما نقدر نراجعه آلياً)
   - المعتمد يطلع في صفحة المكان، وصاحبه ياخذ +20 نقطة وإشعار
   - 3 مقاطع قيد المراجعة كحد أقصى لكل مستخدم */
import { sessionUser } from './auth.js';
import { getFeatures } from './contrib.js';

const now = () => Math.floor(Date.now() / 1000);
const MAX = 40 * 1024 * 1024, PTS = 20;
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS place_videos ( id INTEGER PRIMARY KEY AUTOINCREMENT, place_id INTEGER NOT NULL, user_id TEXT NOT NULL, url TEXT NOT NULL, caption TEXT, duration REAL, size INTEGER, status TEXT NOT NULL DEFAULT 'pending', views INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, decided INTEGER )",
  'CREATE INDEX IF NOT EXISTS place_videos_place ON place_videos(place_id, status, created DESC)',
  'CREATE INDEX IF NOT EXISTS place_videos_status ON place_videos(status, created)',
];
let ready = false;
async function ensure(env) { if (!ready) { await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))); ready = true; } }

export async function videosRoute(p, request, env, J) {
  const m = p.match(/^\/v1\/places\/(\d+)\/videos$/);
  if (!m) return null;
  await ensure(env);
  const pid = +m[1];
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(`SELECT v.id, v.url, v.caption, v.duration, v.created, u.name FROM place_videos v JOIN users u ON u.id=v.user_id
      WHERE v.place_id=? AND v.status='approved' ORDER BY v.created DESC LIMIT 20`).bind(pid).all();
    return J({ videos: results.map((r) => ({ id: r.id, url: r.url, caption: r.caption || '', duration: r.duration, at: r.created, name: r.name || 'مستخدم الدليل' })) }, 200, 120);
  }
  if (request.method !== 'POST') return null;
  const me = await sessionUser(env, request);
  if (!me) return J({ error: 'login_required' }, 401);
  if (!env.MEDIA) return J({ error: 'media_not_configured' }, 503);
  if ((await getFeatures(env)).videos === false) return J({ error: 'feature_off' }, 403);
  if (me.community_ban_until && me.community_ban_until > now()) return J({ error: 'banned' }, 403);
  const place = await env.DB.prepare('SELECT id FROM places WHERE id=? AND deleted=0').bind(pid).first();
  if (!place) return J({ error: 'not_found' }, 404);
  const pending = await env.DB.prepare("SELECT COUNT(*) n FROM place_videos WHERE user_id=? AND status='pending'").bind(me.id).first();
  if ((pending?.n || 0) >= 3) return J({ error: 'too_many_pending' }, 429);
  // نوع الملف: نعتمد على محتواه (توقيع ftyp لملفات MP4/MOV) لأن الجوال أحياناً يرسل Content-Type عام مثل application/octet-stream
  const len = +(request.headers.get('Content-Length') || 0);
  if (len > MAX) return J({ error: 'too_big' }, 413);
  const buf = await request.arrayBuffer();
  if (buf.byteLength < 20000 || buf.byteLength > MAX) return J({ error: 'bad_size' }, 400);
  const head = new Uint8Array(buf, 0, 12);
  const tag = String.fromCharCode(...head.slice(4, 8)), brand = String.fromCharCode(...head.slice(8, 12));
  if (tag !== 'ftyp') return J({ error: 'bad_type' }, 400);
  const ext = brand.startsWith('qt') ? 'mov' : 'mp4';
  const type = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  const u = new URL(request.url);
  const key = `v/${me.id}/${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(key, buf, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  const caption = String(u.searchParams.get('caption') || '').slice(0, 140);
  const duration = Math.min(600, Math.max(0, +u.searchParams.get('duration') || 0));
  await env.DB.prepare('INSERT INTO place_videos (place_id,user_id,url,caption,duration,size,created) VALUES (?,?,?,?,?,?,?)')
    .bind(pid, me.id, `${u.origin}/media/${key}`, caption, duration || null, buf.byteLength, now()).run();
  return J({ ok: true, status: 'pending' });
}

export async function videosAdmin(p, request, env, J, q) {
  if (!p.startsWith('/admin/videos')) return null;
  await ensure(env);
  let m;
  if (p === '/admin/videos' && request.method === 'GET') {
    const st = q.get('status') || 'pending';
    const { results } = await env.DB.prepare(`SELECT v.*, u.name, pl.title place FROM place_videos v LEFT JOIN users u ON u.id=v.user_id LEFT JOIN places pl ON pl.id=v.place_id
      WHERE v.status=? ORDER BY v.created DESC LIMIT 100`).bind(st).all();
    const c = await env.DB.prepare('SELECT status, COUNT(*) n FROM place_videos GROUP BY status').all();
    return J({ videos: results, counts: Object.fromEntries(c.results.map((x) => [x.status, x.n])) });
  }
  if ((m = p.match(/^\/admin\/videos\/(\d+)$/)) && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (!['approved', 'rejected', 'hidden', 'pending'].includes(b.status)) return J({ error: 'bad_status' }, 400);
    const v = await env.DB.prepare('SELECT * FROM place_videos WHERE id=?').bind(+m[1]).first();
    if (!v) return J({ error: 'not_found' }, 404);
    const stmts = [env.DB.prepare('UPDATE place_videos SET status=?, decided=? WHERE id=?').bind(b.status, now(), v.id)];
    if (b.status === 'approved' && v.status !== 'approved' && !v.decided) {
      stmts.push(env.DB.prepare('UPDATE users SET points=points+? WHERE id=?').bind(PTS, v.user_id));
      stmts.push(env.DB.prepare("INSERT INTO notifications (user_id,type,text,link,created) VALUES (?,'system',?,?,?)").bind(v.user_id, `انتشر الفيديو اللي رفعته، و+${PTS} نقطة لك. شكراً إنك تساعد الزوار`, `/place/${v.place_id}`, now()));
    }
    if (b.status === 'rejected' && v.status === 'pending') {
      stmts.push(env.DB.prepare("INSERT INTO notifications (user_id,type,text,link,created) VALUES (?,'system',?,?,?)").bind(v.user_id, 'الفيديو اللي رفعته ما انقبل (لازم يكون عن المكان نفسه وبدون وجوه ناس بدون إذنهم)', `/place/${v.place_id}`, now()));
    }
    await env.DB.batch(stmts);
    return J({ ok: true });
  }
  return null;
}
