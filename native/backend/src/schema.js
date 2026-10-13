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
  "CREATE TABLE IF NOT EXISTS blocks ( user_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, blocked_id) )"
];

let ready = false;
/** ينشئ الجداول مرة وحدة لكل نسخة من الوركر */
export async function ensureSchema(env) {
  if (ready) return;
  await env.DB.batch(STATEMENTS.map((s) => env.DB.prepare(s)));
  ready = true;
}
