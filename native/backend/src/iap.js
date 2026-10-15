/* اشتراك «دليل+» من آبل (StoreKit 2)
   - التطبيق يرسل «إيصال الشراء» الموقّع من آبل (JWS) → نتحقق من التوقيع وسلسلة شهادات آبل حتى جذر Apple Root CA - G3
     بدون أي مفتاح سري (التحقق بالمفاتيح العامة اللي داخل الإيصال نفسه)
   - إشعارات آبل (App Store Server Notifications V2) توصل /v1/iap/apple/notify: تجديد، إلغاء، استرجاع مبلغ...
   - users.plus_until = أبعد تاريخ بين: الاشتراكات الفعّالة (iap_subs) ومنحة المشرف (users.plus_grant_until) */

import { sessionUser } from './auth.js';

const BUNDLE_ID = 'com.saudiguide';
export const PLUS_PRODUCTS = ['com.yearly', 'com.monthly'];
// بصمة شهادة الجذر Apple Root CA - G3 (SHA-256)
const APPLE_ROOT_G3 = '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';
// علامات آبل داخل الشهادات: الشهادة الأخيرة (توقيع إيصالات المتجر) والوسيطة (WWDR)
const OID_LEAF = '2a864886f76364060b01';
const OID_INTER = '2a864886f76364060201';

const now = () => Math.floor(Date.now() / 1000);
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64u = (s) => b64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');

/* ——— قراءة DER بسيطة ——— */
function tlv(buf, pos) {
  const tag = buf[pos];
  let len = buf[pos + 1], hdr = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[pos + 2 + i];
    hdr = 2 + n;
  }
  return { tag, start: pos, body: pos + hdr, end: pos + hdr + len };
}
function children(buf, node) {
  const out = [];
  for (let p = node.body; p < node.end;) { const c = tlv(buf, p); out.push(c); p = c.end; }
  return out;
}
const bytes = (buf, n) => buf.slice(n.start, n.end);
const bodyOf = (buf, n) => buf.slice(n.body, n.end);

function parseTime(buf, n) {
  const s = new TextDecoder().decode(bodyOf(buf, n));
  const full = n.tag === 0x17 ? (Number(s.slice(0, 2)) >= 50 ? '19' : '20') + s : s;
  return Date.UTC(+full.slice(0, 4), +full.slice(4, 6) - 1, +full.slice(6, 8), +full.slice(8, 10), +full.slice(10, 12), +full.slice(12, 14));
}

function parseCert(der) {
  const cert = tlv(der, 0);
  const [tbs, sigAlg, sigBits] = children(der, cert);
  const t = children(der, tbs);
  const off = t[0].tag === 0xa0 ? 1 : 0; // [0] version
  const validity = children(der, t[off + 3]);
  const spki = t[off + 5];
  const spkiAlg = children(der, children(der, spki)[0]);
  return {
    der,
    tbs: bytes(der, tbs),
    sigAlg: hex(bodyOf(der, children(der, sigAlg)[0])),
    sig: bodyOf(der, sigBits).slice(1), // أول بايت = عدد البتات غير المستخدمة
    issuer: hex(bytes(der, t[off + 2])),
    subject: hex(bytes(der, t[off + 4])),
    notBefore: parseTime(der, validity[0]),
    notAfter: parseTime(der, validity[1]),
    spki: bytes(der, spki),
    curve: hex(bodyOf(der, spkiAlg[1] || spkiAlg[0])) === '2b81040022' ? 'P-384' : 'P-256',
  };
}

/* توقيع ECDSA بصيغة DER → الصيغة الخام (r||s) اللي يفهمها WebCrypto */
function derSigToRaw(sig, size) {
  const seq = tlv(sig, 0);
  const [r, s] = children(sig, seq).map((n) => {
    let v = bodyOf(sig, n);
    while (v.length > size && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(size);
    out.set(v, size - v.length);
    return out;
  });
  const raw = new Uint8Array(size * 2);
  raw.set(r, 0); raw.set(s, size);
  return raw;
}

const importKey = (c) => crypto.subtle.importKey('spki', c.spki, { name: 'ECDSA', namedCurve: c.curve }, false, ['verify']);

async function verifyIssued(child, parent) {
  if (child.issuer !== parent.subject) return false;
  const hash = child.sigAlg === '2a8648ce3d040303' ? 'SHA-384' : child.sigAlg === '2a8648ce3d040302' ? 'SHA-256' : null;
  if (!hash) return false;
  const size = parent.curve === 'P-384' ? 48 : 32;
  return crypto.subtle.verify({ name: 'ECDSA', hash }, await importKey(parent), derSigToRaw(child.sig, size), child.tbs);
}

/** يتحقق من إيصال/إشعار موقّع من آبل ويرجع محتواه — أو يرمي خطأ */
export async function verifyAppleJWS(jws) {
  const parts = String(jws || '').split('.');
  if (parts.length !== 3) throw new Error('bad_jws');
  const head = JSON.parse(new TextDecoder().decode(b64u(parts[0])));
  if (head.alg !== 'ES256' || !Array.isArray(head.x5c) || head.x5c.length !== 3) throw new Error('bad_header');
  const [leaf, inter, root] = head.x5c.map((c) => parseCert(b64(c)));
  const fp = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', root.der)));
  if (fp !== APPLE_ROOT_G3) throw new Error('bad_root');
  if (!hex(leaf.der).includes(OID_LEAF) || !hex(inter.der).includes(OID_INTER)) throw new Error('bad_chain_oid');
  const t = Date.now();
  if ([leaf, inter, root].some((c) => t < c.notBefore || t > c.notAfter)) throw new Error('cert_expired');
  if (!(await verifyIssued(leaf, inter)) || !(await verifyIssued(inter, root))) throw new Error('bad_chain');
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await importKey(leaf), b64u(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Error('bad_signature');
  return JSON.parse(new TextDecoder().decode(b64u(parts[1])));
}

/* ——— حفظ الاشتراك وحساب plus_until ——— */
export async function syncPlus(env, uid) {
  const sub = await env.DB.prepare('SELECT MAX(expires) e FROM iap_subs WHERE user_id=? AND revoked=0').bind(uid).first();
  const u = await env.DB.prepare('SELECT plus_grant_until g FROM users WHERE id=?').bind(uid).first();
  const until = Math.max(sub?.e || 0, u?.g || 0);
  await env.DB.prepare('UPDATE users SET plus_until=? WHERE id=?').bind(until > now() ? until : null, uid).run();
  return until > now() ? until : 0;
}

async function saveTx(env, tx, uid, extraUntil = 0) {
  if (tx.bundleId !== BUNDLE_ID) throw new Error('bad_bundle');
  if (!PLUS_PRODUCTS.includes(tx.productId)) throw new Error('bad_product');
  const orig = String(tx.originalTransactionId || tx.transactionId);
  const expires = Math.max(Math.floor((tx.expiresDate || 0) / 1000), extraUntil);
  const revoked = tx.revocationDate ? 1 : 0;
  const old = await env.DB.prepare('SELECT user_id FROM iap_subs WHERE orig_tx=?').bind(orig).first();
  const owner = uid || old?.user_id;
  if (!owner) return { owner: null };
  await env.DB.prepare(`INSERT INTO iap_subs (orig_tx,user_id,product,expires,revoked,env,last_tx,updated) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(orig_tx) DO UPDATE SET user_id=excluded.user_id, product=excluded.product, expires=CASE WHEN excluded.revoked=1 THEN 0 ELSE MAX(iap_subs.expires, excluded.expires) END, revoked=excluded.revoked, env=excluded.env, last_tx=excluded.last_tx, updated=excluded.updated`)
    .bind(orig, owner, tx.productId, revoked ? 0 : expires, revoked, String(tx.environment || ''), String(tx.transactionId || ''), now()).run();
  // نفس حساب آبل انتقل لحساب ثاني عندنا (استعادة المشتريات): نحدّث الحساب القديم بعد
  if (old?.user_id && old.user_id !== owner) await syncPlus(env, old.user_id);
  return { owner };
}

export async function iapRoute(p, request, env, J) {
  if (p === '/v1/iap/apple' && request.method === 'POST') {
    const u = await sessionUser(env, request);
    if (!u) return J({ error: 'login_required' }, 401);
    const b = await request.json().catch(() => ({}));
    const list = (Array.isArray(b.jws) ? b.jws : [b.jws]).filter(Boolean).slice(0, 20);
    if (!list.length) return J({ error: 'bad_request' }, 400);
    let saved = 0;
    const errors = [];
    for (const jws of list) {
      try {
        const tx = await verifyAppleJWS(jws);
        await saveTx(env, tx, u.id);
        saved++;
      } catch (e) { errors.push(String(e.message || e)); }
    }
    const until = await syncPlus(env, u.id);
    if (!saved) return J({ error: errors[0] || 'invalid', plus: !!until, plusUntil: until }, 400);
    return J({ ok: true, saved, plus: !!until, plusUntil: until });
  }

  if (p === '/v1/iap/apple/notify' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    try {
      const n = await verifyAppleJWS(b.signedPayload);
      const d = n.data || {};
      if (d.bundleId && d.bundleId !== BUNDLE_ID) return J({ ok: true });
      if (d.signedTransactionInfo) {
        const tx = await verifyAppleJWS(d.signedTransactionInfo);
        let grace = 0;
        if (d.signedRenewalInfo) {
          const r = await verifyAppleJWS(d.signedRenewalInfo).catch(() => null);
          if (r?.gracePeriodExpiresDate) grace = Math.floor(r.gracePeriodExpiresDate / 1000);
        }
        const { owner } = await saveTx(env, tx, null, grace);
        if (owner) await syncPlus(env, owner);
      }
      await env.DB.prepare("INSERT INTO kv (k,v) VALUES ('iap_last_notify',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v")
        .bind(JSON.stringify({ type: n.notificationType, sub: n.subtype || '', at: now() })).run().catch(() => {});
      return J({ ok: true });
    } catch (e) {
      // نرجع 200 للأخطاء الدائمة (توقيع غلط) عشان آبل ما تعيد المحاولة للأبد
      return J({ ok: false, error: String(e.message || e) });
    }
  }
  return null;
}
