import { isEn, t } from './i18n';
/** نص البحث: بدون تشكيل، الهمزات والتاء المربوطة موحّدة، وبدون «ال» — نفس دالة السيرفر */
export function searchKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/(^|\s)ال/g, '$1')
    .replace(/[-|_,.،]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function km(a: number, b: number, c: number, d: number): number {
  const R = 6371, x = ((c - a) * Math.PI) / 180, y = ((d - b) * Math.PI) / 180;
  const h = Math.sin(x / 2) ** 2 + Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

export type Block = { kind: 'p'; parts: { text: string; bold?: boolean; href?: string }[] };

/** يحوّل HTML قودبابر (فقرات + عريض + روابط) لكتل نعرضها بنصوص أصلية بدون WebView */
export function htmlToBlocks(html: string): Block[] {
  const paras = html.replace(/<br\s*\/?>/g, '\n').split(/<\/p>|<\/div>|\n{2,}/);
  const out: Block[] = [];
  for (const raw of paras) {
    const parts: Block['parts'] = [];
    const re = /<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>|<(strong|b)>([\s\S]*?)<\/\3>|([^<]+)|<[^>]+>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      const dec = (t: string) => t.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, (e) => ENT[e] ?? e);
      if (m[1]) parts.push({ text: dec(m[2]), href: m[1] });
      else if (m[3]) parts.push({ text: dec(m[4]), bold: true });
      else if (m[5]) parts.push({ text: dec(m[5]) });
    }
    const text = parts.map((p) => p.text).join('').trim();
    if (text) out.push({ kind: 'p', parts });
  }
  return out;
}

const MO = isEn ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
/** «23 أكتوبر · 9:00 م» بتوقيت مكة */
export function riyadhDate(iso: string, withTime = true): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 3 * 3600e3);
  const h = d.getUTCHours(), mi = d.getUTCMinutes();
  const tm = `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h < 12 ? t('ص') : t('م')}`;
  return `${d.getUTCDate()} ${MO[d.getUTCMonth()]}${withTime ? ' · ' + tm : ''}`;
}

/** موعد الفعالية: لو بدأت وما خلصت → «مستمرة حتى 31 ديسمبر» */
export function eventWhen(start: string, end: string): string {
  const now = Date.now();
  if (start && new Date(start).getTime() < now && end && new Date(end).getTime() > now) return t('مستمرة حتى {date}', { date: riyadhDate(end, false) });
  return riyadhDate(start);
}

/** روابط موقع دليل السعودية القديم ما تنعرض في التطبيق أبداً (الدومين بينتقل للتطبيق الأصلي) */
export const isOwnSite = (u?: string | null) => !!u && /(^|\/\/|\.)saudi-guide\.com|saudiguide\.carizmaapp/i.test(u);
export const extLink = (u?: string | null) => (u && !isOwnSite(u) ? u : '');
