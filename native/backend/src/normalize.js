/* تحويل عناصر قودبابر لصيغة دليل السعودية — نسخة الوركر من scripts/normalize.py
   أي تعديل في القواعد هنا لازم يتعدّل هناك بعد (والعكس). */

export const CITIES = [
  // id, name, gb section, color, lat, lng, kind
  ['riyadh', 'الرياض', 45404644, '#8E65AB', 24.7136, 46.6753, 'city'],
  ['medina', 'المدينة المنورة', 45455682, '#F89743', 24.4672, 39.6111, 'city'],
  ['makkah-region', 'مكة المكرمة', 45702588, '#EB839B', 21.3891, 39.8579, 'city'],
  ['alula', 'العلا', 45486429, '#62B9E8', 26.6086, 37.9232, 'city'],
  ['asir-region', 'عسير', 45408972, '#604C87', 18.2164, 42.5053, 'region'],
  ['taif', 'الطائف', 45485480, '#EFA56C', 21.2703, 40.4158, 'city'],
  ['jeddah', 'جدة', 45455674, '#BC77B2', 21.5433, 39.1728, 'city'],
  ['jizan', 'جازان', 45455689, '#8E65AB', 16.8892, 42.5511, 'region'],
  ['abha', 'أبها', 45603642, '#F89743', 18.2164, 42.5053, 'city'],
  ['diriyah', 'الدرعية', 72083169, '#EB839B', 24.7343, 46.5747, 'city'],
  ['yanbu', 'ينبع', 45455678, '#62B9E8', 24.0895, 38.0618, 'city'],
  ['albaha', 'الباحة', 45455684, '#604C87', 20.0129, 41.4677, 'region'],
  ['riyadh-region', 'منطقة الرياض', 46147884, '#EFA56C', 24.15, 47.31, 'region'],
  ['tabuk-region', 'تبوك', 45455692, '#BC77B2', 28.3835, 36.5662, 'region'],
  ['qassim-region', 'القصيم', 45603675, '#8E65AB', 26.326, 43.975, 'region'],
  ['eastern-region', 'المنطقة الشرقية', 46559136, '#F89743', 26.4207, 50.0888, 'region'],
  ['umluj', 'أملج والبحر الأحمر', 45603422, '#EB839B', 25.0213, 37.2685, 'city'],
  ['hail', 'حائل', 45702293, '#62B9E8', 27.5114, 41.7208, 'region'],
  ['aljawf-region', 'الجوف', 45483525, '#604C87', 29.9697, 40.2064, 'region'],
  ['najran', 'نجران', 45702616, '#EFA56C', 17.4924, 44.1277, 'region'],
  ['northern-border', 'الحدود الشمالية', 45991296, '#BC77B2', 30.9753, 41.0381, 'region'],
];
const SECTION_TO_CITY = Object.fromEntries(CITIES.map((c) => [c[2], c[0]]));

export const KIND_OF = {
  'معالم إسلامية': 'islamic',
  'التراث والثقافة': 'heritage', 'التاريخ والثقافة': 'heritage',
  'الشلالات والأودية': 'nature', 'مزارع': 'nature', 'آبار ومزارع': 'nature',
  'أماكن سياحية': 'sights', 'أماكن للزيارة': 'sights', 'سياحة وترفيه': 'sights',
  'ترفيه واستجمام': 'fun', 'موسم الرياض': 'fun',
  'مطاعم': 'food', 'إفطار': 'food', 'المطاعم والمقاهي': 'food', 'مطاعم وكافيهات': 'food',
  'كافيهات': 'cafe', 'مقاهي': 'cafe', 'مخبوزات': 'cafe', 'مقاهي ومخبوزات': 'cafe',
  'أسواق': 'shopping', 'أسواق شعبية': 'shopping', 'المولات': 'shopping', 'التسوق': 'shopping',
};

export function hires(u, w = 1200) {
  if (!u) return '';
  return u
    .replace(/(resizeapi\/[0-9a-f]{40}\/)\d+\/-?\d+\//, `$1${w}/`)
    .replace('/art/large_16_9/', '/art/default/')
    .replace('/art/large_x2_16_9/', '/art/default/');
}
export function thumb(u) {
  if (!u) return '';
  return u.includes('resizeapi') ? hires(u, 480) : u.replace('/art/default/', '/art/large_16_9/');
}

const AR = /[؀-ۿ]/;
export function splitTitle(t = '') {
  const parts = t.split(/\s[-|–]\s|\s?\|\s?/).map((p) => p.trim()).filter(Boolean);
  const ar = parts.filter((p) => AR.test(p));
  const en = parts.filter((p) => !AR.test(p));
  return [ar.length ? ar.join(' - ') : t.trim(), en.join(' - ')];
}

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
export function plain(html = '') {
  return html
    .replace(/<br\s*\/?>|<\/p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (m) => ENT[m] ?? m)
    .replace(/\n\s*\n+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
export function cleanBody(html = '') {
  return html
    .replace(/<div class="photo[^"]*"[^>]*>[\s\S]*?<\/div>/g, '')
    .replace(/<br class="clear"\s*\/?>/g, '')
    .replace(/\sstyle="[^"]*"/g, '')
    .trim();
}

/** نص البحث: بدون تشكيل، والهمزات والتاء المربوطة موحّدة، وبدون «ال» */
export function searchKey(...parts) {
  return parts
    .join(' ')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/(^|\s)ال/g, '$1')
    .replace(/[-|_,.،]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function imagesOf(x) {
  const out = (x.images || []).map((im) => hires(im.url || '')).filter(Boolean);
  if (!out.length && x.largeThumbnail) out.push(hires(x.largeThumbnail));
  if (!out.length && x.thumbnail) out.push(hires(x.thumbnail));
  return out;
}
const catsOf = (sec) => (sec?.categories || []).map((c) => c.title).filter((t) => t !== 'الكل');
const summaryOf = (x) => x.meta?.description || plain(x.summary || '').slice(0, 200);

export function normPlace(x) {
  const sec = (x.sections || [])[0];
  const city = SECTION_TO_CITY[sec?.id];
  if (!city) return null;
  const cats = catsOf(sec);
  const kinds = [...new Set(cats.map((c) => KIND_OF[c]).filter(Boolean))].sort();
  const [title, title_en] = splitTitle(x.title);
  const images = imagesOf(x);
  return {
    id: x.id, city, title, title_en, slug: x.slug || '', cats, kinds,
    summary: summaryOf(x), body: cleanBody(x.content), images,
    thumb: thumb(x.thumbnail || images[0] || ''),
    lat: x.latitude || null, lng: x.longitude || null,
    address: x.address || '', phone: x.phoneNumber || '', website: x.website || '', email: x.email || '',
    url: x.url || '', comments: !!x.commentsEnabled, premium: x.accessTier === 'premium',
    search: searchKey(title, title_en, cats.join(' ')),
  };
}

/** كل التواريخ بصيغة UTC موحّدة (قودبابر يرسلها بتوقيت باريس) — العرض بتوقيت مكة في التطبيق */
const utc = (d) => { if (!d) return ''; const t = new Date(d); return isNaN(t) ? '' : t.toISOString(); };

export function normEvent(x) {
  const images = imagesOf(x);
  return {
    id: x.id, title: x.title || '', summary: summaryOf(x), body: cleanBody(x.content), images,
    thumb: thumb(x.thumbnail || images[0] || ''), start: utc(x.sortDate || x.date), end: utc(x.endDate),
    all_day: !!x.allDay, cats: catsOf((x.sections || [])[0]), city: nearestCity(x.latitude, x.longitude),
    lat: x.latitude || null, lng: x.longitude || null, address: x.address || '',
    tickets: x.urlShop || '', link: x.urlEvent || '', url: x.url || '',
  };
}

export function normArticle(x) {
  const sec = (x.sections || [])[0];
  const images = imagesOf(x);
  return {
    id: x.id, title: x.title || '', author: x.author || '', date: utc(x.date), summary: summaryOf(x),
    body: cleanBody(x.content), images, thumb: thumb(x.thumbnail || images[0] || ''),
    cats: catsOf(sec), section: sec?.title || '', url: x.url || '',
  };
}

export function km(a, b, c, d) {
  const R = 6371, x = ((c - a) * Math.PI) / 180, y = ((d - b) * Math.PI) / 180;
  const h = Math.sin(x / 2) ** 2 + Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
const EVENT_SKIP = new Set(['diriyah', 'riyadh-region', 'asir-region']); // الفعاليات تُنسب للمدينة الكبيرة
export function nearestCity(lat, lng) {
  if (!lat || !lng) return null;
  let best = null, bd = Infinity;
  for (const c of CITIES) {
    if (EVENT_SKIP.has(c[0])) continue;
    const d = km(lat, lng, c[4], c[5]);
    if (d < bd) { bd = d; best = c[0]; }
  }
  return bd < 150 ? best : null;
}
