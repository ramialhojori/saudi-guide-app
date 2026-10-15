/* إشعارات الجوال للأشياء الشخصية (رد على سؤالك، انقبلت صورتك، رد التواصل...)
   أي إشعار ينضاف في notifications لمستخدم عنده جوال مسجّل → ينرسل كإشعار جوال بعدها بثواني
   - نحترم تفضيلات الجهاز (المجتمع، العروض...) وساعات الهدوء (11 م – 8 ص بتوقيت مكة: يتأجل للصبح)
   - الرسائل الجماعية من اللوحة لها مسارها الخاص (messages.js) وتنحفظ pushed=1 عشان ما تتكرر */
import { sendPush } from './messages.js';

const now = () => Math.floor(Date.now() / 1000);
const quiet = () => { const h = new Date(Date.now() + 3 * 3600e3).getUTCHours(); return h >= 23 || h < 8; };

/** نوع الإشعار → مفتاح التفضيل في الجهاز */
function prefKey(n) {
  if (n.type === 'answer' || n.type === 'thanks' || n.type === 'best') return 'community';
  const l = String(n.link || '');
  if (l.startsWith('/coupons')) return 'offers';
  if (l.startsWith('/question')) return 'community';
  if (l.startsWith('/event') || l.startsWith('/season')) return 'events';
  if (l.startsWith('/city/') || l.startsWith('/place/')) return 'places';
  return null; // إشعارات الحساب (مراجعة، تواصل، نقاط) تنرسل دايماً
}
const TITLE = { answer: 'جاك رد على سؤالك', thanks: 'أحد شكرك', best: 'اختاروا إجابتك الأفضل' };

let running = false;
export async function pushPending(env) {
  if (env.PUSH_ENABLED !== '1' || running || quiet()) return;
  running = true;
  try {
    const { results } = await env.DB.prepare(`SELECT n.id, n.user_id, n.type, n.text, n.link, n.post_id FROM notifications n
      WHERE n.pushed=0 AND n.created>? AND n.user_id IN (SELECT user_id FROM devices WHERE user_id IS NOT NULL) ORDER BY n.id LIMIT 200`).bind(now() - 12 * 3600).all();
    if (!results.length) return;
    await env.DB.prepare(`UPDATE notifications SET pushed=1 WHERE id IN (${results.map((r) => +r.id).join(',')})`).run();
    for (const n of results) {
      const devs = await env.DB.prepare('SELECT token, prefs FROM devices WHERE user_id=?').bind(n.user_id).all();
      const key = prefKey(n);
      const tokens = devs.results.filter((d) => { if (!key) return true; try { return JSON.parse(d.prefs || '{}')[key] !== false; } catch { return true; } }).map((d) => d.token);
      if (!tokens.length) continue;
      const link = n.link || (n.post_id ? `/question/${n.post_id}` : '/inbox');
      await sendPush(env, tokens, { title: TITLE[n.type] || 'دليل السعودية', text: n.text, link });
    }
  } finally { running = false; }
}
