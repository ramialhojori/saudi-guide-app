/* ربط Claude بلوحة دليل السعودية (MCP) — نفس فكرة ربط قودبابر:
   - رامي يضيف الرابط https://…/mcp كـ«موصل مخصص» في إعدادات Claude
   - Claude يفتح صفحة «اربط Claude بلوحتك» ورامي يلصق مفتاح الإدارة مرة وحدة (OAuth)
   - بعدها Claude يقدر يضيف ويعدّل من أي جلسة بدون ما يكون جهاز رامي مفتوح
   - الإضافة دايماً مسودات، والنشر بس لما رامي يطلبه صراحة
   الأدوات تستدعي نفس مسارات /admin اللي تستخدمها اللوحة (نفس القواعد والتحققات) */

import { adminRoute } from './admin.js';
import { merchantAdmin } from './merchants.js';
import { reviewsAdmin } from './reviews.js';
import { contribAdmin } from './contrib.js';
import { messagesAdmin } from './messages.js';
import { communityAdmin, guideAdmin } from './community.js';
import { dashboard } from './track.js';
import { seasonsAdmin } from './seasons.js';
import { aiAdmin } from './ai.js';

const now = () => Math.floor(Date.now() / 1000);
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (s) => b64u(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Expose-Headers': 'Mcp-Session-Id, WWW-Authenticate' };
const json = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...h } });

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS oauth_clients (id TEXT PRIMARY KEY, name TEXT, redirects TEXT NOT NULL, created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS oauth_codes (code TEXT PRIMARY KEY, client_id TEXT NOT NULL, redirect TEXT NOT NULL, challenge TEXT, exp INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS oauth_tokens (hash TEXT PRIMARY KEY, kind TEXT NOT NULL, client_id TEXT NOT NULL, exp INTEGER NOT NULL, created INTEGER NOT NULL)`,
];
let ready = false;
async function ensure(env) { if (!ready) { await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))); ready = true; } }

/** مقارنة بوقت ثابت (عشان ما ينعرف المفتاح من سرعة الرد) */
async function sameKey(a, b) {
  const [x, y] = await Promise.all([sha(String(a || '')), sha(String(b || ''))]);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.min(x.length, y.length); i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0 && !!b;
}

async function issueTokens(env, clientId) {
  const access = rand(), refresh = rand();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO oauth_tokens (hash,kind,client_id,exp,created) VALUES (?,?,?,?,?)').bind(await sha(access), 'access', clientId, now() + 30 * 86400, now()),
    env.DB.prepare('INSERT INTO oauth_tokens (hash,kind,client_id,exp,created) VALUES (?,?,?,?,?)').bind(await sha(refresh), 'refresh', clientId, now() + 365 * 86400, now()),
    env.DB.prepare('DELETE FROM oauth_tokens WHERE exp<?').bind(now()),
  ]);
  return { access_token: access, token_type: 'Bearer', expires_in: 30 * 86400, refresh_token: refresh, scope: 'admin' };
}

/** العميل: إما مسجّل عندنا (DCR) أو client_id رابط https لوثيقة تعريف (CIMD — «الهوية المنشورة» لـClaude) */
async function getClient(env, id) {
  const row = await env.DB.prepare('SELECT * FROM oauth_clients WHERE id=?').bind(id).first();
  if (!/^https:\/\/[^/]+\/./.test(id)) return row;
  if (row && now() - row.created < 86400) return row;
  try {
    const r = await fetch(id, { headers: { Accept: 'application/json' }, redirect: 'follow', cf: { cacheTtl: 300 } });
    if (!r.ok) return row;
    const d = await r.json();
    if (d.client_id && d.client_id !== id) return row;
    const redirects = (Array.isArray(d.redirect_uris) ? d.redirect_uris : []).map(String).filter((u) => /^https:\/\//.test(u)).slice(0, 10);
    if (!redirects.length) return row;
    await env.DB.prepare('INSERT INTO oauth_clients (id,name,redirects,created) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, redirects=excluded.redirects, created=excluded.created')
      .bind(id, String(d.client_name || '').slice(0, 100), JSON.stringify(redirects), now()).run();
    return { id, name: d.client_name || '', redirects: JSON.stringify(redirects) };
  } catch { return row; }
}

function authorizePage(params, err) {
  const hidden = ['client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'response_type', 'scope'].map((k) => `<input type="hidden" name="${k}" value="${esc(params.get(k) || '')}">`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>ربط Claude بلوحة دليل السعودية</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{margin:0;font-family:'IBM Plex Sans Arabic',system-ui,sans-serif;background:#F4F1EE;color:#2B2745}.c{max-width:420px;margin:10vh auto;background:#fff;border-radius:26px;padding:28px;text-align:center}
i{display:inline-grid;place-items:center;width:64px;height:64px;border-radius:20px;background:#604C87;color:#fff;font-style:normal;font-size:28px;margin-bottom:8px}
h1{font-size:21px;margin:6px 0}p{color:#6B6585;font-size:14px;line-height:1.8}.b{width:100%;border:0;border-radius:14px;padding:14px;font:700 16px inherit;cursor:pointer;color:#fff;background:#F89743;margin-top:8px}
.g{background:#604C87}input[type=password]{width:100%;box-sizing:border-box;border:1.5px solid #E2DAEC;border-radius:12px;padding:12px;font:inherit;margin-top:6px}.e{color:#C9506F;font-weight:700}ul{text-align:right;color:#6B6585;font-size:13px;line-height:1.9;padding-inline-start:18px}</style></head>
<body><form class="c" method="post" id="f"><i>د</i><h1>ربط Claude بلوحة دليل السعودية</h1>
<p>بعد الربط يقدر Claude يضيف ويعدّل في لوحتك من أي مكان، بدون ما يكون جهازك مفتوح.</p>
<ul><li>كل اللي يضيفه ينحفظ <b>مسودة</b>، وأنت اللي تنشر.</li><li>تقدر تلغي الربط من إعدادات Claude متى ما بغيت.</li></ul>
${err ? `<p class="e">${esc(err)}</p>` : ''}
<button type="button" class="b" id="paste">الصق مفتاح الإدارة واربط</button>
<p style="margin:14px 0 4px">أو الصقه يدوياً (Cmd+V):</p>
<input type="password" name="key" id="k" autocomplete="off" placeholder="مفتاح الإدارة">${hidden}
<button class="b g" type="submit">اربط</button></form>
<script>document.getElementById('paste').onclick=async()=>{try{const t=await navigator.clipboard.readText();const m=(t.match(/[A-Za-z0-9_-]{8,}/)||[''])[0];if(!m)throw 0;document.getElementById('k').value=m;document.getElementById('f').submit();}catch(e){document.getElementById('k').focus();}};</script>
</body></html>`;
}

/* ═════════ الأدوات ═════════ */
const S = (props, req = []) => ({ type: 'object', properties: props, required: req });
const str = (d) => ({ type: 'string', description: d });
const num = (d) => ({ type: 'number', description: d });
const CITY = str('معرّف المدينة: riyadh, jeddah, medina, makkah-region, alula, diriyah, eastern-region, abha, asir-region, taif, tabuk-region, hail, qassim-region, yanbu, umluj, jizan, najran, albaha, aljawf-region, northern-border, riyadh-region');
const PLACE_FIELDS = {
  title: str('اسم المكان بالعربي'), title_en: str('الاسم بالإنجليزي'), city: CITY, cats: { type: 'array', items: { type: 'string' }, description: 'التصنيفات بالعربي (مثل: معالم سياحية، تراث، مطاعم، مقاهي، طبيعة)' },
  summary: str('ملخص سطر واحد'), body: str('الوصف (فقرات تفصلها سطرين)'), images: { type: 'array', items: { type: 'string' }, description: 'روابط الصور (الأولى غلاف). ارفع الصور الخارجية أول بـupload_image_from_url' },
  lat: num('خط العرض'), lng: num('خط الطول'), address: str('العنوان'), phone: str('الجوال'), website: str('الموقع'),
};
const EVENT_FIELDS = {
  title: str('اسم الفعالية بالعربي'), city: CITY, start: str('البداية ISO 8601 مع +03:00'), end: str('النهاية ISO 8601 مع +03:00'), all_day: { type: 'boolean' },
  cats: { type: 'array', items: { type: 'string' }, description: 'من: حفلات غنائية، مسرح، رياضية، مهرجانات، معارض ومؤتمرات، تراث وثقافة، ترفيه، تجارب ومغامرات، عائلية، طعام — وممكن وسم موسم: موسم الرياض، موسم جدة، موسم الدرعية، لحظات العلا' },
  summary: str('ملخص سطر واحد'), body: str('الوصف'), images: { type: 'array', items: { type: 'string' } }, address: str('المكان'), lat: num(''), lng: num(''),
  tickets: str('رابط التذاكر'), link: str('الرابط الرسمي'),
};
const TOOLS = [
  ['summary', 'ملخص اللوحة: عدد الأماكن والمسودات والفعاليات والمستخدمين والطلبات اللي تنتظر.', S({}), () => ['GET', '/admin/summary']],
  ['analytics', 'تحليلات آخر 30 يوم: المستخدمين والنشاط اليومي.', S({}), () => ['GET', '/admin/analytics']],
  ['search_places', 'بحث في الأماكن (كل الحالات). status: live|draft|hidden، missing: photo|geo.', S({ q: str('كلمة البحث أو رقم المكان'), city: CITY, status: str('live|draft|hidden'), missing: str('photo|geo'), page: num('الصفحة (30 لكل صفحة)') }), (a) => ['GET', '/admin/places?' + qs(a)]],
  ['get_place', 'تفاصيل مكان كاملة.', S({ id: num('رقم المكان') }, ['id']), (a) => ['GET', `/admin/places/${+a.id}`]],
  ['find_similar_places', 'يتأكد إن المكان مو مكرر قبل الإضافة (اسم قريب أو أقل من 150 متر).', S({ title: str(''), city: CITY, lat: num(''), lng: num('') }, ['title']), (a) => ['GET', '/admin/places/similar?' + qs(a)]],
  ['create_places_draft', 'يضيف أماكن جديدة (حتى 50) كمسودات. يتخطى المكرر تلقائياً.', S({ items: { type: 'array', items: S(PLACE_FIELDS, ['title', 'city']) } }, ['items']), (a) => ['POST', '/admin/places/bulk', { items: a.items }]],
  ['update_place', 'يعدّل مكان: أرسل بس الحقول اللي تبي تغيّرها (الباقي يبقى). ما يغيّر حالة النشر.', S({ id: num(''), ...PLACE_FIELDS }, ['id']), null, 'place'],
  ['list_events', 'الفعاليات. when: upcoming|past|all، status: live|draft|hidden.', S({ when: str(''), status: str(''), city: CITY, q: str('') }), (a) => ['GET', '/admin/events?' + qs(a)]],
  ['get_event', 'تفاصيل فعالية.', S({ id: num('') }, ['id']), (a) => ['GET', `/admin/events/${+a.id}`]],
  ['create_events_draft', 'يضيف فعاليات (حتى 50) كمسودات. يتخطى المكرر (نفس الاسم ونفس يوم البداية).', S({ items: { type: 'array', items: S(EVENT_FIELDS, ['title', 'start']) } }, ['items']), (a) => ['POST', '/admin/events/bulk', { items: a.items }]],
  ['update_event', 'يعدّل فعالية: أرسل بس الحقول اللي تتغير. ما يغيّر حالة النشر.', S({ id: num(''), ...EVENT_FIELDS }, ['id']), null, 'event'],
  ['set_status', 'يغيّر حالة مكان أو فعالية أو خبر: draft (مسودة) أو hidden (إخفاء) أو live (نشر). ⚠️ النشر live بس لما رامي يطلبه صراحة. المكان/الفعالية المنشورة تدخل في إشعار «جديد في مدينتك» اليومي (5 العصر) لمتابعين المدينة.', S({ type: str('places|events|articles'), id: num(''), status: str('draft|hidden|live') }, ['type', 'id', 'status']), (a) => ['POST', `/admin/${a.type}/${+a.id}/status`, { status: a.status }]],
  ['list_seasons', 'المواسم (من تصنيفات الفعاليات) وعدد فعالياتها.', S({}), () => ['GET', '/admin/seasons']],
  ['get_seasons_meta', 'بيانات المواسم الرسمية: الاسم، المدينة، البداية والنهاية (YYYY-MM-DD)، الوصف، الرابط، الغلاف، «سيعود قريباً» (returning) والفترة المعتادة (when).', S({}), () => ['GET', '/admin/seasons/meta']],
  ['set_season', 'يضيف أو يعدّل موسم واحد (بالاسم): start/end بصيغة YYYY-MM-DD، line وصف قصير، link رابط رسمي https، cover رابط صورة من تخزين الدليل فقط (صورنا الخاصة، لا تنسخ أغلفة مواقع ثانية)، returning=true للمواسم اللي انتهت وترجع، when الفترة المعتادة، hidden لإخفائه. اسم الموسم لازم يطابق تصنيف الفعاليات.', S({ name: str(''), city: CITY, start: str(''), end: str(''), line: str(''), link: str(''), cover: str(''), returning: { type: 'boolean' }, when: str(''), hidden: { type: 'boolean' } }, ['name']), (a) => ['POST', '/admin/seasons/meta', { season: a }]],
  ['ai_stats', 'إحصاءات الذكاء الاصطناعي في التطبيق (اسأل الدليل + خطط لي رحلة) آخر 30 يوم، والحدود المجانية اليومية، وعدد مشتركي دليل+، وآخر الأسئلة.', S({}), () => ['GET', '/admin/ai']],
  ['set_ai_limits', 'الحد المجاني لكل مستخدم: chat (أسئلة اسأل الدليل باليوم) و plan (خطط ذكية بالشهر). ⚠️ بطلب رامي.', S({ chat: num(''), plan: num('') }, ['chat', 'plan']), (a) => ['POST', '/admin/ai/limits', a]],
  ['grant_plus', 'يمنح مستخدم دليل+ يدوياً (هدية/تجربة) لعدد أيام، أو days=0 يلغيه. ⚠️ بطلب رامي.', S({ userId: str(''), days: num('') }, ['userId', 'days']), (a) => ['POST', '/admin/ai/plus', a]],
  ['list_contact', 'رسائل «تواصل معنا» من التطبيق. status: new|done|archived|all (الافتراضي new)، kind: suggestion|complaint|correction|bug|ads|merchant|question|other.', S({ status: str(''), kind: str('') }), (a) => ['GET', `/admin/contact?status=${a.status || 'new'}${a.kind ? '&kind=' + a.kind : ''}`]],
  ['reply_contact', 'يرد على رسالة تواصل (يوصل المستخدم إشعار) أو يغيّر حالتها (status: done|archived|new). ⚠️ الرد بنص يوافق عليه رامي.', S({ id: num(''), reply: str('نص الرد'), status: str('') }, ['id']), (a) => ['POST', `/admin/contact/${a.id}`, { ...(a.reply ? { reply: a.reply } : {}), ...(a.status ? { status: a.status } : {}) }]],
  ['get_weekly', 'قائمة مختارات الأسبوع (المجموعة اللي تدور منها الرئيسية).', S({}), () => ['GET', '/admin/weekly']],
  ['set_weekly', 'يحفظ قائمة مختارات الأسبوع كاملة: [{id, s: w|s|a (شتاء/صيف/كل السنة), x: 1 للنجمة}].', S({ pool: { type: 'array', items: S({ id: num(''), s: str('w|s|a'), x: num('') }) } }, ['pool']), (a) => ['POST', '/admin/weekly', { pool: a.pool }]],
  ['list_articles', 'الأخبار.', S({ status: str(''), q: str('') }), (a) => ['GET', '/admin/articles?' + qs(a)]],
  ['create_article_draft', 'يضيف خبر كمسودة.', S({ title: str(''), author: str(''), summary: str(''), body: str(''), images: { type: 'array', items: { type: 'string' } }, cats: { type: 'array', items: { type: 'string' } } }, ['title']), (a) => ['POST', '/admin/articles', { ...a }]],
  ['upload_image_from_url', 'ينزّل صورة من رابط (jpg/png/webp حتى 10MB) ويرفعها لتخزين الدليل، ويرجع الرابط الجديد. استخدم بس صور مسموح استخدامها (رسمية أو من صاحب المكان).', S({ url: str('رابط الصورة') }, ['url']), null, 'upload'],
  ['list_suggestions', 'اقتراحات الزوار (pending|approved|rejected) مع صورهم وفرز المراجعة الذكية (ai: decision, summary, body, kind, cats).', S({ status: str('') }), (a) => ['GET', '/admin/suggestions?' + qs(a)]],
  ['list_merchants', 'طلبات التجار (pending|approved|rejected|hidden|all).', S({ status: str('') }), (a) => ['GET', '/admin/merchants?' + qs(a)]],
  ['list_coupons', 'الكوبونات (pending|active|paused|all).', S({ status: str('') }), (a) => ['GET', '/admin/coupons?' + qs(a)]],
  ['list_photos', 'صور الزوار (pending|approved|rejected).', S({ status: str('') }), (a) => ['GET', '/admin/photos?' + qs(a)]],

  /* —— لوحة التحكم —— */
  ['dashboard', 'لوحة الرئيسية الكاملة: النشطين (اليوم/7/30 يوم)، أكثر الأماكن والبحث، «بحثوا وما لقوا»، المدن، المنصات، الفعاليات القادمة، والمسودات القريبة.', S({}), () => ['GET', '/admin/dashboard']],
  ['sync_status', 'آخر عمليات المزامنة.', S({}), () => ['GET', '/admin/status']],
  ['get_article', 'تفاصيل خبر.', S({ id: num('') }, ['id']), (a) => ['GET', `/admin/articles/${+a.id}`]],
  ['update_article', 'يعدّل خبر: أرسل بس الحقول اللي تتغير.', S({ id: num(''), title: str(''), author: str(''), summary: str(''), body: str(''), images: { type: 'array', items: { type: 'string' } }, cats: { type: 'array', items: { type: 'string' } } }, ['id']), null, 'article'],

  /* —— اسأل أهل المدينة (المجتمع) —— */
  ['community_list', 'مشاركات «اسأل أهل المدينة»: أسئلة ونصائح وصور. unanswered=true للأسئلة اللي ما أحد جاوبها. status: visible (الافتراضي) | hidden | all.', S({ city: CITY, kind: str('question|tip|photo'), unanswered: { type: 'boolean' }, status: str(''), q: str('بحث في النص'), limit: num('حتى 100') }), (a) => ['GET', '/admin/community/list?' + qs(a)]],
  ['community_thread', 'سؤال/مشاركة مع كل الإجابات.', S({ id: num('رقم المشاركة') }, ['id']), (a) => ['GET', '/admin/community/thread?id=' + +a.id]],
  ['community_answer', 'يرد على سؤال باسم «فريق دليل السعودية» (شارة فريق الدليل) ويوصل إشعار لصاحب السؤال. اكتب رد مفيد ودقيق بلهجة ودودة، بدون أرقام جوال أو روابط تجارية.', S({ postId: num(''), text: str('نص الرد') }, ['postId', 'text']), (a) => ['POST', '/admin/community/answer', a]],
  ['community_post', 'ينشر سؤال أو نصيحة أو صورة باسم «فريق دليل السعودية» (يظهر مباشرة في المجتمع — استخدمه بس لما رامي يطلب أو يوافق على النص).', S({ kind: str('question|tip|photo'), city: CITY, placeId: num('رقم مكان مرتبط (اختياري)'), text: str(''), photo: str('رابط صورة (لـphoto)') }, ['text']), (a) => ['POST', '/admin/community/post', a]],
  ['community_best', 'يختار أفضل إجابة لسؤال (+15 نقطة لصاحبها). answerId فاضي = إلغاء الاختيار.', S({ postId: num(''), answerId: num('') }, ['postId']), (a) => ['POST', '/admin/community/best', a]],
  ['community_pending', 'طابور المراجعة: المشاركات والإجابات اللي حوّلتها المراجعة الذكية للمراجعة اليدوية (pending)، أو المرفوضة (rejected) عشان ترجع اللي انرفض بالغلط.', S({ status: str('pending|rejected') }), (a) => ['GET', '/admin/community/pending?' + qs(a)]],
  ['community_review', 'يعتمد (approve) أو يرفض (reject) مشاركة أو إجابة من طابور المراجعة. الاعتماد ينشرها ويعطي النقاط ويوصل إشعار، والرفض يوصل صاحبها إشعار بالسبب (note). target: p | a.', S({ target: str('p|a'), id: num(''), decision: str('approve|reject'), note: str('سبب الرفض للمستخدم (اختياري)') }, ['target', 'id', 'decision']), (a) => ['POST', '/admin/community/review', a]],
  ['community_mute', 'يوقف مستخدم عن المشاركة في المجتمع مؤقتاً (days من 1 إلى 365) أو يرجّعه (days=0). يوصله إشعار. ⚠️ بطلب رامي.', S({ userId: str(''), days: num(''), note: str('ملاحظة للمستخدم (اختياري)') }, ['userId', 'days']), (a) => ['POST', '/admin/community/mute', a]],
  ['community_reported', 'المشاركات والإجابات المبلّغ عنها.', S({}), () => ['GET', '/admin/community/reported']],
  ['community_moderate', 'يخفي أو يُظهر مشاركة أو إجابة (ما نحذف). target: p (مشاركة) | a (إجابة).', S({ target: str('p|a'), id: num(''), hidden: { type: 'boolean' } }, ['target', 'id', 'hidden']), (a) => ['POST', '/admin/community/moderate', a]],
  ['get_challenge', 'تحدي الأسبوع الحالي.', S({}), () => ['GET', '/admin/challenge']],
  ['set_challenge', 'يضبط تحدي الأسبوع (title, prize, tag, photo, city, end ISO) أو clear=true لإلغائه. يظهر للزوار مباشرة.', S({ title: str(''), prize: str(''), tag: str('وسم بدون #'), photo: str(''), city: CITY, end: str('ISO مع +03:00'), clear: { type: 'boolean' } }), (a) => ['POST', '/admin/challenge', a]],

  /* —— المستخدمين والمرشدين والأوسمة —— */
  ['list_users', 'المستخدمين (حتى 100، الأعلى نقاط). q: اسم أو رقم.', S({ q: str('') }), (a) => ['GET', '/admin/users?' + qs(a)]],
  ['set_user_role', 'يغيّر دور مستخدم: user | guide (مرشد موثّق) | admin (فريق الدليل). ⚠️ بس بطلب رامي.', S({ userId: str(''), role: str('user|guide|admin') }, ['userId', 'role']), (a) => ['POST', '/admin/community/role', a]],
  ['list_guide_requests', 'طلبات «مرشد موثّق» مع إحصاءات كل متقدم.', S({}), () => ['GET', '/admin/guides']],
  ['decide_guide_request', 'يقبل أو يرفض طلب مرشد موثّق (يوصله إشعار). ⚠️ القرار لرامي.', S({ userId: str(''), status: str('approved|rejected'), note: str('سبب الرفض (اختياري)') }, ['userId', 'status']), (a) => ['POST', `/admin/guides/${encodeURIComponent(a.userId)}`, { status: a.status, note: a.note }]],
  ['badges', 'الأوسمة وعدد اللي حصلوا على كل وسام.', S({}), () => ['GET', '/admin/badges']],
  ['heroes', 'أبطال المساهمة (الأكثر مساهمة) — عام أو لمدينة.', S({ city: CITY }), (a) => ['GET', '/admin/heroes?' + qs(a)]],
  ['honor_heroes', 'يكرّم مستخدمين: إشعار تهنئة + نقاط إضافية (حتى 500). ⚠️ لازم confirmed=true وبس بعد موافقة رامي على الأسماء والنقاط والنص.', S({ userIds: { type: 'array', items: { type: 'string' } }, bonus: num(''), text: str(''), confirmed: { type: 'boolean' } }, ['userIds', 'confirmed']), null, 'honor'],

  /* —— اقتراحات الزوار وصورهم وتقييماتهم —— */
  ['decide_suggestion', 'يقبل أو يرفض اقتراح زائر. new → مسودة جاهزة بصور المستخدم والملخص والوصف من المراجعة الذكية واسم المساهم (+15 و+5 لكل صورة)، edit → يطبق الحقول (apply: title, phone, website, address, geo) (+5)، closed → يخفي المكان (+5).', S({ id: num(''), status: str('approved|rejected'), note: str(''), apply: { type: 'array', items: { type: 'string' } } }, ['id', 'status']), (a) => ['POST', `/admin/suggestions/${+a.id}`, a]],
  ['decide_photos', 'يقبل أو يرفض صور زوار (حتى 200 مرة وحدة). القبول +5 نقاط.', S({ ids: { type: 'array', items: { type: 'number' } }, status: str('approved|rejected'), note: str('') }, ['ids', 'status']), (a) => ['POST', '/admin/photos/bulk', a]],
  ['list_reviews', 'تقييمات الأماكن: visible | hidden | reported.', S({ status: str('') }), (a) => ['GET', '/admin/reviews?' + qs(a)]],
  ['set_review_status', 'يخفي أو يُظهر تقييم.', S({ id: num(''), status: str('visible|hidden') }, ['id', 'status']), (a) => ['POST', `/admin/reviews/${+a.id}`, { status: a.status }]],

  /* —— التجار والكوبونات —— */
  ['decide_merchant', 'يحدّث طلب تاجر: status (pending|approved|rejected|hidden)، verified، maxCoupons (0-20)، placeId (ربط بمكان)، note. القبول/الرفض يوصل التاجر إشعار. ⚠️ القبول لرامي.', S({ id: num(''), status: str(''), verified: { type: 'boolean' }, maxCoupons: num(''), placeId: num(''), note: str(''), lat: num(''), lng: num('') }, ['id']), (a) => ['POST', `/admin/merchants/${+a.id}`, a]],
  ['decide_coupon', 'يحدّث كوبون: status (pending|active|paused|rejected|hidden)، note. ⚠️ التفعيل لرامي.', S({ id: num(''), status: str(''), note: str('') }, ['id']), (a) => ['POST', `/admin/coupons/${+a.id}`, a]],
  ['list_coupon_reports', 'بلاغات العملاء على الكوبونات (pending|confirmed|dismissed).', S({ status: str('') }), (a) => ['GET', '/admin/coupon-reports?' + qs(a)]],
  ['decide_coupon_report', 'يأكد البلاغ (confirmed: إنذار للتاجر +20 نقطة للمبلّغ، 3 إنذارات = إيقاف) أو يرفضه (dismissed). ⚠️ القرار لرامي.', S({ id: num(''), status: str('confirmed|dismissed') }, ['id', 'status']), (a) => ['POST', `/admin/coupon-reports/${+a.id}`, a]],

  /* —— الرسائل والإشعارات —— */
  ['list_messages', 'الرسائل المرسلة والمجدولة وعدد الأجهزة.', S({}), () => ['GET', '/admin/messages']],
  ['estimate_message', 'كم شخص بتوصله الرسالة (cities، segment: all|inactive|new|guides|merchants).', S({ cities: { type: 'array', items: { type: 'string' } }, segment: str('') }), (a) => ['POST', '/admin/messages/estimate', a]],
  ['send_message', 'يرسل أو يجدول رسالة/إشعار للمستخدمين (title حتى 60، text حتى 178، link مثل /event/123، cities، segment، at ISO مع +03:00 للجدولة، push، inapp). ساعات الهدوء 23:00-08:00 مكة تتأجل تلقائياً. ⚠️ لازم confirmed=true وبس بعد ما يوافق رامي على النص والجمهور والوقت بالحرف.', S({ title: str(''), text: str(''), link: str(''), cities: { type: 'array', items: { type: 'string' } }, segment: str(''), at: str(''), push: { type: 'boolean' }, inapp: { type: 'boolean' }, confirmed: { type: 'boolean' } }, ['text', 'confirmed']), null, 'send'],
  ['cancel_message', 'يلغي رسالة مجدولة ما انرسلت.', S({ id: num('') }, ['id']), (a) => ['POST', `/admin/messages/${+a.id}/cancel`, {}]],

  /* —— مفاتيح الميزات —— */
  ['get_features', 'مفاتيح الميزات في التطبيق (شغالة/مخفية) مع أسمائها.', S({}), () => ['GET', '/admin/features']],
  ['set_features', 'يشغّل أو يخفي ميزات: {coupons: true, guides: false, ...}. يظهر في التطبيق خلال 5 دقايق. ⚠️ بطلب رامي.', S({ features: { type: 'object', additionalProperties: { type: 'boolean' } } }, ['features']), (a) => ['POST', '/admin/features', a.features || {}]],
];
const qs = (a) => new URLSearchParams(Object.entries(a || {}).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString();

/** يستدعي مسار إدارة داخلياً بمفتاح الإدارة (نفس اللي تستخدمه اللوحة) */
async function adminCall(env, origin, method, path, body) {
  const url = new URL(origin + path);
  const req = new Request(url, { method, headers: { 'X-Admin-Key': env.ADMIN_KEY, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const J = (d, s = 200) => ({ __s: s, d });
  const p = url.pathname, q = url.searchParams;
  if (p === '/admin/weekly' && method === 'POST') {
    await env.DB.prepare("INSERT OR REPLACE INTO kv (k,v) VALUES ('weekly_pool',?)").bind(JSON.stringify(body.pool || [])).run();
    return { ok: true, count: (body.pool || []).length };
  }
  if (p === '/admin/dashboard') return dashboard(env);
  if (p === '/admin/status') {
    const last = await env.DB.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 5').all();
    return { sync: last.results };
  }
  const r = (await seasonsAdmin(p, req, env, J)) || (await aiAdmin(p, req, env, J)) || (await adminRoute(p, req, env, J, q)) || (await merchantAdmin(p, req, env, J, q)) || (await reviewsAdmin(p, req, env, J, q)) || (await contribAdmin(p, req, env, J, q)) || (await messagesAdmin(p, req, env, J, q))
    || (await guideAdmin(p, req, env, J)) || (p.startsWith('/admin/community/') ? await communityAdmin(p, req, env, J) : null);
  if (!r) throw new Error('not_found');
  if (r.__s >= 400) throw new Error(r.d?.error || 'error_' + r.__s);
  return r.d;
}

async function callTool(env, origin, name, args) {
  const t = TOOLS.find((x) => x[0] === name);
  if (!t) throw new Error('unknown_tool');
  if (t[4] === 'place' || t[4] === 'event') {
    const kind = t[4];
    const cur = (await adminCall(env, origin, 'GET', `/admin/${kind}s/${+args.id}`))[kind];
    const merged = { ...cur, ...Object.fromEntries(Object.entries(args).filter(([k, v]) => k !== 'id' && v !== undefined)) };
    if (kind === 'place' && !args.body) merged.body = cur.body; // نخلي الوصف HTML مثل ما هو
    const r = await adminCall(env, origin, 'PUT', `/admin/${kind}s/${+args.id}`, merged);
    return r;
  }
  if (t[4] === 'send' || t[4] === 'honor') {
    if (args.confirmed !== true) throw new Error('needs_confirmation: اعرض النص والجمهور على رامي وخذ موافقته، وبعدها أرسل confirmed=true');
    const { confirmed, ...rest } = args;
    if (t[4] === 'send') {
      const est = await adminCall(env, origin, 'POST', '/admin/messages/estimate', { cities: rest.cities, segment: rest.segment });
      const r = await adminCall(env, origin, 'POST', '/admin/messages', rest);
      return { ...r, estimate: est };
    }
    return adminCall(env, origin, 'POST', '/admin/heroes/honor', rest);
  }
  if (t[4] === 'article') {
    const cur = (await adminCall(env, origin, 'GET', `/admin/articles/${+args.id}`)).article;
    const merged = { ...cur, ...Object.fromEntries(Object.entries(args).filter(([k, v]) => k !== 'id' && v !== undefined)) };
    return adminCall(env, origin, 'PUT', `/admin/articles/${+args.id}`, merged);
  }
  if (t[4] === 'upload') {
    const res = await fetch(String(args.url), { headers: { 'User-Agent': 'SaudiGuide/1.0' }, redirect: 'follow' });
    if (!res.ok) throw new Error('download_failed_' + res.status);
    const type = (res.headers.get('Content-Type') || '').split(';')[0].trim();
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
    if (!ext) throw new Error('not_an_image: ' + type);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 10 * 1024 * 1024) throw new Error('too_big');
    const key = `a/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, buf, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
    return { url: `${origin}/media/${key}`, bytes: buf.byteLength };
  }
  const [method, path, body] = t[3](args || {});
  return adminCall(env, origin, method, path, body);
}

/* ═════════ المسارات ═════════ */
export async function mcpRoute(p, request, env) {
  const origin = new URL(request.url).origin;
  const M = request.method;
  if (M === 'OPTIONS') return new Response(null, { headers: CORS });

  if (p === '/.well-known/oauth-protected-resource' || p === '/.well-known/oauth-protected-resource/mcp') {
    return json({ resource: origin + '/mcp', authorization_servers: [origin], bearer_methods_supported: ['header'], scopes_supported: ['admin'] });
  }
  if (p === '/.well-known/oauth-authorization-server') {
    return json({
      issuer: origin, authorization_endpoint: origin + '/oauth/authorize', token_endpoint: origin + '/oauth/token', registration_endpoint: origin + '/oauth/register',
      response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'], scopes_supported: ['admin'],
    });
  }
  if (!['/oauth/register', '/oauth/authorize', '/oauth/token', '/mcp'].includes(p)) return null;
  if (!env.ADMIN_KEY) return json({ error: 'not_configured' }, 503);
  await ensure(env);

  if (p === '/oauth/register' && M === 'POST') {
    const b = await request.json().catch(() => ({}));
    const redirects = (Array.isArray(b.redirect_uris) ? b.redirect_uris : []).map(String).filter((u) => /^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u)).slice(0, 10);
    if (!redirects.length) return json({ error: 'invalid_redirect_uri' }, 400);
    const id = 'c_' + rand(16);
    await env.DB.prepare('INSERT INTO oauth_clients (id,name,redirects,created) VALUES (?,?,?,?)').bind(id, String(b.client_name || '').slice(0, 100), JSON.stringify(redirects), now()).run();
    return json({ client_id: id, client_name: b.client_name || '', redirect_uris: redirects, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }, 201);
  }

  if (p === '/oauth/authorize') {
    const params = M === 'POST' ? new URLSearchParams(await request.text()) : new URL(request.url).searchParams;
    const client = await getClient(env, params.get('client_id') || '');
    const redirect = params.get('redirect_uri') || '';
    const html = (h, s = 200) => new Response(h, { status: s, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' } });
    if (!client || !JSON.parse(client.redirects).includes(redirect)) return html('<p dir="rtl">رابط الربط غير صالح. ارجع لـClaude وجرّب الربط من جديد.</p>', 400);
    if (params.get('response_type') !== 'code' || params.get('code_challenge_method') !== 'S256' || !params.get('code_challenge')) return html('<p dir="rtl">طلب غير مدعوم.</p>', 400);
    if (M === 'GET') return html(authorizePage(params));
    // محاولات خاطئة: 10 بالساعة لكل عنوان
    const ip = request.headers.get('CF-Connecting-IP') || 'x';
    const k = `oauth_fail:${ip}:${Math.floor(now() / 3600)}`;
    const fails = await env.DB.prepare('SELECT v FROM kv WHERE k=?').bind(k).first();
    if (fails && +fails.v >= 10) return html(authorizePage(params, 'محاولات كثيرة. جرّب بعد ساعة.'), 429);
    if (!(await sameKey(params.get('key'), env.ADMIN_KEY))) {
      await env.DB.prepare("INSERT INTO kv (k,v) VALUES (?,'1') ON CONFLICT(k) DO UPDATE SET v=CAST(v AS INTEGER)+1").bind(k).run();
      return html(authorizePage(params, 'المفتاح غلط. شغّل أمر «افتح-اللوحة» عشان ينسخه لك، وبعدها اضغط الزر البرتقالي.'), 401);
    }
    const code = rand();
    await env.DB.prepare('INSERT INTO oauth_codes (code,client_id,redirect,challenge,exp) VALUES (?,?,?,?,?)').bind(await sha(code), client.id, redirect, params.get('code_challenge'), now() + 300).run();
    const u = new URL(redirect);
    u.searchParams.set('code', code);
    if (params.get('state')) u.searchParams.set('state', params.get('state'));
    return Response.redirect(u.toString(), 302);
  }

  if (p === '/oauth/token' && M === 'POST') {
    const ct = request.headers.get('Content-Type') || '';
    const b = ct.includes('json') ? await request.json().catch(() => ({})) : Object.fromEntries(new URLSearchParams(await request.text()));
    const basic = (request.headers.get('Authorization') || '').match(/^Basic (.+)$/);
    if (basic && !b.client_id) { try { b.client_id = decodeURIComponent(atob(basic[1]).split(':')[0]); } catch {} }
    if (b.grant_type === 'authorization_code') {
      const row = await env.DB.prepare('SELECT * FROM oauth_codes WHERE code=?').bind(await sha(b.code || '')).first();
      if (!row || row.exp < now() || row.client_id !== b.client_id || row.redirect !== b.redirect_uri) return json({ error: 'invalid_grant' }, 400);
      await env.DB.prepare('DELETE FROM oauth_codes WHERE code=?').bind(row.code).run();
      if ((await sha(b.code_verifier || '')) !== row.challenge) return json({ error: 'invalid_grant', error_description: 'pkce' }, 400);
      return json(await issueTokens(env, row.client_id));
    }
    if (b.grant_type === 'refresh_token') {
      const h = await sha(b.refresh_token || '');
      const row = await env.DB.prepare("SELECT * FROM oauth_tokens WHERE hash=? AND kind='refresh'").bind(h).first();
      if (!row || row.exp < now()) return json({ error: 'invalid_grant' }, 400);
      await env.DB.prepare('DELETE FROM oauth_tokens WHERE hash=?').bind(h).run();
      return json(await issueTokens(env, row.client_id));
    }
    return json({ error: 'unsupported_grant_type' }, 400);
  }

  if (p === '/mcp') {
    const unauthorized = () => json({ error: 'unauthorized' }, 401, { 'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"` });
    const m = (request.headers.get('Authorization') || '').match(/^Bearer (.+)$/);
    if (!m) return unauthorized();
    const tok = await env.DB.prepare("SELECT * FROM oauth_tokens WHERE hash=? AND kind='access'").bind(await sha(m[1])).first();
    if (!tok || tok.exp < now()) return unauthorized();
    if (M === 'GET') return new Response('Method Not Allowed', { status: 405, headers: { ...CORS, Allow: 'POST' } });
    if (M === 'DELETE') return new Response(null, { status: 204, headers: CORS });
    if (M !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const msg = await request.json().catch(() => null);
    if (!msg) return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
    const handle = async (x) => {
      if (x.id === undefined || x.id === null) return null; // إشعار
      const ok = (result) => ({ jsonrpc: '2.0', id: x.id, result });
      try {
        if (x.method === 'initialize') {
          return ok({ protocolVersion: x.params?.protocolVersion || '2025-06-18', capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'dalil-saudi-panel', title: 'لوحة دليل السعودية', version: '1.0.0' },
            instructions: 'لوحة تطبيق دليل السعودية (الأماكن والفعاليات والأخبار، «اسأل أهل المدينة»، التجار والكوبونات، صور وتقييمات الزوار، المستخدمين والمرشدين، الرسائل، مفاتيح الميزات). القواعد: أي مكان أو فعالية أو خبر جديد يُضاف مسودة دائماً، ولا تنشر (set_status live) إلا إذا طلب رامي ذلك صراحة. لا تحذف شيئاً: الإخفاء بدل الحذف. الأوقات بتوقيت مكة (+03:00). أي شي يوصل للمستخدمين مباشرة (send_message، honor_heroes، community_post، قبول/رفض التجار والكوبونات والمرشدين، set_features، set_user_role) لا تسويه إلا بطلب رامي أو بعد ما يوافق على التفاصيل. الردود في المجتمع باسم «فريق دليل السعودية» تكون دقيقة ومفيدة وبدون إعلانات.' });
        }
        if (x.method === 'ping') return ok({});
        if (x.method === 'tools/list') return ok({ tools: TOOLS.map(([name, description, inputSchema]) => ({ name, description, inputSchema })) });
        if (x.method === 'tools/call') {
          try {
            const r = await callTool(env, origin, x.params?.name, x.params?.arguments || {});
            return ok({ content: [{ type: 'text', text: JSON.stringify(r) }] });
          } catch (e) {
            return ok({ content: [{ type: 'text', text: 'خطأ: ' + (e.message || e) }], isError: true });
          }
        }
        return { jsonrpc: '2.0', id: x.id, error: { code: -32601, message: 'Method not found' } };
      } catch (e) {
        return { jsonrpc: '2.0', id: x.id, error: { code: -32603, message: String(e.message || e) } };
      }
    };
    if (Array.isArray(msg)) {
      const out = (await Promise.all(msg.map(handle))).filter(Boolean);
      return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
    }
    const r = await handle(msg);
    return r ? json(r) : new Response(null, { status: 202, headers: CORS });
  }
  return json({ error: 'not_found' }, 404);
}
