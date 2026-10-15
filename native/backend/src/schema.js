/* مولّد تلقائياً من schema.sql — لا تعدّله يدوياً (شغّل: python3 scripts/build_schema.py) */
const STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS cities ( id TEXT PRIMARY KEY, name TEXT NOT NULL, gb_section INTEGER NOT NULL, color TEXT, lat REAL, lng REAL, kind TEXT NOT NULL DEFAULT 'city', cover TEXT, sort INTEGER NOT NULL DEFAULT 0 )",
  "CREATE TABLE IF NOT EXISTS places ( id INTEGER PRIMARY KEY, city TEXT NOT NULL, title TEXT NOT NULL, title_en TEXT, slug TEXT, cats TEXT NOT NULL DEFAULT '[]', kinds TEXT NOT NULL DEFAULT '[]', summary TEXT, body TEXT, images TEXT NOT NULL DEFAULT '[]', thumb TEXT, lat REAL, lng REAL, address TEXT, phone TEXT, website TEXT, email TEXT, url TEXT, comments INTEGER NOT NULL DEFAULT 1, premium INTEGER NOT NULL DEFAULT 0, search TEXT, sig TEXT, updated INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0 )",
  "CREATE INDEX IF NOT EXISTS places_city ON places(city, deleted)",
  "CREATE INDEX IF NOT EXISTS places_geo ON places(lat, lng)",
  "CREATE INDEX IF NOT EXISTS places_upd ON places(updated)",
  "CREATE TABLE IF NOT EXISTS events ( id INTEGER PRIMARY KEY, title TEXT NOT NULL, summary TEXT, body TEXT, images TEXT NOT NULL DEFAULT '[]', thumb TEXT, start TEXT, \"end\" TEXT, all_day INTEGER NOT NULL DEFAULT 0, cats TEXT NOT NULL DEFAULT '[]', city TEXT, lat REAL, lng REAL, address TEXT, tickets TEXT, link TEXT, url TEXT, sig TEXT, updated INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0 )",
  "CREATE INDEX IF NOT EXISTS events_start ON events(start)",
  "CREATE TABLE IF NOT EXISTS articles ( id INTEGER PRIMARY KEY, title TEXT NOT NULL, author TEXT, date TEXT, summary TEXT, body TEXT, images TEXT NOT NULL DEFAULT '[]', thumb TEXT, cats TEXT NOT NULL DEFAULT '[]', section TEXT, url TEXT, sig TEXT, updated INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0 )",
  "CREATE INDEX IF NOT EXISTS articles_date ON articles(date)",
  "CREATE TABLE IF NOT EXISTS iap_subs ( orig_tx TEXT PRIMARY KEY, user_id TEXT NOT NULL, product TEXT NOT NULL, expires INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0, env TEXT, last_tx TEXT, updated INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS iap_subs_user ON iap_subs(user_id)",
  "CREATE TABLE IF NOT EXISTS coupon_alerts ( user_id TEXT NOT NULL, city TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, city) )",
  "CREATE TABLE IF NOT EXISTS contact_msgs ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, kind TEXT NOT NULL, text TEXT NOT NULL, reply_to TEXT, city TEXT, app TEXT, ip TEXT, status TEXT NOT NULL DEFAULT 'new', reply TEXT, replied INTEGER, created INTEGER NOT NULL )",
  "CREATE TABLE IF NOT EXISTS devices ( token TEXT PRIMARY KEY, platform TEXT, cities TEXT NOT NULL DEFAULT '[]', user_id TEXT, created INTEGER NOT NULL, seen INTEGER NOT NULL )",
  "CREATE TABLE IF NOT EXISTS sync_log ( id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, source TEXT NOT NULL, added INTEGER NOT NULL DEFAULT 0, changed INTEGER NOT NULL DEFAULT 0, removed INTEGER NOT NULL DEFAULT 0, note TEXT )",
  "CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS users ( id TEXT PRIMARY KEY, apple_sub TEXT UNIQUE, google_sub TEXT UNIQUE, email TEXT, name TEXT, handle TEXT UNIQUE, city TEXT, bio TEXT, avatar TEXT, role TEXT NOT NULL DEFAULT 'user', points INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, seen INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0 )",
  "CREATE TABLE IF NOT EXISTS user_trip ( user_id TEXT NOT NULL, place_id INTEGER NOT NULL, pos INTEGER NOT NULL DEFAULT 0, added INTEGER NOT NULL, PRIMARY KEY (user_id, place_id) )",
  "CREATE TABLE IF NOT EXISTS posts ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'question', city TEXT, place_id INTEGER, text TEXT NOT NULL, photo TEXT, answers INTEGER NOT NULL DEFAULT 0, thanks INTEGER NOT NULL DEFAULT 0, best_answer INTEGER, reports INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'visible', hidden_by TEXT, created INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS posts_feed ON posts(status, city, id)",
  "CREATE INDEX IF NOT EXISTS posts_user ON posts(user_id, created)",
  "CREATE TABLE IF NOT EXISTS answers ( id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, user_id TEXT NOT NULL, text TEXT NOT NULL, thanks INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'visible', hidden_by TEXT, created INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS answers_post ON answers(post_id, status)",
  "CREATE INDEX IF NOT EXISTS answers_user ON answers(user_id, created)",
  "CREATE TABLE IF NOT EXISTS thanks ( user_id TEXT NOT NULL, target TEXT NOT NULL, target_id INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, target, target_id) )",
  "CREATE TABLE IF NOT EXISTS reports ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, target TEXT NOT NULL, target_id INTEGER NOT NULL, reason TEXT, created INTEGER NOT NULL, UNIQUE (user_id, target, target_id) )",
  "CREATE TABLE IF NOT EXISTS blocks ( user_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, blocked_id) )",
  "CREATE TABLE IF NOT EXISTS notifications ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, type TEXT NOT NULL, actor_id TEXT, post_id INTEGER, text TEXT, read INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS notif_user ON notifications(user_id, id)",
  "CREATE TABLE IF NOT EXISTS visits ( user_id TEXT NOT NULL, place_id INTEGER NOT NULL, city TEXT NOT NULL, dist INTEGER, created INTEGER NOT NULL, PRIMARY KEY (user_id, place_id) )",
  "CREATE INDEX IF NOT EXISTS visits_user ON visits(user_id, created)",
  "CREATE TABLE IF NOT EXISTS user_cities ( user_id TEXT NOT NULL, city TEXT NOT NULL, PRIMARY KEY (user_id, city) )",
  "CREATE TABLE IF NOT EXISTS event_going ( user_id TEXT NOT NULL, event_id INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, event_id) )",
  "CREATE INDEX IF NOT EXISTS going_event ON event_going(event_id)",
  "CREATE TABLE IF NOT EXISTS merchants ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, name_en TEXT, kind TEXT NOT NULL DEFAULT 'restaurant', city TEXT NOT NULL, area TEXT, lat REAL, lng REAL, place_id INTEGER, photos TEXT NOT NULL DEFAULT '[]', hours TEXT, phone TEXT, cr TEXT, verified INTEGER NOT NULL DEFAULT 0, max_coupons INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'pending', note TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS merchants_status ON merchants(status, city)",
  "CREATE TABLE IF NOT EXISTS coupons ( id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'percent', value TEXT, title TEXT NOT NULL, terms TEXT, min_order INTEGER, per_user INTEGER NOT NULL DEFAULT 1, qty INTEGER, used INTEGER NOT NULL DEFAULT 0, views INTEGER NOT NULL DEFAULT 0, hours TEXT, start TEXT, \"end\" TEXT, points INTEGER, min_level INTEGER, status TEXT NOT NULL DEFAULT 'pending', note TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS coupons_m ON coupons(merchant_id, status)",
  "CREATE TABLE IF NOT EXISTS coupon_saves ( user_id TEXT NOT NULL, coupon_id INTEGER NOT NULL, opened INTEGER, created INTEGER NOT NULL, PRIMARY KEY (user_id, coupon_id) )",
  "CREATE INDEX IF NOT EXISTS csaves_c ON coupon_saves(coupon_id, opened)",
  "CREATE TABLE IF NOT EXISTS redemptions ( id INTEGER PRIMARY KEY AUTOINCREMENT, coupon_id INTEGER NOT NULL, merchant_id INTEGER NOT NULL, user_id TEXT NOT NULL, created INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS redeem_m ON redemptions(merchant_id, created)",
  "CREATE INDEX IF NOT EXISTS redeem_u ON redemptions(user_id, coupon_id)",
  "CREATE TABLE IF NOT EXISTS reviews ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, place_id INTEGER NOT NULL, stars INTEGER NOT NULL, tags TEXT NOT NULL DEFAULT '[]', text TEXT, status TEXT NOT NULL DEFAULT 'visible', reports INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL, UNIQUE (user_id, place_id) )",
  "CREATE INDEX IF NOT EXISTS reviews_place ON reviews(place_id, status)",
  "CREATE TABLE IF NOT EXISTS place_photos ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, place_id INTEGER NOT NULL, review_id INTEGER, url TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reports INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS pphotos_place ON place_photos(place_id, status)",
  "CREATE INDEX IF NOT EXISTS pphotos_status ON place_photos(status, id)",
  "CREATE TABLE IF NOT EXISTS messages ( id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, text TEXT NOT NULL, link TEXT, audience TEXT NOT NULL DEFAULT '{}', inapp INTEGER NOT NULL DEFAULT 1, push INTEGER NOT NULL DEFAULT 1, at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled', sent_inapp INTEGER NOT NULL DEFAULT 0, sent_push INTEGER NOT NULL DEFAULT 0, push_errors INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, sent_at INTEGER )",
  "CREATE INDEX IF NOT EXISTS messages_due ON messages(status, at)",
  "CREATE TABLE IF NOT EXISTS guide_requests ( user_id TEXT PRIMARY KEY, about TEXT, status TEXT NOT NULL DEFAULT 'pending', note TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL )",
  "CREATE TABLE IF NOT EXISTS fact_votes ( user_id TEXT NOT NULL, place_id INTEGER NOT NULL, k TEXT NOT NULL, v INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, place_id, k) )",
  "CREATE INDEX IF NOT EXISTS facts_place ON fact_votes(place_id, k)",
  "CREATE TABLE IF NOT EXISTS suggestions ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, type TEXT NOT NULL, place_id INTEGER, data TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'pending', note TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS sugg_status ON suggestions(status, id)",
  "CREATE TABLE IF NOT EXISTS coupon_reports ( id INTEGER PRIMARY KEY AUTOINCREMENT, coupon_id INTEGER NOT NULL, merchant_id INTEGER NOT NULL, user_id TEXT NOT NULL, reason TEXT NOT NULL, note TEXT, status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, updated INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS creports_c ON coupon_reports(coupon_id, status)",
  "CREATE INDEX IF NOT EXISTS creports_m ON coupon_reports(merchant_id, status)",
  "CREATE TABLE IF NOT EXISTS coupon_feedback ( user_id TEXT NOT NULL, coupon_id INTEGER NOT NULL, merchant_id INTEGER NOT NULL, ok INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, coupon_id) )",
  "CREATE INDEX IF NOT EXISTS cfeedback_m ON coupon_feedback(merchant_id)",
  "CREATE TABLE IF NOT EXISTS merchant_agreements ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, merchant_id INTEGER, version TEXT NOT NULL, ip TEXT, ua TEXT, created INTEGER NOT NULL )",
  "CREATE INDEX IF NOT EXISTS magree_user ON merchant_agreements(user_id, id)",
  "CREATE TABLE IF NOT EXISTS stats_daily ( day TEXT NOT NULL, metric TEXT NOT NULL, k TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, metric, k) )",
  "CREATE TABLE IF NOT EXISTS active_devices ( day TEXT NOT NULL, device TEXT NOT NULL, platform TEXT, PRIMARY KEY (day, device) )"
];

/* أعمدة جديدة على جداول قديمة (لو العمود موجود يطلع خطأ ونتجاهله) */
const ALTERS = [
  'ALTER TABLE notifications ADD COLUMN link TEXT',
  'ALTER TABLE coupons ADD COLUMN points INTEGER',
  'ALTER TABLE coupons ADD COLUMN min_level INTEGER',
  'ALTER TABLE users ADD COLUMN spent INTEGER NOT NULL DEFAULT 0', // نقاط انصرفت على كوبونات (المستوى يحسب على كل اللي جمعها)
  // «تأثيرك»: كم مرة انشافت مساهمات المستخدم
  'ALTER TABLE posts ADD COLUMN views INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE reviews ADD COLUMN views INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE place_photos ADD COLUMN views INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE merchants ADD COLUMN strikes INTEGER NOT NULL DEFAULT 0', // مخالفات مؤكدة على التاجر (3 = إيقاف)
  'ALTER TABLE merchants ADD COLUMN terms_version TEXT', // آخر نسخة شروط وافق عليها
  'ALTER TABLE merchants ADD COLUMN terms_at INTEGER',
  'ALTER TABLE coupons ADD COLUMN license TEXT', // رقم ترخيص التخفيضات من وزارة التجارة
  'ALTER TABLE coupons ADD COLUMN declared_at INTEGER', // وقت إقرار التاجر بالترخيص والمسؤولية
  // المراجعة الذكية لـ«اسأل أهل المدينة»: مين قرر (filter|ai|off|error|admin_ok|admin_no) والسبب
  'ALTER TABLE posts ADD COLUMN mod TEXT',
  'ALTER TABLE posts ADD COLUMN mod_reason TEXT',
  'ALTER TABLE answers ADD COLUMN mod TEXT',
  'ALTER TABLE answers ADD COLUMN mod_reason TEXT',
  'ALTER TABLE suggestions ADD COLUMN ai TEXT', // فرز وتجهيز المراجعة الذكية لاقتراح المكان
  'ALTER TABLE places ADD COLUMN added_by TEXT', // المستخدم اللي اقترح المكان (يطلع اسمه في صفحة المكان)
  'ALTER TABLE users ADD COLUMN plus_until INTEGER', // اشتراك دليل+ (أو منحة من المشرف) لين هالوقت
  'ALTER TABLE users ADD COLUMN community_ban_until INTEGER',
  'ALTER TABLE users ADD COLUMN plus_grant_until INTEGER', // منحة دليل+ من المشرف (منفصلة عن اشتراك آبل)
  // المنح القديمة كانت تنكتب في plus_until مباشرة: ننقلها للمنحة (لمن ما عنده اشتراك آبل)
  'UPDATE users SET plus_grant_until=plus_until WHERE plus_grant_until IS NULL AND plus_until IS NOT NULL AND id NOT IN (SELECT user_id FROM iap_subs)', // إيقاف مؤقت عن المشاركة في المجتمع بعد تكرار المخالفات
];

let ready = false;
/** ينشئ الجداول مرة وحدة لكل نسخة من الوركر */
export async function ensureSchema(env) {
  if (ready) return;
  await env.DB.batch(STATEMENTS.map((s) => env.DB.prepare(s)));
  for (const a of ALTERS) await env.DB.prepare(a).run().catch(() => {});
  ready = true;
}
