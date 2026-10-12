<div dir="rtl">

# سيرفر دليل السعودية (Cloudflare Worker + D1)

## أول نشر (بعد ما يفتح رامي حساب Cloudflare)
```bash
npm install
npx wrangler login
npx wrangler d1 create saudi-guide          # انسخ database_id
cp wrangler.example.toml wrangler.toml      # والصق database_id فيه
npx wrangler r2 bucket create saudi-guide-media
npx wrangler secret put ADMIN_KEY
npx wrangler secret put GB_API_TOKEN        # مفتاح قودبابر (من صفحة Public API / MCP server)
npx wrangler deploy
npm run seed:remote                          # أول تعبئة من seed/seed.sql
curl -X POST -H "X-Admin-Key: …" -H "Content-Type: application/json" --data-binary @seed/weekly_pool.json https://…/admin/weekly
```

## الملفات
| | |
|---|---|
| `src/index.js` | المسارات (مرجع: `../docs/api/API.md`) |
| `src/sync.js` | المزامنة من قودبابر + الاستيراد + إشعارات الجديد |
| `src/normalize.js` | تحويل عناصر قودبابر (نفس منطق `scripts/normalize.py`) |
| `schema.sql` → `src/schema.js` | المخطط (`npm run schema` بعد أي تعديل) |
| `scripts/normalize.py` | يحوّل تصدير قودبابر إلى `seed/` ونسخة التطبيق المدمجة |
| `seed/weekly_pool.json` | 78 مكان لمختارات الأسبوع (w شتاء · s صيف · a طول السنة · x معلم بارز) |

## تحديث نسخة التطبيق المدمجة
```bash
python3 scripts/normalize.py /path/to/raw.json   # يكتب seed/ و ../app/src/data/snapshot.json
```

</div>
