#!/bin/bash
# يرفع ترجمات المحتوى الإنجليزية (backend/data/en/*.json) لسيرفر الدليل
# الملفات: places-*.json للأماكن، events-*.json للفعاليات، articles-*.json للأخبار
cd "$(dirname "$0")" || exit 1
KEYS="backend/مفاتيح-سرية.txt"
ADMIN_KEY="$(grep -E '^ADMIN_KEY=' "$KEYS" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/[[:space:]]*$//')"
[ -z "$ADMIN_KEY" ] && { echo "❌ ما لقيت ADMIN_KEY في $KEYS"; read -p "اضغط Enter للإغلاق"; exit 1; }
export ADMIN_KEY
python3 - <<'EOF'
import glob, json, os, urllib.request
API = "https://saudi-guide-api.saudi-guide2030.workers.dev/admin/translations"
KEY = os.environ["ADMIN_KEY"]
def post(body):
    req = urllib.request.Request(API, data=json.dumps(body).encode(), method="POST",
        headers={"X-Admin-Key": KEY, "Content-Type": "application/json", "User-Agent": "saudi-guide-uploader"})
    with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)
total = {"saved": 0, "skipped": 0}
for f in sorted(glob.glob("backend/data/en/*.json")):
    name = os.path.basename(f)
    kind = "place" if name.startswith("places") else "event" if name.startswith("events") else "article" if name.startswith("articles") else None
    if not kind: continue
    items = json.load(open(f, encoding="utf-8"))
    ids = list(items)
    for i in range(0, len(ids), 50):
        part = {k: items[k] for k in ids[i:i+50]}
        r = post({"kind": kind, "items": part})
        total["saved"] += r.get("saved", 0); total["skipped"] += r.get("skipped", 0)
    print(f"✓ {name}: {len(ids)}")
print(f"\nالمحفوظ: {total['saved']}  |  المتجاهل (مو موجود بالدليل): {total['skipped']}")
req = urllib.request.Request(API, headers={"X-Admin-Key": KEY, "User-Agent": "saudi-guide-uploader"})
print("الحالة:", urllib.request.urlopen(req, timeout=30).read().decode())
EOF
echo ""; read -p "اضغط Enter للإغلاق"
