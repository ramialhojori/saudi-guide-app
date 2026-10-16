# Saudi Guide — English translation guide (places)

Audience: international tourists and English-speaking residents visiting Saudi Arabia.
Tone: clear, warm, factual travel-guide English (like a good Lonely Planet blurb). No marketing fluff, no emoji.

Rules
- Translate meaning, not word-for-word. Keep every fact (distances, areas, years, numbers, opening info). Do not add facts.
- Place names: if the Arabic title already contains an English name after " - " (e.g. "ممشى الهجرة - Al Hijra Walkway"), use that English name exactly as the English title. Otherwise transliterate/translate the proper name naturally ("مسجد قباء" → "Quba Mosque", "جبل أحد" → "Mount Uhud", "سوق الزل" → "Souq Al Zal").
- Common terms: المسجد النبوي = The Prophet's Mosque; الحرم المكي / المسجد الحرام = The Grand Mosque (Masjid al-Haram); الكعبة = the Kaaba; العمرة = Umrah; الحج = Hajj; رؤية المملكة 2030 = Saudi Vision 2030; جودة الحياة = Quality of Life Program; أمانة = Municipality; هيئة = Authority/Commission (use official English name when well known, e.g. الهيئة الملكية لمحافظة العلا = Royal Commission for AlUla).
- City names: Riyadh, Jeddah, Madinah, Makkah, AlUla, Diriyah, Abha, Taif, Tabuk, Hail, Al-Qassim, Buraydah, Unaizah, Yanbu, Umluj, Jazan, Najran, Al-Baha, Al-Jouf, Northern Borders, Eastern Province, Al-Ahsa, Dammam, Khobar, Dhahran, Asir.
- Religious phrases: keep respectful; ﷺ → "(peace be upon him)" only where the Arabic has it.
- Address: translate/transliterate street & district names ("حي القصواء، شارع عكرمة بن أبي جهل" → "Al Qaswa District, Ikrimah ibn Abi Jahl Street").
- The image-credit line "الصور لأغراض تعريفية، وتعود حقوقها لأصحابها." → omit it (the app shows its own credit).
- Body: plain text, paragraphs separated by "\n\n". No HTML.
- If summary and body are identical/overlapping, translate both anyway (summary must stand alone, ≤ 2 sentences ideal but keep source length).

Output JSON shape per item (id as string key):
{"98094402": {"t": "Al Hijra Walkway", "s": "...summary...", "b": "...body...", "a": "...address or empty..."}}
