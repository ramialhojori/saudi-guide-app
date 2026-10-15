/* المراجعة الذكية لـ«اسأل أهل المدينة» — قبل ما تنزل المشاركة للناس
   1) فلتر مجاني (بدون مفتاح): أرقام جوال، روابط، حسابات تواصل، إيميلات، كلمات مسيئة معروفة → رفض فوري
   2) مراجعة Claude (لو مفتاح ANTHROPIC_API_KEY موجود والميزة شغالة): قبول / رفض / مراجعة يدوية
   - لو خدمة Claude ما ردت (عطل أو تأخير) ننشر المشاركة ونعلّمها عشان تراجعها بعدين، ما نعطّل الناس
   - نفس قواعد دالة المراجعة القديمة في سوبابيس */

const DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
const norm = (s) => String(s || '').replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d]);

// كلمات مسيئة صريحة فقط (القائمة قصيرة عمداً، والباقي على مراجعة Claude)
// كلمات مثل «كلب» و«وسخ» ما نحطها هنا لأنها تجي بمعنى عادي («قرية الكلاب»، «المكان وسخ»)
const BAD = ['يلعن', 'حقير', 'منيوك', 'شرموط', 'قحب', 'عاهر', 'كس امك', 'ابن الكلب', 'يا كلب', 'يا حمار', 'يا حيوان', 'يا خنزير'];
const BAD_RE = new RegExp(`(^|[\\s،.!؟?,:;"'«»()\\-])(${BAD.join('|')})(ك|كم|ه|ها|هم|ين|ات|ة)?(?=$|[\\s،.!؟?,:;"'«»()\\-])`, 'u');

/** الفلتر المجاني: يرجع سبب الرفض أو null */
export function quickFilter(text) {
  const t = norm(text);
  const flat = t.replace(/[\s\-–—_.()+]/g, '');
  if (/(?:00966|966|0)?5\d{8}/.test(flat) || /\d{9,}/.test(flat)) return 'المشاركة فيها رقم جوال. نمنع الأرقام عشان خصوصيتك وما تصير إعلانات.';
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|sa|me|io|co|ly|link|store|app)\b/i.test(t)) return 'المشاركة فيها رابط. الروابط ممنوعة في المجتمع عشان نمنع الإعلانات.';
  if (/[\w.+-]+@[\w-]+\.\w+/.test(t)) return 'المشاركة فيها إيميل. التواصل الخاص ممنوع داخل المجتمع.';
  if (/(^|\s)@[a-z0-9_.]{3,}/i.test(t) || /(واتس|واتساب|سناب|انستا|إنستا|تيك ?توك|تويتر|تلقرام|تيليجرام)\s*[:：]?\s*[a-z0-9_.@]{3,}/i.test(t)) return 'المشاركة فيها حساب تواصل. نمنعها عشان ما تصير إعلانات.';
  if (BAD_RE.test(` ${t} `)) return 'المشاركة فيها كلمة غير لائقة. خلّ أسلوبنا محترم مع الكل.';
  if (/(.)\1{7,}/u.test(t.replace(/\s/g, ''))) return 'النص فيه تكرار حروف كثير. اكتب سؤالك أو جوابك بشكل واضح.';
  return null;
}

const RULES = `أنت مشرف محتوى لميزة "اسأل أهل المدينة" في تطبيق "دليل السعودية" (دليل سياحي للسعودية).
الزوار يسألون عن المدن السعودية (أكل، أماكن، سكن، مواصلات، فعاليات، عائلات، أسعار) وأهل المدينة يجاوبون، ويشاركون نصائح.

اقبل (approve) إذا كان النص:
- سؤالاً أو جواباً أو نصيحة حقيقية مفيدة عن السياحة أو الحياة اليومية أو الخدمات في مدينة سعودية، حتى لو كان بسيطاً أو بلهجة عامية أو فيه أخطاء إملائية.
- الجواب يرد فعلاً على السؤال أو يضيف معلومة مفيدة له.
- ذكر اسم مطعم أو محل أو فندق كتوصية عادية مقبول (هذا هو الهدف من الميزة).
- السؤال القصير عن مكان محدد (مثل "فيه مواقف؟" أو "مناسب للأطفال؟") مقبول، لأن المستخدم كتبه من صفحة المكان نفسه.

ارفض (reject) إذا كان فيه أي من:
- إعلان أو ترويج تجاري واضح، أو طلب تواصل خارج التطبيق، أو أرقام جوال أو روابط أو حسابات تواصل.
- سب أو شتم أو تنمر أو عنصرية أو تحريض أو كلام جنسي أو خادش.
- محتوى سياسي أو طائفي أو إساءة لدين أو جنسية أو قبيلة أو أشخاص بأسمائهم.
- معلومات شخصية لأفراد (عناوين بيوت، أسماء كاملة لأشخاص عاديين).
- كلام لا معنى له، أو تجربة كتابة، أو تكرار حروف، أو نص خارج الموضوع تماماً.
- شيء مخالف للأنظمة في السعودية أو فيه ترويج لممنوعات.

اختر "review" إذا كنت غير متأكد (مثلاً معلومة قد تكون خاطئة وتضر، أو شكوى من جهة محددة باسمها، أو حالة رمادية).

السبب (reason) يُعرض للمستخدم إذا رفضت: اكتبه بلهجة سعودية بيضاء لطيفة ومختصرة (جملة وحدة)، بدون اتهام.
أجب بـ JSON فقط بدون أي نص آخر، بالشكل: {"decision":"approve|reject|review","reason":"سبب قصير بالعربي"}`;

async function askClaude(env, label, text, ctx) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.MODERATION_MODEL || 'claude-haiku-5-5', max_tokens: 200, system: RULES,
        messages: [{ role: 'user', content: (ctx ? ctx + '\n\n' : '') + label + '\n' + text }] }),
    });
    if (!r.ok) throw new Error('anthropic_' + r.status);
    const j = await r.json();
    const out = String(j.content?.[0]?.text || '').trim();
    const m = out.match(/\{[\s\S]*\}/);
    const v = m ? JSON.parse(m[0]) : null;
    const d = v && ['approve', 'reject', 'review'].includes(v.decision) ? v.decision : 'review';
    return { decision: d, reason: String(v?.reason || '').slice(0, 200), by: 'ai' };
  } finally { clearTimeout(timer); }
}

/**
 * يقرر مصير مشاركة جديدة.
 * kind: 'post' | 'answer' · ctx: {city, question}
 * يرجع {status: visible|pending|rejected, reason, by: filter|ai|off|error}
 */
export async function moderate(env, kind, text, ctx = {}, aiOn = true) {
  const bad = quickFilter(text);
  if (bad) return { status: 'rejected', reason: bad, by: 'filter' };
  if (!aiOn || !env.ANTHROPIC_API_KEY) return { status: 'visible', reason: '', by: 'off' };
  try {
    const context = kind === 'answer' ? `السؤال الأصلي${ctx.city ? ` (${ctx.city})` : ''}: ${ctx.question || ''}` : [ctx.city ? `المدينة: ${ctx.city}` : '', ctx.place ? `المشاركة مكتوبة في صفحة مكان: ${ctx.place}` : ''].filter(Boolean).join('\n');
    const label = kind === 'answer' ? 'الجواب المطلوب مراجعته:' : 'المشاركة المطلوب مراجعتها (سؤال أو نصيحة):';
    const res = await askClaude(env, label, text, context);
    const status = res.decision === 'approve' ? 'visible' : res.decision === 'reject' ? 'rejected' : 'pending';
    return { status, reason: res.reason, by: 'ai' };
  } catch (e) {
    return { status: 'visible', reason: String(e.message || e).slice(0, 80), by: 'error' };
  }
}

/* ═════════ مراجعة نص تقييمات الأماكن ═════════ */
const REVIEW_RULES = `أنت مشرف محتوى لتقييمات الأماكن في تطبيق "دليل السعودية" (دليل سياحي).
الزائر يقيّم مكان (مطعم، معلم، مقهى...) بنجوم ونص قصير.

اقبل (approve) إذا كان النص رأياً أو تجربة حقيقية عن المكان، حتى لو كان سلبياً جداً أو قاسياً (مثل: "الأكل بارد والخدمة سيئة"، "ما يستاهل، غالي ووسخ")، أو بلهجة عامية أو فيه أخطاء.
الرأي السلبي عن المكان نفسه مسموح دائماً، وهو مهم للزوار.

ارفض (reject) إذا فيه:
- سب أو شتم أو قذف أو تنمر أو عنصرية، أو إساءة لموظف أو شخص باسمه.
- كلام جنسي أو خادش، أو محتوى سياسي أو طائفي أو إساءة لدين أو جنسية أو قبيلة.
- إعلان أو ترويج لمكان أو خدمة ثانية، أو طلب تواصل خارج التطبيق.
- كلام لا معنى له أو تجربة كتابة أو نص لا علاقة له بالمكان.
- اتهامات خطيرة بدون تجربة (مثل جرائم أو مخالفات قانونية) أو ترويج لممنوعات.

اختر "review" إذا كنت غير متأكد (مثلاً ادعاء خطير عن المكان مثل تسمم غذائي، أو حالة رمادية).

السبب (reason) يُعرض للمستخدم إذا رفضت: جملة وحدة لطيفة بلهجة سعودية بيضاء بدون اتهام.
أجب بـ JSON فقط: {"decision":"approve|reject|review","reason":"..."}`;

/** يرجع {status: visible|pending|rejected, reason, by} — لو Claude ما رد ننشر التقييم عادي */
export async function moderateReview(env, text, ctx = {}, aiOn = true) {
  const bad = quickFilter(text);
  if (bad) return { status: 'rejected', reason: bad.replace('المشاركة فيها', 'التقييم فيه'), by: 'filter' };
  if (!aiOn || !env.ANTHROPIC_API_KEY || String(text).trim().length < 4) return { status: 'visible', reason: '', by: 'off' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.MODERATION_MODEL || 'claude-haiku-5-5', max_tokens: 200, system: REVIEW_RULES,
        messages: [{ role: 'user', content: `المكان: ${ctx.place || ''}\nالنجوم: ${ctx.stars || ''} من 5\nنص التقييم:\n${text}` }] }),
    });
    if (!r.ok) throw new Error('anthropic_' + r.status);
    const j = await r.json();
    const m = String(j.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
    const v = m ? JSON.parse(m[0]) : null;
    const d = v && ['approve', 'reject', 'review'].includes(v.decision) ? v.decision : 'review';
    return { status: d === 'approve' ? 'visible' : d === 'reject' ? 'rejected' : 'pending', reason: String(v?.reason || '').slice(0, 200), by: 'ai' };
  } catch (e) {
    return { status: 'visible', reason: String(e.message || e).slice(0, 80), by: 'error' };
  } finally { clearTimeout(timer); }
}

/** رسالة للمستخدم حسب النتيجة */
export function modMessage(status, reason) {
  if (status === 'pending') return 'وصلت مشاركتك، وبتظهر بعد مراجعة سريعة من فريق الدليل.';
  if (status === 'rejected') return reason || 'ما قدرنا ننشر مشاركتك لأنها تخالف قواعد المجتمع.';
  return '';
}

/* ═════════ مراجعة اقتراحات الأماكن الجديدة ═════════
   Claude يفرز الاقتراح (حقيقي / وهمي أو إعلان) ويجهّز ملخص ووصف قصير وتصنيف — من المعلومات اللي كتبها المستخدم فقط */
const KINDS_AR = { sights: 'معلم', heritage: 'تراث', islamic: 'معلم إسلامي', nature: 'طبيعة', food: 'مطعم', cafe: 'مقهى', shopping: 'تسوق', fun: 'ترفيه' };
const SUGGEST_RULES = `أنت محرر في تطبيق "دليل السعودية" (دليل سياحي للأماكن في السعودية). يوصلك اقتراح مكان جديد من مستخدم.
مهمتك:
1) تقرر: approve إذا الاقتراح يبدو مكان حقيقي يستاهل يكون في دليل سياحي (معلم، مطعم، مقهى، طبيعة، تسوق، ترفيه، تراث، مسجد تاريخي...).
   reject إذا كان كلام بلا معنى، أو تجربة، أو سب، أو إعلان واضح لخدمة شخصية (توصيل، تأجير، خدمات منزلية، أرقام للتواصل التجاري)، أو مكان غير مناسب (منزل خاص، شخص)، أو مخالف للأنظمة.
   review إذا غير متأكد.
2) تجهز للمحرر (لو approve أو review):
   - summary: سطر واحد (حتى 90 حرف) يعرّف المكان بلغة عربية سهلة.
   - body: فقرة أو فقرتين قصيرة (حتى 350 حرف) تعرّف المكان وتنصح الزائر، مبنية فقط على المعلومات المكتوبة في الاقتراح (الاسم، النوع، المدينة، ملاحظة المستخدم). لا تخترع أسعار أو تواريخ أو تقييمات أو معلومات ما ذكرها المستخدم.
   - kind: واحد من sights, heritage, islamic, nature, food, cafe, shopping, fun.
   - cats: من 1 إلى 3 تصنيفات عربية قصيرة (مثل: مطاعم، مقاهي، معالم سياحية، تراث، طبيعة، تسوق، ترفيه، عائلية).
3) reason: سبب قصير. لو رفضت، اكتبه بلهجة سعودية لطيفة يُعرض للمستخدم.
أجب بـ JSON فقط: {"decision":"approve|reject|review","reason":"...","summary":"...","body":"...","kind":"...","cats":["..."]}`;

export async function reviewSuggestion(env, d, aiOn = true) {
  const bad = quickFilter(`${d.title || ''} ${d.note || ''}`); // الجوال والموقع لهم خانات خاصة، فنفحص الاسم والملاحظة بس
  if (bad) return { decision: 'reject', reason: bad, by: 'filter' };
  if (!aiOn || !env.ANTHROPIC_API_KEY) return { decision: 'review', reason: '', by: 'off' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const txt = [`الاسم: ${d.title}`, `المدينة: ${d.cityName || d.city}`, `النوع اللي اختاره المستخدم: ${KINDS_AR[d.kind] || 'ما حدد'}`, d.address ? `العنوان: ${d.address}` : '', d.hours ? `ساعات العمل: ${d.hours}` : '', d.website ? `الموقع/الحساب: ${d.website}` : '', `ملاحظة المستخدم: ${d.note || '-'}`, `عدد الصور المرفقة: ${(d.photos || []).length}`].filter(Boolean).join('\n');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.MODERATION_MODEL || 'claude-haiku-5-5', max_tokens: 600, system: SUGGEST_RULES, messages: [{ role: 'user', content: txt }] }),
    });
    if (!r.ok) throw new Error('anthropic_' + r.status);
    const j = await r.json();
    const m = String(j.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
    const v = m ? JSON.parse(m[0]) : {};
    const decision = ['approve', 'reject', 'review'].includes(v.decision) ? v.decision : 'review';
    return {
      decision, by: 'ai', reason: String(v.reason || '').slice(0, 200),
      summary: String(v.summary || '').slice(0, 140), body: String(v.body || '').slice(0, 700),
      kind: KINDS_AR[v.kind] ? v.kind : '', cats: (Array.isArray(v.cats) ? v.cats : []).map(String).slice(0, 3),
    };
  } catch (e) {
    return { decision: 'review', reason: String(e.message || e).slice(0, 80), by: 'error' };
  } finally { clearTimeout(timer); }
}
