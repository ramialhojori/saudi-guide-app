/* الحسابات: الدخول بآبل/قوقل → نتحقق من توقيع الرمز بمفاتيحهم العامة → نصدر رمز جلسة خاص فينا (HS256)
   الأسرار: SESSION_SECRET (يتولد في سكربت الإعداد). ما نحفظ أي كلمة مرور. */

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const json64 = (s) => JSON.parse(new TextDecoder().decode(unb64u(s)));
const now = () => Math.floor(Date.now() / 1000);

/* ——— رمز الجلسة ——— */
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signSession(env, uid) {
  const h = b64u(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const p = b64u(enc.encode(JSON.stringify({ sub: uid, iat: now(), exp: now() + 180 * 86400 })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET), enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64u(sig)}`;
}
export async function sessionUser(env, request) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m || !env.SESSION_SECRET) return null;
  const [h, p, s] = m[1].split('.');
  if (!s) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET), unb64u(s), enc.encode(`${h}.${p}`)).catch(() => false);
  if (!ok) return null;
  const pl = json64(p);
  if (!pl.sub || pl.exp < now()) return null;
  return env.DB.prepare('SELECT * FROM users WHERE id=? AND deleted=0').bind(pl.sub).first();
}

/* ——— التحقق من رموز آبل وقوقل ——— */
const JWKS = { apple: 'https://appleid.apple.com/auth/keys', google: 'https://www.googleapis.com/oauth2/v3/certs' };
async function verifyIdToken(provider, token, audiences) {
  const [h, p, s] = String(token || '').split('.');
  if (!s) throw new Error('bad_token');
  const head = json64(h), pl = json64(p);
  const keys = await (await fetch(JWKS[provider], { cf: { cacheTtl: 3600 } })).json();
  const jwk = keys.keys.find((k) => k.kid === head.kid);
  if (!jwk) throw new Error('unknown_key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), enc.encode(`${h}.${p}`));
  if (!ok) throw new Error('bad_signature');
  const iss = provider === 'apple' ? ['https://appleid.apple.com'] : ['accounts.google.com', 'https://accounts.google.com'];
  if (!iss.includes(pl.iss)) throw new Error('bad_issuer');
  if (!audiences.includes(pl.aud)) throw new Error('bad_audience');
  if (pl.exp < now()) throw new Error('expired');
  return pl;
}

export function publicUser(u) {
  return { id: u.id, name: u.name || '', handle: u.handle || '', email: u.email || '', city: u.city || '', bio: u.bio || '', avatar: u.avatar || '', role: u.role, points: u.points, balance: Math.max(0, (u.points || 0) - (u.spent || 0)), since: new Date(u.created * 1000).getUTCFullYear(), plusUntil: u.plus_until && u.plus_until > now() ? u.plus_until : 0 };
}

async function upsertUser(env, provider, sub, email, name, verified) {
  const col = provider === 'apple' ? 'apple_sub' : 'google_sub';
  let u = await env.DB.prepare(`SELECT * FROM users WHERE ${col}=?`).bind(sub).first();
  if (u && u.deleted) {
    // حساب محذوف: نبدأ من جديد بنفس المعرّف عند آبل/قوقل
    await env.DB.prepare(`UPDATE users SET ${col}=NULL WHERE id=?`).bind(u.id).run();
    u = null;
  }
  // نفس الإيميل الموثّق بحساب ثاني (آبل ↔ قوقل): نربطه بنفس الحساب عشان ما يخسر نقاطه ومشاركاته
  if (!u && email && verified) {
    const same = await env.DB.prepare(`SELECT * FROM users WHERE lower(email)=lower(?) AND deleted=0 AND ${col} IS NULL`).bind(email).first();
    if (same) { await env.DB.prepare(`UPDATE users SET ${col}=?, seen=? WHERE id=?`).bind(sub, now(), same.id).run(); u = same; return u; }
  }
  if (!u) {
    const id = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO users (id,${col},email,name,created,seen) VALUES (?,?,?,?,?,?)`).bind(id, sub, email || null, name || null, now(), now()).run();
    u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
  } else {
    await env.DB.prepare('UPDATE users SET seen=?, email=COALESCE(email,?), name=COALESCE(name,?) WHERE id=?').bind(now(), email || null, name || null, u.id).run();
  }
  return u;
}

/* ——— المسارات ——— */
export async function authRoute(p, request, env, J) {
  if (request.method === 'POST' && (p === '/v1/auth/apple' || p === '/v1/auth/google')) {
    if (!env.SESSION_SECRET) return J({ error: 'auth_not_configured' }, 503);
    const b = await request.json().catch(() => ({}));
    const provider = p.endsWith('apple') ? 'apple' : 'google';
    const aud = provider === 'apple'
      ? [...(env.APPLE_AUDIENCES || 'com.saudiguide,host.exp.Exponent').split(','), ...(env.APPLE_SERVICE_ID ? [env.APPLE_SERVICE_ID] : [])]
      : [...(env.GOOGLE_CLIENT_IDS || '').split(','), env.GOOGLE_WEB_CLIENT_ID || ''].filter(Boolean);
    try {
      const pl = await verifyIdToken(provider, b.idToken, aud);
      const name = String(b.name || pl.name || '').trim().slice(0, 60);
      const u = await upsertUser(env, provider, pl.sub, pl.email, name, pl.email_verified === true || pl.email_verified === 'true');
      return J({ token: await signSession(env, u.id), user: publicUser(u) });
    } catch (e) {
      return J({ error: String(e.message || e) }, 401);
    }
  }

  if (!p.startsWith('/v1/me')) return null;
  const u = await sessionUser(env, request);
  if (!u) return J({ error: 'unauthorized' }, 401);

  if (p === '/v1/me' && request.method === 'GET') return J({ user: publicUser(u) });
  if (p === '/v1/me' && request.method === 'PATCH') {
    const b = await request.json().catch(() => ({}));
    const name = b.name != null ? String(b.name).trim().slice(0, 60) : u.name;
    const city = b.city != null ? String(b.city).slice(0, 40) : u.city;
    const bio = b.bio != null ? String(b.bio).trim().slice(0, 200) : u.bio;
    await env.DB.prepare('UPDATE users SET name=?, city=?, bio=? WHERE id=?').bind(name, city, bio, u.id).run();
    return J({ user: publicUser({ ...u, name, city, bio }) });
  }
  if (p === '/v1/me' && request.method === 'DELETE') {
    // حذف الحساب (شرط آبل): نشيل البيانات الشخصية ونوقف الحساب
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET deleted=1, email=NULL, name=NULL, bio=NULL, avatar=NULL, handle=NULL WHERE id=?").bind(u.id),
      env.DB.prepare('DELETE FROM user_trip WHERE user_id=?').bind(u.id),
      env.DB.prepare('DELETE FROM user_cities WHERE user_id=?').bind(u.id),
      env.DB.prepare('UPDATE devices SET user_id=NULL WHERE user_id=?').bind(u.id),
      env.DB.prepare("UPDATE posts SET status='hidden', hidden_by='account' WHERE user_id=? AND status='visible'").bind(u.id),
      env.DB.prepare("UPDATE answers SET status='hidden', hidden_by='account' WHERE user_id=? AND status='visible'").bind(u.id),
    ]);
    return J({ ok: true });
  }
  if (p === '/v1/me/cities' && request.method === 'GET') {
    const r = await env.DB.prepare('SELECT city FROM user_cities WHERE user_id=?').bind(u.id).all();
    return J({ cities: r.results.map((x) => x.city) });
  }
  if (p === '/v1/me/cities' && request.method === 'PUT') {
    const b = await request.json().catch(() => ({}));
    const cs = [...new Set((Array.isArray(b.cities) ? b.cities : []).map(String))].filter((c) => /^[a-z-]{2,30}$/.test(c)).slice(0, 21);
    await env.DB.batch([env.DB.prepare('DELETE FROM user_cities WHERE user_id=?').bind(u.id), ...cs.map((c) => env.DB.prepare('INSERT INTO user_cities (user_id,city) VALUES (?,?)').bind(u.id, c))]);
    return J({ cities: cs });
  }
  if (p === '/v1/me/trip' && request.method === 'GET') {
    const r = await env.DB.prepare('SELECT place_id, pos FROM user_trip WHERE user_id=? ORDER BY pos').bind(u.id).all();
    const days = [];
    for (const x of r.results) { const d = Math.floor(x.pos / 1000); while (days.length <= d) days.push([]); days[d].push(x.place_id); }
    return J({ ids: r.results.map((x) => x.place_id), days: days.length ? days : [[]] });
  }
  if (p === '/v1/me/trip' && request.method === 'PUT') {
    const b = await request.json().catch(() => ({}));
    const ok = (n) => Number.isInteger(n) && n > 0;
    const seen = new Set();
    // pos = اليوم × 1000 + الترتيب داخل اليوم
    const days = (Array.isArray(b.days) ? b.days : [Array.isArray(b.ids) ? b.ids : []]).slice(0, 30)
      .map((d) => (Array.isArray(d) ? d : []).map(Number).filter((n) => ok(n) && !seen.has(n) && (seen.add(n), true)).slice(0, 100));
    const t = now();
    const rows = days.flatMap((d, di) => d.map((id, i) => [id, di * 1000 + i]));
    await env.DB.batch([
      env.DB.prepare('DELETE FROM user_trip WHERE user_id=?').bind(u.id),
      ...rows.map(([id, pos]) => env.DB.prepare('INSERT INTO user_trip (user_id,place_id,pos,added) VALUES (?,?,?,?)').bind(u.id, id, pos, t)),
    ]);
    return J({ ids: rows.map((x) => x[0]), days });
  }
  return J({ error: 'not_found' }, 404);
}
