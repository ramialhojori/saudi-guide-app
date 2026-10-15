#!/bin/bash
# ينشر موقع دليل السعودية (نسخة الويب) على Cloudflare — يقرأ المفتاح من backend/مفاتيح-سرية.txt ولا يطبعه.
cd "$(dirname "$0")" || exit 1
KEYS="../backend/مفاتيح-سرية.txt"
get() { grep -E "^$1=" "$KEYS" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/[[:space:]]*$//'; }
export CLOUDFLARE_API_TOKEN="$(get CLOUDFLARE_API_TOKEN)"
export CLOUDFLARE_ACCOUNT_ID="1a9840daeee3a68b62a00be716164393"
[ -z "$CLOUDFLARE_API_TOKEN" ] && { echo "❌ مفتاح Cloudflare فاضي في $KEYS"; read -p "اضغط Enter للإغلاق"; exit 1; }
[ -f dist/index.html ] || { echo "❌ ملفات الموقع (dist) ناقصة"; read -p "اضغط Enter للإغلاق"; exit 1; }
wr() { if [ -x "../backend/node_modules/.bin/wrangler" ]; then "../backend/node_modules/.bin/wrangler" "$@"; else npx wrangler "$@"; fi; }
echo "== نشر موقع دليل السعودية =="
if wr deploy; then
  echo ""; echo "-- فحص سريع:"
  curl -s -o /dev/null -w "الصفحة الرئيسية: %{http_code}\n" https://saudi-guide-web.saudi-guide2030.workers.dev/
  curl -s -o /dev/null -w "رابط قودبابر القديم يتحول: %{http_code} → %{redirect_url}\n" https://saudi-guide-web.saudi-guide2030.workers.dev/medina/i/59407890/masjid-quba
  echo "✓ تم النشر — الرابط التجريبي: https://saudi-guide-web.saudi-guide2030.workers.dev"
else
  echo "❌ النشر ما كمل"
fi
echo ""; read -p "اضغط Enter للإغلاق"
