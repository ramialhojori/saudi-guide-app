/* درجة الحرارة الحين لكل مدينة (تطلع في صفحة المدينة)
   - المصدر: معهد الأرصاد النرويجي MET Norway (api.met.no) — مجاني ويسمح بالاستخدام التجاري بشرط ذكر المصدر (CC BY 4.0)، ومذكور في صفحة الإعدادات
     ولازم نعرّف بأنفسنا في User-Agent ونخزّن النتيجة وما نطلب كل مرة
   - نخزّن الدرجة 30 دقيقة في جدول kv، فكل مدينة تنطلب مرتين بالساعة كحد أقصى مهما كان عدد الزوار
     GET /v1/weather?city=medina → { city, temp, at, source } */
import { CITIES } from './normalize.js';

const TTL = 30 * 60;
const UA = 'SaudiGuide/1.0 https://www.saudi-guide.com';

export async function weatherRoute(p, env, J, q) {
  if (p !== '/v1/weather') return null;
  const c = CITIES.find((x) => x[0] === q.get('city'));
  if (!c) return J({ error: 'bad_city' }, 400);
  const key = 'weather_' + c[0];
  const now = Math.floor(Date.now() / 1000);
  const cached = await env.DB.prepare('SELECT v FROM kv WHERE k=?').bind(key).first().catch(() => null);
  let hit = null;
  try { hit = cached ? JSON.parse(cached.v) : null; } catch { hit = null; }
  if (hit && now - hit.at < TTL) return J({ city: c[0], ...hit, source: 'MET Norway' }, 200, 600);
  try {
    const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${c[4].toFixed(4)}&lon=${c[5].toFixed(4)}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error('met ' + r.status);
    const d = await r.json();
    const t = d?.properties?.timeseries?.[0]?.data?.instant?.details?.air_temperature;
    if (typeof t !== 'number') throw new Error('no temp');
    const v = { temp: Math.round(t), at: now };
    await env.DB.prepare('INSERT OR REPLACE INTO kv (k,v) VALUES (?,?)').bind(key, JSON.stringify(v)).run();
    return J({ city: c[0], ...v, source: 'MET Norway' }, 200, 600);
  } catch {
    // لو المصدر تعطّل نرجع آخر درجة معروفة لو عمرها أقل من 6 ساعات، وإلا ما نعرض شي
    if (hit && now - hit.at < 6 * 3600) return J({ city: c[0], ...hit, source: 'MET Norway' }, 200, 300);
    return J({ city: c[0], temp: null }, 200, 120);
  }
}
