<div dir="rtl">

# مرجع سيرفر دليل السعودية

كل الردود JSON، والقراءة عامة مع كاش. مسارات `/admin/*` تحتاج الترويسة `X-Admin-Key`.

## القراءة
| المسار | الوصف |
|---|---|
| `GET /v1/home` | المدن + مختارات الأسبوع + الفعاليات القادمة + آخر الأخبار |
| `GET /v1/cities` | المدن والمناطق (21) مع عدد الأماكن والغلاف |
| `GET /v1/cities/:id/places?kind=&q=&page=&per=` | أماكن المدينة. `kind`: sights, heritage, islamic, nature, fun, food, cafe, shopping |
| `GET /v1/places/:id` | المكان كامل: الصور، النص، التواصل، الإحداثيات |
| `GET /v1/places?ids=1,2,3` | عدة أماكن (لـ«رحلتي») بنفس الترتيب |
| `GET /v1/search?q=` | بحث عربي (بدون تشكيل/همزات/«ال») |
| `GET /v1/nearby?lat=&lng=&km=` | الأقرب أولاً مع المسافة |
| `GET /v1/events?city=` | القادمة أولاً، بعدها المستمرة |
| `GET /v1/events/:id` | الفعالية كاملة مع رابط التذاكر |
| `GET /v1/articles?page=` · `GET /v1/articles/:id` | الأخبار |
| `GET /v1/meta` | آخر تحديث للمحتوى |

## الأجهزة
| المسار | الوصف |
|---|---|
| `POST /v1/devices` | `{token: "ExponentPushToken[...]", platform, cities: ["medina", ...]}` |

## الإدارة
| المسار | الوصف |
|---|---|
| `POST /admin/sync` | مزامنة فورية من قودبابر |
| `POST /admin/import` | استيراد JSON بشكل قودبابر `{maps, events, articles, full?}` |
| `POST /admin/weekly` | قائمة مختارات الأسبوع `{pool: [{id, s: "w"/"s"/"a", x?: 1}]}` |
| `GET /admin/status` | العدادات + آخر 10 مزامنات |

</div>
