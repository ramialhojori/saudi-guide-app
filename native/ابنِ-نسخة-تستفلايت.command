#!/bin/bash
# يبني نسخة iOS للمتجر على سيرفرات Expo ويرفعها لـ TestFlight تلقائياً
# تنبيه: لو سألك يلغي (Revoke) أي شهادة قل No وصوّر الشاشة لـ Claude
cd "$(dirname "$0")/app" || exit 1
echo "== تثبيت المكتبات =="
npm install --no-package-lock --no-audit --no-fund || exit 1  # ما نعدل ملف القفل: نسخته مجهزة تطابق سيرفر البناء
echo "== البناء والرفع لـ TestFlight (ياخذ 20-40 دقيقة) =="
npx -y eas-cli@latest build -p ios --profile production --auto-submit --non-interactive
echo
echo "خلص. اضغط Enter للإغلاق"
read
