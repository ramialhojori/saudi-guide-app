#!/bin/bash
# يشغّل السيرفر المحلي لـ«نسخة التجربة الخاصة» (Development Build) — مو Expo Go
cd "$(dirname "$0")"
echo "== دليل السعودية · النسخة الخاصة =="
npm install --no-package-lock --no-fund --no-audit || { read -p "❌ Enter للإغلاق"; exit 1; }
echo ""
echo "-- افتح تطبيق «دليل السعودية» على الآيفون وامسح الرمز، أو اختره من القائمة"
echo "-- (لازم الجوال والماك على نفس الواي فاي) · للإيقاف: Ctrl + C"
npx expo start --dev-client --clear
