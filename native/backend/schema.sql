-- مخطط قاعدة بيانات دليل السعودية (Cloudflare D1)
-- المرحلة 1: المحتوى (منسوخ من قودبابر بالمزامنة) + أجهزة الإشعارات + سجل المزامنة.
-- جداول المجتمع (الحسابات، الرحلات، التقييمات) تنضاف في المرحلة 2 بملف ترحيل مستقل.
-- الوركر ينشئ الجداول تلقائياً عند أول طلب (CREATE IF NOT EXISTS)، وهذا الملف للمرجع والبيئة التجريبية.

CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,          -- نفس رابط القسم في الموقع: riyadh, medina ...
  name TEXT NOT NULL,
  gb_section INTEGER NOT NULL,  -- رقم القسم في قودبابر
  color TEXT,
  lat REAL, lng REAL,
  kind TEXT NOT NULL DEFAULT 'city', -- city | region
  cover TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY,       -- نفس رقم المكان في قودبابر
  city TEXT NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  slug TEXT,
  cats TEXT NOT NULL DEFAULT '[]',   -- تصنيفات قودبابر كما هي (JSON)
  kinds TEXT NOT NULL DEFAULT '[]',  -- الأنواع الموحّدة الثمانية (JSON)
  summary TEXT,
  body TEXT,                    -- HTML منظّف
  images TEXT NOT NULL DEFAULT '[]',
  thumb TEXT,
  lat REAL, lng REAL,
  address TEXT, phone TEXT, website TEXT, email TEXT,
  url TEXT,                     -- رابط الصفحة في الموقع (للمشاركة)
  comments INTEGER NOT NULL DEFAULT 1,
  premium INTEGER NOT NULL DEFAULT 0,
  search TEXT,                  -- نص بحث مطبّع (بدون تشكيل/همزات) يملؤه الوركر
  sig TEXT,                     -- بصمة المحتوى: نعرف منها إذا تعدّل في قودبابر
  updated INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS places_city ON places(city, deleted);
CREATE INDEX IF NOT EXISTS places_geo ON places(lat, lng);
CREATE INDEX IF NOT EXISTS places_upd ON places(updated);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT, body TEXT,
  images TEXT NOT NULL DEFAULT '[]', thumb TEXT,
  start TEXT, "end" TEXT, all_day INTEGER NOT NULL DEFAULT 0,
  cats TEXT NOT NULL DEFAULT '[]',
  city TEXT,                    -- أقرب مدينة (يحسبها الوركر من الإحداثيات)
  lat REAL, lng REAL, address TEXT,
  tickets TEXT, link TEXT, url TEXT,
  sig TEXT,
  updated INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS events_start ON events(start);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT, date TEXT,
  summary TEXT, body TEXT,
  images TEXT NOT NULL DEFAULT '[]', thumb TEXT,
  cats TEXT NOT NULL DEFAULT '[]',
  section TEXT, url TEXT,
  sig TEXT,
  updated INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS articles_date ON articles(date);

-- أجهزة الإشعارات (Expo Push). user_id يتعبّى بعد ما نبني الحسابات.
CREATE TABLE IF NOT EXISTS devices (
  token TEXT PRIMARY KEY,
  platform TEXT,
  cities TEXT NOT NULL DEFAULT '[]',   -- المدن اللي يهتم فيها (للإشعارات الموجّهة)
  user_id TEXT,
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL
);

-- كل تشغيل للمزامنة: متى، وكم عنصر انضاف/تعدّل/انحذف، وهل أرسلنا إشعار
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  source TEXT NOT NULL,         -- cron | manual | import
  added INTEGER NOT NULL DEFAULT 0,
  changed INTEGER NOT NULL DEFAULT 0,
  removed INTEGER NOT NULL DEFAULT 0,
  note TEXT
);

CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);

-- الحسابات (المرحلة 2): الدخول بآبل أو قوقل. ما نحفظ كلمات مرور.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  apple_sub TEXT UNIQUE,
  google_sub TEXT UNIQUE,
  email TEXT,
  name TEXT,
  handle TEXT UNIQUE,
  city TEXT,
  bio TEXT,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'user',   -- user | guide | admin
  points INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

-- رحلتي: الأماكن المحفوظة لكل مستخدم بالترتيب
CREATE TABLE IF NOT EXISTS user_trip (
  user_id TEXT NOT NULL,
  place_id INTEGER NOT NULL,
  pos INTEGER NOT NULL DEFAULT 0,
  added INTEGER NOT NULL,
  PRIMARY KEY (user_id, place_id)
);

-- المجتمع: الحذف = إخفاء (status)، وما نحذف صفوف
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'question',   -- question | tip | photo
  city TEXT,
  place_id INTEGER,
  text TEXT NOT NULL,
  photo TEXT,
  answers INTEGER NOT NULL DEFAULT 0,
  thanks INTEGER NOT NULL DEFAULT 0,
  best_answer INTEGER,
  reports INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'visible',  -- visible | hidden
  hidden_by TEXT,                          -- owner | reports | admin | account
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_feed ON posts(status, city, id);
CREATE INDEX IF NOT EXISTS posts_user ON posts(user_id, created);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  thanks INTEGER NOT NULL DEFAULT 0,
  reports INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'visible',
  hidden_by TEXT,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS answers_post ON answers(post_id, status);
CREATE INDEX IF NOT EXISTS answers_user ON answers(user_id, created);

CREATE TABLE IF NOT EXISTS thanks (
  user_id TEXT NOT NULL,
  target TEXT NOT NULL,      -- p | a
  target_id INTEGER NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, target, target_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  target TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  reason TEXT,
  created INTEGER NOT NULL,
  UNIQUE (user_id, target, target_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  user_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, blocked_id)
);

-- الإشعارات داخل التطبيق (إجابة على سؤالك، شكر، أفضل إجابة، رسائل الإدارة)
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,          -- answer | thanks | best | system
  actor_id TEXT,
  post_id INTEGER,
  text TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notif_user ON notifications(user_id, id);

-- جواز السعودية: زيارات مؤكدة بالموقع (المستخدم كان على بعد أقل من 500 متر)
CREATE TABLE IF NOT EXISTS visits (
  user_id TEXT NOT NULL,
  place_id INTEGER NOT NULL,
  city TEXT NOT NULL,
  dist INTEGER,
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, place_id)
);
CREATE INDEX IF NOT EXISTS visits_user ON visits(user_id, created);

-- المدن اللي يتابعها المستخدم (للإشعارات والصفحة الرئيسية)
CREATE TABLE IF NOT EXISTS user_cities (
  user_id TEXT NOT NULL,
  city TEXT NOT NULL,
  PRIMARY KEY (user_id, city)
);

-- «أنا رايح» للفعاليات
CREATE TABLE IF NOT EXISTS event_going (
  user_id TEXT NOT NULL,
  event_id INTEGER NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS going_event ON event_going(event_id);

-- بوابة التجار: كل تاجر مربوط بحساب مستخدم. الطلب يبدأ pending لين توافق الإدارة
CREATE TABLE IF NOT EXISTS merchants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT,
  kind TEXT NOT NULL DEFAULT 'restaurant',   -- restaurant | cafe | sweets | shop | experience
  city TEXT NOT NULL,
  area TEXT,
  lat REAL,
  lng REAL,
  place_id INTEGER,                          -- يربطه المشرف بمكان موجود في الدليل
  photos TEXT NOT NULL DEFAULT '[]',
  hours TEXT,
  phone TEXT,
  cr TEXT,                                   -- السجل التجاري أو معروف
  verified INTEGER NOT NULL DEFAULT 0,
  max_coupons INTEGER NOT NULL DEFAULT 1,    -- الباقة المجانية: كوبون واحد فعّال
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | rejected | hidden
  note TEXT,                                 -- ملاحظة الإدارة للتاجر (سبب الرفض مثلاً)
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS merchants_status ON merchants(status, city);

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'percent',      -- percent | amount | bogo | gift
  value TEXT,                                -- 20 (للنسبة/المبلغ) أو نص الهدية
  title TEXT NOT NULL,
  terms TEXT,
  min_order INTEGER,
  per_user INTEGER NOT NULL DEFAULT 1,       -- 1 = مرة وحدة لكل مستخدم
  qty INTEGER,                               -- العدد المتاح (فاضي = بدون حد)
  used INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  hours TEXT,
  start TEXT,
  "end" TEXT,
  points INTEGER,                            -- يتبادل بالنقاط (فاضي = مجاني)
  min_level INTEGER,                         -- حصري لمستوى معيّن وأعلى
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | active | paused | rejected | hidden
  note TEXT,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS coupons_m ON coupons(merchant_id, status);

-- محفظة المستخدم (حفظ الكوبون) + آخر مرة فتح الرمز
CREATE TABLE IF NOT EXISTS coupon_saves (
  user_id TEXT NOT NULL,
  coupon_id INTEGER NOT NULL,
  opened INTEGER,
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, coupon_id)
);
CREATE INDEX IF NOT EXISTS csaves_c ON coupon_saves(coupon_id, opened);

-- كل استخدام مؤكد عند الكاشير
CREATE TABLE IF NOT EXISTS redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL,
  merchant_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS redeem_m ON redemptions(merchant_id, created);
CREATE INDEX IF NOT EXISTS redeem_u ON redemptions(user_id, coupon_id);

-- تقييمات الأماكن: تقييم واحد لكل مستخدم لكل مكان (يقدر يعدّله)
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  place_id INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  text TEXT,
  status TEXT NOT NULL DEFAULT 'visible',    -- visible | hidden
  reports INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  UNIQUE (user_id, place_id)
);
CREATE INDEX IF NOT EXISTS reviews_place ON reviews(place_id, status);

-- صور الزوار للأماكن: تنتظر موافقة المشرف قبل ما تظهر
CREATE TABLE IF NOT EXISTS place_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  place_id INTEGER NOT NULL,
  review_id INTEGER,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | rejected
  reports INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS pphotos_place ON place_photos(place_id, status);
CREATE INDEX IF NOT EXISTS pphotos_status ON place_photos(status, id);

-- رسائل الإدارة (داخل التطبيق + إشعار للجوال) مع الجدولة والسجل
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  text TEXT NOT NULL,
  link TEXT,                                 -- مسار داخل التطبيق مثل /event/123
  audience TEXT NOT NULL DEFAULT '{}',       -- {cities:[], segment:'all'|'inactive'|'new'|'guides'|'merchants'}
  inapp INTEGER NOT NULL DEFAULT 1,
  push INTEGER NOT NULL DEFAULT 1,
  at INTEGER NOT NULL,                       -- وقت الإرسال (ثواني)
  status TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled | sent | cancelled
  sent_inapp INTEGER NOT NULL DEFAULT 0,
  sent_push INTEGER NOT NULL DEFAULT 0,
  push_errors INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  sent_at INTEGER
);
CREATE INDEX IF NOT EXISTS messages_due ON messages(status, at);

-- طلبات «مرشد موثّق» (يقدر يطلبها اللي وصل 500 نقطة)
CREATE TABLE IF NOT EXISTS guide_requests (
  user_id TEXT PRIMARY KEY,
  about TEXT,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | rejected
  note TEXT,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);

-- أسئلة سريعة عن الأماكن (فيه مواقف؟ مناسب للعائلة؟) — جواب واحد لكل مستخدم لكل سؤال
CREATE TABLE IF NOT EXISTS fact_votes (
  user_id TEXT NOT NULL,
  place_id INTEGER NOT NULL,
  k TEXT NOT NULL,
  v INTEGER NOT NULL,                        -- 1 نعم، 0 لا
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, place_id, k)
);
CREATE INDEX IF NOT EXISTS facts_place ON fact_votes(place_id, k);

-- اقتراحات الزوار: تعديل مكان أو إضافة مكان ناقص — تنتظر موافقة المشرف
CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,                        -- edit | new | closed
  place_id INTEGER,
  data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | rejected
  note TEXT,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sugg_status ON suggestions(status, id);

-- حماية المستخدم من تلاعب التجار: بلاغات على الكوبونات + تقييم «انطبق العرض؟» بعد الاستخدام
CREATE TABLE IF NOT EXISTS coupon_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL,
  merchant_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,                      -- refused | different | conditions | closed | other
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | confirmed | dismissed
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS creports_c ON coupon_reports(coupon_id, status);
CREATE INDEX IF NOT EXISTS creports_m ON coupon_reports(merchant_id, status);

CREATE TABLE IF NOT EXISTS coupon_feedback (
  user_id TEXT NOT NULL,
  coupon_id INTEGER NOT NULL,
  merchant_id INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, coupon_id)
);
CREATE INDEX IF NOT EXISTS cfeedback_m ON coupon_feedback(merchant_id);

-- موافقات التجار على الشروط والأحكام (سجل دائم: النسخة والوقت والجهاز) — دليل عند أي خلاف
CREATE TABLE IF NOT EXISTS merchant_agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  merchant_id INTEGER,
  version TEXT NOT NULL,
  ip TEXT,
  ua TEXT,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS magree_user ON merchant_agreements(user_id, id);

-- قياس الاستخدام (مجهول الهوية): عدّادات يومية بدل تسجيل كل حدث — خفيفة وما فيها بيانات شخصية
CREATE TABLE IF NOT EXISTS stats_daily (
  day TEXT NOT NULL,                         -- YYYY-MM-DD بتوقيت مكة
  metric TEXT NOT NULL,                      -- open | place | event | search | search_empty | coupon | share | directions | trip_add | city | platform | version
  k TEXT NOT NULL DEFAULT '',                -- رقم المكان، كلمة البحث، المدينة…
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric, k)
);
-- الأجهزة النشطة يومياً (معرّف عشوائي من التطبيق، مو مربوط بشخص) — للمستخدمين النشطين حتى الزوار بدون حساب
CREATE TABLE IF NOT EXISTS active_devices (
  day TEXT NOT NULL,
  device TEXT NOT NULL,
  platform TEXT,
  PRIMARY KEY (day, device)
);

-- جداول أضيفت لاحقاً (كانت في schema.js بس، رجعناها هنا عشان build_schema.py ما يشيلها)
CREATE TABLE IF NOT EXISTS tr ( kind TEXT NOT NULL, id INTEGER NOT NULL, lang TEXT NOT NULL, t TEXT, s TEXT, b TEXT, a TEXT, src TEXT, updated INTEGER NOT NULL, PRIMARY KEY (kind, id, lang) );
CREATE TABLE IF NOT EXISTS place_summary ( place_id INTEGER PRIMARY KEY, text TEXT NOT NULL, n INTEGER NOT NULL, updated INTEGER NOT NULL );
CREATE TABLE IF NOT EXISTS content_live ( kind TEXT NOT NULL, item_id INTEGER NOT NULL, city TEXT, title TEXT, at INTEGER NOT NULL, sent INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (kind, item_id) );
CREATE TABLE IF NOT EXISTS iap_subs ( orig_tx TEXT PRIMARY KEY, user_id TEXT NOT NULL, product TEXT NOT NULL, expires INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0, env TEXT, last_tx TEXT, updated INTEGER NOT NULL );
CREATE INDEX IF NOT EXISTS iap_subs_user ON iap_subs(user_id);
CREATE TABLE IF NOT EXISTS coupon_alerts ( user_id TEXT NOT NULL, city TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, city) );
CREATE TABLE IF NOT EXISTS contact_msgs ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, kind TEXT NOT NULL, text TEXT NOT NULL, reply_to TEXT, city TEXT, app TEXT, ip TEXT, status TEXT NOT NULL DEFAULT 'new', reply TEXT, replied INTEGER, created INTEGER NOT NULL );

-- دليل السعودية للأعمال: «سجّل اهتمامك» (business.js)
CREATE TABLE IF NOT EXISTS business_leads ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, name TEXT NOT NULL, contact TEXT NOT NULL, city TEXT, kind TEXT, plan TEXT, note TEXT, ip TEXT, status TEXT NOT NULL DEFAULT 'new', admin_note TEXT, created INTEGER NOT NULL, updated INTEGER );
CREATE INDEX IF NOT EXISTS leads_status ON business_leads(status, id);

-- العروض الرسمية: البنوك والمتاجر (offers.js)
CREATE TABLE IF NOT EXISTS offers ( id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'official', store_name TEXT NOT NULL, store_key TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'other', city TEXT NOT NULL DEFAULT '', city_raw TEXT, value REAL, unit TEXT NOT NULL DEFAULT 'pct', title TEXT NOT NULL, code TEXT, channel TEXT NOT NULL DEFAULT 'any', source_url TEXT, use_url TEXT, starts_at TEXT, expires_at TEXT, min_order REAL, max_discount REAL, new_only INTEGER NOT NULL DEFAULT 0, delivery_app TEXT, terms TEXT, status TEXT NOT NULL DEFAULT 'pending', note TEXT, origin TEXT, legacy_id TEXT, copies INTEGER NOT NULL DEFAULT 0, opens INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL );
CREATE INDEX IF NOT EXISTS offers_pub ON offers(status, city, expires_at);
CREATE INDEX IF NOT EXISTS offers_store ON offers(store_key, unit, value);

-- تعليقات الأخبار (comments.js)
CREATE TABLE IF NOT EXISTS article_comments ( id INTEGER PRIMARY KEY AUTOINCREMENT, article_id INTEGER NOT NULL, user_id TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'visible', reason TEXT, mod_by TEXT, reports INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL );
CREATE INDEX IF NOT EXISTS acomments_article ON article_comments(article_id, status, id);
CREATE INDEX IF NOT EXISTS acomments_status ON article_comments(status, id);
CREATE TABLE IF NOT EXISTS comment_reports ( comment_id INTEGER NOT NULL, user_id TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (comment_id, user_id) );

-- الصحف السعودية (papers.js): المصادر، الأخبار (عنوان وصورة وسطرين ورابط بس)، ومتابعات الحسابات
CREATE TABLE IF NOT EXISTS news_sources ( id TEXT PRIMARY KEY, name TEXT NOT NULL, site TEXT, feed TEXT NOT NULL, lang TEXT NOT NULL DEFAULT 'ar', logo TEXT, status TEXT NOT NULL DEFAULT 'active', sort INTEGER NOT NULL DEFAULT 50, last_fetch INTEGER, last_ok INTEGER, last_error TEXT, fails INTEGER NOT NULL DEFAULT 0, items INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL );
CREATE TABLE IF NOT EXISTS news_items ( id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, guid TEXT NOT NULL, title TEXT NOT NULL, link TEXT NOT NULL, image TEXT, snippet TEXT, published INTEGER NOT NULL, fetched INTEGER NOT NULL, opens INTEGER NOT NULL DEFAULT 0, UNIQUE(source, guid) );
CREATE INDEX IF NOT EXISTS news_items_pub ON news_items(published DESC);
CREATE INDEX IF NOT EXISTS news_items_src ON news_items(source, published DESC);
CREATE INDEX IF NOT EXISTS news_items_fetched ON news_items(fetched);
CREATE TABLE IF NOT EXISTS news_follows ( user_id TEXT NOT NULL, source TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, source) );

-- دخول لوحة التحكم بالحساب (adminauth.js): كل محاولة دخول ناجحة أو مرفوضة
CREATE TABLE IF NOT EXISTS admin_logins ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, email TEXT, provider TEXT, ok INTEGER NOT NULL, reason TEXT, ip TEXT, ua TEXT, at INTEGER NOT NULL );
CREATE INDEX IF NOT EXISTS admin_logins_at ON admin_logins(at DESC);

-- «ادعُ صديق» (invite.js): مين دعا مين، وهل انعطت المكافأة
CREATE TABLE IF NOT EXISTS referrals ( invitee_id TEXT PRIMARY KEY, inviter_id TEXT NOT NULL, code TEXT NOT NULL, rewarded INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL );
CREATE INDEX IF NOT EXISTS referrals_inviter ON referrals(inviter_id, created);
