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
