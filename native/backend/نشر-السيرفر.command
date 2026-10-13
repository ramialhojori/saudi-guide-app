#!/bin/bash
# ينشر آخر نسخة من سيرفر الدليل على Cloudflare (ما يلمس البيانات ولا المفاتيح)
# يقرأ مفتاح Cloudflare من مفاتيح-سرية.txt ولا يطبعه.
cd "$(dirname "$0")" || exit 1
KEYS="مفاتيح-سرية.txt"
get() { grep -E "^$1=" "$KEYS" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/[[:space:]]*$//'; }
export CLOUDFLARE_API_TOKEN="$(get CLOUDFLARE_API_TOKEN)"
export CLOUDFLARE_ACCOUNT_ID="1a9840daeee3a68b62a00be716164393"
[ -z "$CLOUDFLARE_API_TOKEN" ] && { echo "❌ مفتاح Cloudflare فاضي في $KEYS"; read -p "اضغط Enter للإغلاق"; exit 1; }
echo "== نشر سيرفر دليل السعودية =="
if npx wrangler deploy; then
  echo ""; echo "-- فحص سريع:"; curl -s https://saudi-guide-api.saudi-guide2030.workers.dev/v1; echo ""
  curl -s "https://saudi-guide-api.saudi-guide2030.workers.dev/v1/community" | head -c 120; echo ""
  echo "✓ تم النشر"
else
  echo "❌ النشر ما كمل"
fi
echo ""; read -p "اضغط Enter للإغلاق"
