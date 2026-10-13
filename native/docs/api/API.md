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

## المجتمع (v0.3.0)

كل طلبات الكتابة تحتاج `Authorization: Bearer <رمز الجلسة>`. الحذف = إخفاء (`status='hidden'`)، ما نحذف صفوف.

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/v1/community?city=&kind=&before=&mine=1` | آخر 20 مشاركة (يستثني المحظورين لو فيه جلسة) |
| GET | `/v1/community/top?city=` | أكثر 3 جاوبوا آخر 30 يوم |
| POST | `/v1/community` | `{kind: question|tip|photo, city, text, photo?, placeId?}` (+2 نقاط، 15 باليوم) |
| GET | `/v1/community/:id` | المشاركة مع إجاباتها |
| DELETE | `/v1/community/:id` و `/v1/community/answers/:id` | صاحبها يخفيها |
| POST | `/v1/community/:id/answers` | `{text}` (+5 نقاط) |
| POST | `/v1/community/:id/thanks` و `/v1/community/answers/:id/thanks` | شكر/إلغاء (+1 لصاحبها) |
| POST | `/v1/community/:id/best` | `{answerId|null}` صاحب السؤال فقط (+15) |
| POST | `/v1/community/report` | `{target: p|a, id, reason}` — 3 بلاغات = إخفاء تلقائي |
| POST/DELETE | `/v1/community/block` | `{userId}` حظر/فك حظر |
| POST | `/v1/community/upload` | جسم الطلب صورة (jpeg/png/webp حتى 6MB) → `{url}` في R2 |
| GET | `/media/<key>` | يعرض صور R2 |

الإدارة (`X-Admin-Key`): `GET /admin/community/reported`، `POST /admin/community/moderate {target, id, hidden}`، `POST /admin/community/role {userId, role: user|guide|admin}`.
