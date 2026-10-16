/* الحجز بالعمولة (Travelpayouts، حساب رامي: marker 787616، مشروع 583393)
   - الروابط تنحفظ في kv ('affiliate') وتتعدل من اللوحة أو Claude بدون تحديث التطبيق
   - كل نوع (hotels | flights | tours | cars) رابط فيه متغيرات: {city} {city_en} {lat} {lng} {place}
   - التطبيق يعرض أزرار «احجز» بس للأنواع اللي لها رابط، ولو on=false تختفي كلها */
const KINDS = ['hotels', 'flights', 'tours', 'cars'];
const LABELS = { hotels: 'فنادق', flights: 'طيران', tours: 'جولات وتذاكر', cars: 'تأجير سيارات' };
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };

export async function getAffiliate(env) {
  const r = await env.DB.prepare("SELECT v FROM kv WHERE k='affiliate'").first().catch(() => null);
  const v = parse(r?.v, {});
  return { on: v.on === true, links: Object.fromEntries(KINDS.map((k) => [k, String(v.links?.[k] || '')])) };
}

export async function affiliateRoute(p, request, env, J) {
  if (p !== '/v1/affiliate' || request.method !== 'GET') return null;
  const a = await getAffiliate(env);
  return J({ on: a.on, links: a.on ? Object.fromEntries(Object.entries(a.links).filter(([, u]) => u)) : {} }, 200, 600);
}

export async function affiliateAdmin(p, request, env, J) {
  if (p !== '/admin/affiliate') return null;
  if (request.method === 'GET') return J({ ...(await getAffiliate(env)), kinds: KINDS, labels: LABELS });
  if (request.method !== 'POST') return null;
  const b = await request.json().catch(() => ({}));
  const cur = await getAffiliate(env);
  const links = { ...cur.links };
  for (const k of KINDS) {
    if (b.links?.[k] === undefined) continue;
    const u = String(b.links[k] || '').trim().slice(0, 600);
    if (u && !/^https:\/\//.test(u)) return J({ error: 'bad_url', kind: k }, 400);
    links[k] = u;
  }
  const v = { on: b.on != null ? !!b.on : cur.on, links };
  await env.DB.prepare("INSERT INTO kv (k, v) VALUES ('affiliate', ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify(v)).run();
  return J({ ok: true, ...v });
}
