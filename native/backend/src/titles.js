/** «ممشى الهجرة - Al Hijra Walkway» → العربي بس (والإنجليزي يطلع لما اللغة إنجليزي من جدول الترجمات) */
export const arTitle = (t) => { const m = String(t || '').match(/^(.*?[\u0600-\u06FF].*?)\s+[-–]\s+[A-Za-z][^\u0600-\u06FF]*$/); return m ? m[1].trim() : String(t || ''); };
export const enPart = (t) => { const m = String(t || '').match(/\s[-–]\s+([A-Za-z][^\u0600-\u06FF]*)$/); return m ? m[1].trim() : ''; };
