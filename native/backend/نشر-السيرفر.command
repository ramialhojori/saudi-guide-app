#!/bin/bash
# ينشر آخر نسخة من سيرفر الدليل على Cloudflare (ما يلمس البيانات ولا المفاتيح)
cd "$(dirname "$0")" || exit 1
echo "== نشر سيرفر دليل السعودية =="
npx wrangler deploy && echo "" && echo "تم النشر. جرّب: https://saudi-guide-api.saudi-guide2030.workers.dev/v1" 
echo ""; read -p "اضغط Enter للإغلاق"
