/* صور أغلفة المدن المرخّصة (شوترستوك + Unsplash): تطلع في بطاقة المدينة وأعلى صفحتها
   - الصور الأصلية بالمقاس الكامل وشهادات الرخص في مجلد «صور-المدن» على جهاز رامي
   - النسخ المصغّرة (عرض 1800) داخل app/public/cities وتنرفع مع موقع الويب
   - غلاف أي مدينة مو في القائمة يبقى من قاعدة البيانات (cities.cover)
   - لتبديل صورة: حط الملف الجديد بنفس الاسم وارفع رقم V عشان الجوالات تجيب الجديدة */
const BASE = 'https://saudi-guide-web.saudi-guide2030.workers.dev/cities/';
const V = 1;
/* الخمس الأخيرة صور التطبيق القديم المجانية (Unsplash/Pexels) — اسم المصوّر يطلع تحت الصورة من CREDIT في صفحة المدينة */
const IDS = ['jeddah', 'riyadh', 'diriyah', 'asir-region', 'qassim-region', 'eastern-region', 'taif', 'jizan', 'riyadh-region', 'albaha', 'najran',
  'alula', 'abha', 'medina', 'makkah-region', 'tabuk-region', 'umluj'];
export const CITY_COVERS = Object.fromEntries(IDS.map((id) => [id, `${BASE}${id}.jpg?v=${V}`]));

/** يركّب الأغلفة المرخّصة على صفوف المدن */
export const withCovers = (rows) => rows.map((c) => (CITY_COVERS[c.id] ? { ...c, cover: CITY_COVERS[c.id] } : c));
