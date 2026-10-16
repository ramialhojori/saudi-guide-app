/* بيانات ودجت الشاشة الرئيسية (iOS):
   GET /v1/widget?city=riyadh  (التوكن اختياري: لو موجود نرجع فعالياته «رايح»)
   - pick: فعالية اليوم في مدينته، وإلا مكان مختار يتغير كل يوم
   - offer: عرض اليوم (يتغير كل يوم)
   - going: أقرب فعاليات ضغط عليها «رايح» (للعد التنازلي)
   الودجت نفسه يجيب الطقس من Open-Meteo مباشرة */
import { sessionUser } from './auth.js';
import { CITIES } from './normalize.js';
import { offerOff } from './offers.js';

const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const dayNo = () => Math.floor((Date.now() + 3 * 3600e3) / 86400e3); // يوم بتوقيت مكة
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const img = (r) => r.thumb || parse(r.images, [])[0] || ''; // الصغيرة أول (ذاكرة الودجت محدودة)

export async function widgetRoute(p, request, env, J, q) {
  if (p !== '/v1/widget' || request.method !== 'GET') return null;
  const c = CITIES.find((x) => x[0] === q.get('city')) || CITIES.find((x) => x[0] === 'riyadh');
  const [cid, cname, , , lat, lng] = c;
  const nowIso = new Date().toISOString();
  const soon = new Date(Date.now() + 7 * 86400e3).toISOString();
  const d = dayNo();

  // فعالية شغالة اليوم أو خلال أسبوع في مدينته
  let pick = null;
  const ev = await env.DB.prepare(`SELECT id, title, summary, images, thumb, start, "end" FROM events WHERE deleted=0 AND city=? AND COALESCE(NULLIF("end",''),start) >= ? AND start <= ? ORDER BY start LIMIT 5`)
    .bind(cid, nowIso, soon).all().catch(() => ({ results: [] }));
  if (ev.results.length) {
    const e = ev.results[d % ev.results.length];
    pick = { kind: 'event', id: e.id, title: e.title, sub: String(e.summary || '').slice(0, 90), image: img(e), start: e.start || '', url: `saudiguide://event/${e.id}` };
  } else {
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM places WHERE deleted=0 AND city=? AND (images<>'[]' OR thumb<>'') AND kinds NOT LIKE '%food%'").bind(cid).first();
    if (n?.n) {
      const r = await env.DB.prepare("SELECT id, title, summary, images, thumb FROM places WHERE deleted=0 AND city=? AND (images<>'[]' OR thumb<>'') AND kinds NOT LIKE '%food%' ORDER BY id LIMIT 1 OFFSET ?")
        .bind(cid, (d * 7) % n.n).first();
      if (r) pick = { kind: 'place', id: r.id, title: r.title, sub: String(r.summary || '').slice(0, 90), image: img(r), start: '', url: `saudiguide://place/${r.id}` };
    }
  }

  // عرض اليوم (لمدينته أو لكل المدن)
  let offer = null;
  const os = await env.DB.prepare("SELECT id, store_name, title, value, unit FROM offers WHERE status='active' AND (expires_at IS NULL OR expires_at>=?1) AND (starts_at IS NULL OR starts_at<=?1) AND (city='' OR city=?2) ORDER BY id LIMIT 40")
    .bind(today(), cid).all().catch(() => ({ results: [] }));
  if (os.results.length) {
    const o = os.results[d % os.results.length];
    offer = { id: o.id, store: o.store_name, title: o.title, off: offerOff(o), url: 'saudiguide://offers' };
  }

  // فعالياتي (رايح) — للمسجّل بس
  let going = [];
  const me = await sessionUser(env, request).catch(() => null);
  if (me) {
    const g = await env.DB.prepare(`SELECT e.id, e.title, e.start, e.city FROM event_going g JOIN events e ON e.id=g.event_id WHERE g.user_id=? AND e.deleted=0 AND COALESCE(NULLIF(e."end",''),e.start) >= ? ORDER BY e.start LIMIT 3`)
      .bind(me.id, nowIso).all().catch(() => ({ results: [] }));
    going = g.results.map((e) => ({ id: e.id, title: e.title, start: e.start || '', city: (CITIES.find((x) => x[0] === e.city) || [])[1] || '', url: `saudiguide://event/${e.id}` }));
  }
  return J({ city: cid, cityName: cname, lat, lng, pick, offer, going, at: Math.floor(Date.now() / 1000) }, 200, me ? 0 : 600);
}
