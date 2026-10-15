#!/bin/bash
# ينشر سيرفر الدليل ثم موقع الويب بخطوة وحدة
cd "$(dirname "$0")" || exit 1
KEYS="backend/مفاتيح-سرية.txt"
get() { grep -E "^$1=" "$KEYS" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/[[:space:]]*$//'; }
export CLOUDFLARE_API_TOKEN="$(get CLOUDFLARE_API_TOKEN)"
export CLOUDFLARE_ACCOUNT_ID="1a9840daeee3a68b62a00be716164393"
[ -z "$CLOUDFLARE_API_TOKEN" ] && { echo "❌ مفتاح Cloudflare فاضي في $KEYS"; read -p "اضغط Enter للإغلاق"; exit 1; }
echo "== 1) سيرفر الدليل =="
(cd backend && npx wrangler deploy) || { echo "❌ نشر السيرفر ما كمل"; read -p "اضغط Enter للإغلاق"; exit 1; }
echo ""; echo "== 2) موقع الويب =="
WR="$PWD/backend/node_modules/.bin/wrangler"; [ -x "$WR" ] || WR="npx wrangler"
(cd web && $WR deploy) || { echo "❌ نشر الموقع ما كمل"; read -p "اضغط Enter للإغلاق"; exit 1; }
echo ""; echo "-- فحص سريع:"
curl -s https://saudi-guide-api.saudi-guide2030.workers.dev/v1; echo ""
curl -s -o /dev/null -w "الموقع: %{http_code}\n" https://saudi-guide-web.saudi-guide2030.workers.dev/
echo "✓ تم نشر الاثنين"
echo "  الموقع التجريبي: https://saudi-guide-web.saudi-guide2030.workers.dev"
echo ""; read -p "اضغط Enter للإغلاق"
