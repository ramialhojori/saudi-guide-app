/* بيانات المواسم الرسمية (التواريخ والوصف والغلاف والرابط) — تتعدل من اللوحة أو من Claude
   - الموسم اللي له فعاليات يطلع تلقائياً، وهذي البيانات تصحح تواريخه وشكله
   - «سيعود قريباً»: مواسم انتهت وترجع كل سنة، تطلع كبطاقة حتى لو ما فيها فعاليات
   - الغلاف: صورنا الخاصة فقط (ما نستخدم صور مواقع ثانية) — لو فاضي التطبيق يستخدم صورة من صوره */
const now = () => Math.floor(Date.now() / 1000);
export const DEFAULT_SEASONS = [
  { name: 'موسم الرياض', city: 'riyadh', start: '2026-10-21', end: '2027-03-01', line: 'حفلات ومسرح ورياضة وتجارب في قلب العاصمة · شعار «Big Time»', link: 'https://riyadhseason.com', returning: false, when: 'أكتوبر – مارس' },
  { name: 'موسم جدة', city: 'jeddah', start: '', end: '', line: 'البحر والبلد والتجارب على الكورنيش', link: '', returning: true, when: 'الصيف' },
  { name: 'موسم الدرعية', city: 'diriyah', start: '', end: '', line: 'فن وتراث في مهد الدولة السعودية', link: '', returning: true, when: 'الشتاء' },
  { name: 'لحظات العلا', city: 'alula', start: '', end: '', line: 'مهرجانات وسماء صافية بين الصخور', link: 'https://www.experiencealula.com', returning: true, when: 'طول السنة' },
  { name: 'موسم عسير', city: 'asir-region', start: '', end: '', line: 'جبال وضباب وتجارب صيفية في أبها وما حولها', link: '', returning: true, when: 'يونيو – سبتمبر' },
  { name: 'موسم الخبر', city: 'eastern-region', start: '', end: '', line: 'الواجهة البحرية والعروض والفعاليات في الشرقية', link: '', returning: true, when: 'الشتاء' },
  { name: 'مهرجان صيف تبوك', city: 'tabuk-region', start: '', end: '', line: 'أجواء صيفية معتدلة وفعاليات للعائلة في تبوك', link: '', returning: true, when: 'الصيف' },
  { name: 'مدل بيست', city: 'riyadh', start: '', end: '', line: 'أكبر مهرجان موسيقى في المنطقة (ساوندستورم)', link: 'https://mdlbeast.com', returning: true, when: 'ديسمبر' },
  { name: 'شتاء طنطورة', city: 'alula', start: '', end: '', line: 'مهرجان شتوي في العلا بين التراث والموسيقى', link: '', returning: true, when: 'الشتاء' },
  { name: 'مهرجان الرياض للكوميديا', city: 'riyadh', start: '', end: '', line: 'عروض ستاند أب لأشهر الكوميديين من العالم', link: '', returning: true, when: 'الخريف' },
  { name: 'رالي حائل', city: 'hail', start: '', end: '', line: 'بطولة رالي حائل الدولي في رمال النفود', link: '', returning: true, when: 'الشتاء' },
];
const clean = (x) => ({
  name: String(x.name || '').trim().slice(0, 60), city: String(x.city || '').slice(0, 40),
  start: /^\d{4}-\d{2}-\d{2}$/.test(x.start || '') ? x.start : '', end: /^\d{4}-\d{2}-\d{2}$/.test(x.end || '') ? x.end : '',
  line: String(x.line || '').trim().slice(0, 160), link: /^https:\/\//.test(x.link || '') ? String(x.link).slice(0, 300) : '',
  cover: String(x.cover || '').includes('/media/') ? String(x.cover).slice(0, 300) : '', returning: !!x.returning, when: String(x.when || '').slice(0, 40),
  hidden: !!x.hidden,
});
export async function getSeasons(env) {
  const r = await env.DB.prepare("SELECT v FROM kv WHERE k='seasons_meta'").first();
  try { const v = r?.v ? JSON.parse(r.v) : null; if (Array.isArray(v)) return v.map(clean); } catch {}
  return DEFAULT_SEASONS.map(clean);
}
export async function seasonsRoute(p, request, env, J) {
  if (p === '/v1/seasons' && request.method === 'GET') return J({ seasons: (await getSeasons(env)).filter((s) => !s.hidden) }, 200, 300);
  return null;
}
export async function seasonsAdmin(p, request, env, J) {
  if (p !== '/admin/seasons/meta') return null;
  if (request.method === 'GET') return J({ seasons: await getSeasons(env) });
  if (request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    let list = await getSeasons(env);
    if (Array.isArray(b.seasons)) list = b.seasons.map(clean).filter((s) => s.name);
    else if (b.season && b.season.name) {
      const s = clean({ ...(list.find((x) => x.name === b.season.name) || {}), ...b.season });
      list = list.some((x) => x.name === s.name) ? list.map((x) => (x.name === s.name ? s : x)) : [...list, s];
    } else return J({ error: 'bad_request' }, 400);
    await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('seasons_meta',?)").bind(JSON.stringify(list)).run();
    return J({ ok: true, seasons: list, at: now() });
  }
  return null;
}
