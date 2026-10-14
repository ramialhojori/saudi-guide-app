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

## لوحة التحكم (v0.4.0)

الصفحة: `GET /panel` (تطلب مفتاح الإدارة داخل الصفحة). المصدر: `backend/panel/panel.html` → `python3 scripts/build_panel.py` يولّد `src/panel.js`.

حالة المحتوى في عمود `deleted`: 0 منشور، 1 مخفي، 2 مسودة. أي جديد يبدأ مسودة. أي تعديل من اللوحة يعلّم `sig='panel'` ومزامنة قودبابر تتجاهله.

| الطريقة | المسار |
|---|---|
| GET | `/admin/meta`، `/admin/summary` |
| GET/POST | `/admin/places?city=&status=&q=&missing=photo|geo&page=` |
| GET/PUT | `/admin/places/:id` |
| GET/POST | `/admin/events?when=upcoming|past|all&status=&city=&q=` |
| GET/PUT | `/admin/events/:id` |
| POST | `/admin/(places|events)/:id/status` `{status: live|draft|hidden}` |
| POST | `/admin/upload` (صورة → R2) |
| GET | `/admin/users?q=` |

## إضافات v0.5.0

| الطريقة | المسار | الوصف |
|---|---|---|
| GET/POST | `/v1/me/notifications` | الإشعارات داخل التطبيق (POST = قراءة الكل) |
| POST | `/v1/me/visits` | `{placeId, lat, lng}` ختم الزيارة (أقل من 500 م) — +10 نقاط، +25 لمدينة جديدة |
| GET | `/v1/me/passport` | المدن المختومة وآخر الزيارات |
| GET/PUT | `/v1/me/cities` | المدن اللي يتابعها المستخدم |
| GET | `/v1/community/place/:id` | ملخص المكان: كم زاره، وأفضل نصيحة، وعدد المشاركات |
| GET | `/v1/community?place=ID` | مشاركات مكان معيّن |
| GET/POST | `/v1/events/:id/going` | «أنا رايح» |
| GET | `/v1/events/:id.ics` | ملف تقويم مع تنبيه |

الإدارة: `/admin/places/similar`، `/admin/(places|events)/bulk` (مسودات، للمساعد)، `/admin/weekly`، `/admin/articles`، `/admin/seasons`، `/admin/notify`، `/admin/community/posts`.

## الإصدار 0.6.0 — التجار والكوبونات، التقييمات، الرسائل

### الكوبونات (عام)
- `GET /v1/coupons?city=&place=&merchant=` — الكوبونات الفعّالة (المعتمدة والسارية ولم تخلص)
- `GET /v1/coupons/:id` — تفاصيل + `usedByMe` (يزيد عدد المشاهدات)
- `POST /v1/coupons/:id/save` — حفظ/إلغاء في المحفظة (دخول)
- `GET /v1/coupons/:id/code?since=` — الرمز المتغير كل 30 ثانية (HMAC بسر السيرفر، مربوط بالمستخدم والكوبون). يرجع `{redeemed:true}` لو الكاشير أكّد بعد `since`
- `GET /v1/me/coupons` — المحفظة

### بوابة التجار (دخول)
- `GET /v1/merchant` — النشاط + الكوبونات + الأرقام (مشاهدات، حفظ، استخدام، آخر 7 أيام)
- `POST /v1/merchant` — تسجيل أو تعديل (يبدأ pending؛ تعديل الاسم/المدينة/السجل يرجعه للمراجعة)
- `POST /v1/merchant/coupons` — كوبون جديد (pending، والحد = max_coupons)
- `POST /v1/merchant/coupons/:id` — `{action:'pause'|'resume'|'remove'}` أو تعديل كامل (يرجع pending)
- `POST /v1/merchant/redeem {code}` — الكاشير يدخل الرمز (20 محاولة خاطئة بالدقيقة كحد)

### التقييمات وصور الزوار
- `GET /v1/places/:id/reviews` — المتوسط والتوزيع والوسوم والتقييمات والصور المقبولة وتقييمي
- `POST /v1/places/:id/reviews {stars,tags,text,photos,consent}` — تقييم واحد لكل مستخدم (+3 أول مرة)، الصور تنتظر الموافقة (+5 لكل صورة تنقبل)
- `DELETE /v1/places/:id/reviews` — إخفاء تقييمي
- `POST /v1/reviews/:id/report` و `POST /v1/photos/:id/report`

### الإدارة
- `/admin/merchants` و `/admin/merchants/:id` — اعتماد/رفض/إيقاف، موثّق، عدد الكوبونات، ربط بمكان، تعديل الموقع
- `/admin/coupons` و `/admin/coupons/:id`
- `/admin/photos` و `/admin/photos/:id` و `/admin/photos/bulk`، `/admin/reviews` و `/admin/reviews/:id`
- `/admin/messages` (GET سجل، POST إرسال أو جدولة)، `/admin/messages/estimate`، `/admin/messages/:id/cancel` — داخل التطبيق + Expo Push، ساعات هدوء 11م–8ص، المجدول يرسله الكرون كل ساعة
- `/admin/analytics` — آخر 30 يوم، `/admin/badges` — الأوسمة والمستويات وأعلى المستخدمين
