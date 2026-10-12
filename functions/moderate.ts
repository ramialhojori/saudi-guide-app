// Supabase Edge Function: moderate
// يراجع الأسئلة والإجابات والكوبونات الجديدة بالذكاء الاصطناعي (Claude) ويقبلها أو يرفضها أو يتركها للمراجعة اليدوية.
// يحتاج سر واحد في Supabase: ANTHROPIC_API_KEY (يضيفه المالك بنفسه). بدونه تبقى المشاركات "pending" للمراجعة اليدوية.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("MODERATION_MODEL") ?? "claude-haiku-5-5";

const RULES = `أنت مشرف محتوى لميزة "اسأل أهل المدينة" في تطبيق "دليل السعودية" (دليل سياحي للسعودية).
الزوار يسألون عن المدن السعودية (أكل، أماكن، سكن، مواصلات، فعاليات، عائلات، أسعار) وأهل المدينة يجاوبون.

اقبل (approve) إذا كان النص:
- سؤالاً أو جواباً حقيقياً مفيداً عن السياحة أو الحياة اليومية أو الخدمات في مدينة سعودية، حتى لو كان بسيطاً أو بلهجة عامية أو فيه أخطاء إملائية.
- الجواب يرد فعلاً على السؤال أو يضيف معلومة مفيدة له.

ارفض (reject) إذا كان فيه أي من:
- إعلان أو ترويج تجاري أو طلب تواصل خارج التطبيق، أو أرقام جوال أو روابط أو حسابات تواصل.
- سب أو شتم أو تنمر أو عنصرية أو تحريض أو كلام جنسي أو خادش.
- محتوى سياسي أو طائفي أو إساءة لدين أو جنسية أو قبيلة أو أشخاص بأسمائهم.
- معلومات شخصية لأفراد (عناوين بيوت، أسماء كاملة لأشخاص عاديين).
- كلام لا معنى له، أو تجربة كتابة، أو تكرار حروف، أو نص خارج الموضوع تماماً.
- شيء مخالف للأنظمة في السعودية أو فيه ترويج لممنوعات.

اختر "review" إذا كنت غير متأكد (مثلاً معلومة قد تكون خاطئة وتضر، أو شكوى من جهة محددة باسمها، أو حالة رمادية).

أجب بـ JSON فقط بدون أي نص آخر، بالشكل: {"decision":"approve|reject|review","reason":"سبب قصير بالعربي"}`;


const RULES_COUPON = `أنت مشرف كوبونات في تطبيق "دليل السعودية". المستخدمون يشاركون كوبونات خصم لمتاجر ومطاعم ومقاهي وفنادق في السعودية، ويجب أن يرفقوا رابط مصدر الكود.

اقبل (approve) إذا:
- الكوبون يبدو حقيقياً لمتجر أو جهة موجودة في السعودية، ووصف العرض واضح.
- رابط المصدر يبدو رسمياً للمتجر نفسه: موقعه أو حسابه في إنستقرام/تويتر(X)/تيك توك/سناب، أو صفحة عرض رسمية لدى جهة معروفة (تطبيق توصيل أو بنك أو موقع حجز) تذكر نفس المتجر.

ارفض (reject) إذا:
- كود دعوة أو إحالة شخصي (referral/invite) يستفيد منه صاحبه، مثل كودات "ادعُ صديقك" في تطبيقات التوصيل والنقل والبنوك، أو كود باسم شخص أو مشهور غير مرتبط بعرض رسمي.
- رابط المصدر لا علاقة له بالمتجر، أو رابط مختصر/مشبوه، أو رابط لحساب شخصي.
- إعلان أو ترويج لخدمة شخصية، أو أرقام جوال أو طلب تواصل.
- منتج أو خدمة ممنوعة في السعودية، أو محتوى خادش أو مسيء.
- كلام بلا معنى أو تجربة كتابة، أو خصم مبالغ فيه غير منطقي (مثل 95٪ على كل شيء).

اختر "review" إذا لم تستطع التأكد من أن الرابط يخص نفس المتجر، أو كان الاسم عاماً جداً، أو أي حالة رمادية.

أجب بـ JSON فقط بدون أي نص آخر، بالشكل: {"decision":"approve|reject|review","reason":"سبب قصير بالعربي"}`;

async function classify(kind: string, text: string, ctx: string) {
  const label = kind === "answers" ? "الجواب المطلوب مراجعته:\n" : kind === "coupons" ? "الكوبون المطلوب مراجعته:\n" : "السؤال المطلوب مراجعته:\n";
  const user = (ctx ? ctx + "\n\n" : "") + label + text;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 200, system: kind === "coupons" ? RULES_COUPON : RULES, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error("anthropic " + r.status + " " + (await r.text()).slice(0, 200));
  const j = await r.json();
  const out = (j.content?.[0]?.text ?? "").trim();
  const m = out.match(/\{[\s\S]*\}/);
  const v = m ? JSON.parse(m[0]) : null;
  const d = v && ["approve", "reject", "review"].includes(v.decision) ? v.decision : "review";
  return { decision: d, reason: String(v?.reason ?? "").slice(0, 300) };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const table = body.table;
    const id = body.id ?? body.record?.id;
    if (!["questions", "answers", "coupons"].includes(table) || !id) return new Response("bad request", { status: 400 });
    // نعيد قراءة السجل من القاعدة؛ ما نثق بأي نص يجي في الطلب
    const { data: rec } = await sb.from(table).select("*").eq("id", id).single();
    if (!rec || rec.status !== "pending" || rec.moderated_at) return new Response("skip");
    if (!KEY) return new Response("no key, left for manual review");
    if (table === "coupons") {
      if (rec.kind !== "user") return new Response("skip official");
      const text = [
        `المتجر: ${rec.store_name}`, `المدينة: ${rec.city}`, `التصنيف: ${rec.category}`,
        `العرض: ${rec.title}`, `القيمة: ${rec.value ?? "-"} (${rec.unit})`, `الكود: ${rec.code ?? "بدون كود"}`,
        `رابط المصدر: ${rec.source_url ?? "لا يوجد"}`, `ينتهي: ${rec.expires_at ?? "غير محدد"}`,
      ].join("\n");
      const res = await classify("coupons", text, "");
      // درجات الثقة: المستخدم الجديد (أقل من كوبونين مقبولين) تروح كوبوناته للمدير حتى لو قبلها المراجع
      let decision = res.decision;
      if (decision === "approve") {
        const { count } = await sb.from("coupons").select("id", { count: "exact", head: true })
          .eq("gb_user_id", rec.gb_user_id).eq("kind", "user").eq("status", "approved").neq("id", id);
        if ((count ?? 0) < 2) decision = "trust";
      }
      const note = decision === "trust" ? `review: مستخدم جديد، المراجع قبله: ${res.reason}` : `${decision}: ${res.reason}`;
      const patch: Record<string, unknown> = { moderation_note: note, moderated_at: new Date().toISOString() };
      if (decision === "approve") patch.status = "approved";
      if (decision === "reject") patch.status = "rejected";
      await sb.from("coupons").update(patch).eq("id", id).eq("status", "pending");
      return new Response(JSON.stringify({ decision, reason: res.reason }), { headers: { "content-type": "application/json" } });
    }
    let ctx = "";
    if (table === "answers") {
      const { data: q } = await sb.from("questions").select("body,city,status").eq("id", rec.question_id).single();
      if (!q || q.status !== "approved") return new Response("question not approved");
      ctx = `السؤال الأصلي (${q.city}): ${q.body}`;
    } else {
      ctx = `المدينة: ${rec.city}`;
    }
    const res = await classify(table, rec.body + (rec.author_name ? `\n(اسم الكاتب: ${rec.author_name})` : ""), ctx);
    const patch: Record<string, unknown> = { moderation_note: `${res.decision}: ${res.reason}`, moderated_at: new Date().toISOString() };
    if (res.decision === "approve") patch.status = "approved";
    if (res.decision === "reject") patch.status = "rejected";
    await sb.from(table).update(patch).eq("id", id).eq("status", "pending");
    return new Response(JSON.stringify(res), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response("error: " + String(e).slice(0, 300), { status: 500 });
  }
});
