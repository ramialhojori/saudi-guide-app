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
    const context = kind === 'answer' ? `السؤال الأصلي${ctx.city ? ` (${ctx.city})` : ''}: ${ctx.question || ''}` : ctx.city ? `المدينة: ${ctx.city}` : '';
    const label = kind === 'answer' ? 'الجواب المطلوب مراجعته:' : 'المشاركة المطلوب مراجعتها (سؤال أو نصيحة):';
    const res = await askClaude(env, label, text, context);
    const status = res.decision === 'approve' ? 'visible' : res.decision === 'reject' ? 'rejected' : 'pending';
    return { status, reason: res.reason, by: 'ai' };
  } catch (e) {
    return { status: 'visible', reason: String(e.message || e).slice(0, 80), by: 'error' };
  }
}

/** رسالة للمستخدم حسب النتيجة */
export function modMessage(status, reason) {
  if (status === 'pending') return 'وصلت مشاركتك، وبتظهر بعد مراجعة سريعة من فريق الدليل.';
  if (status === 'rejected') return reason || 'ما قدرنا ننشر مشاركتك لأنها تخالف قواعد المجتمع.';
  return '';
}
