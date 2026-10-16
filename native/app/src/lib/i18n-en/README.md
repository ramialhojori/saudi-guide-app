# ترجمة واجهة التطبيق (UI i18n) — How to wrap strings

- Import: `import { t, tr, isEn } from '@/lib/i18n';`
- Static Arabic UI text → `t('النص العربي')`. In JSX: `<AppText>{t('حفظ')}</AppText>`; props: `placeholder={t('ابحث')}`, `label={t('...')}`.
- Variables: `` `${n} مكان` `` → `t('{n} مكان', { n })`. Keep the Arabic key with `{name}` placeholders; the English value uses the same placeholders.
- Arabic plural/dual forms or sentences whose structure differs → `tr('عربي', 'English')` inline (no dictionary entry needed).
- Add every `t()` key to YOUR group file in `src/lib/i18n-en/<group>.ts` as `'Arabic key': 'English',` (keys must match exactly, including punctuation and spaces).
- Do NOT translate: user content from the API (place titles, posts), Arabic city/place names coming from data, comments, console logs, analytics event names, API error codes, route paths.
- Arabic-only punctuation in UI (، ؟ «») → use English punctuation in the English value.
- Arrows/chevrons like '‹' that point "forward" in RTL: use `isEn ? '›' : '‹'`.
- Numbers/dates: if a date is formatted with 'ar-SA'/'ar' locale, switch to `isEn ? 'en-GB' : 'ar-SA'` (keep Gregorian calendar options as they are).
- Style: short, friendly, natural English for tourists (e.g. "رايح" → "Going", "وين تبي تروح هالويكند؟" → "Where to this weekend?"). Brand: دليل السعودية = Saudi Guide, دليل+ = Dalil+ (keep), اسأل الدليل = Ask the Guide.
- Never change behaviour, layout, or styles other than what is needed for t()/tr().
