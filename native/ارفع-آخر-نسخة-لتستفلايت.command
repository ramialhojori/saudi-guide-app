#!/bin/bash
# يرفع آخر نسخة iOS انبنت على Expo إلى TestFlight (بدون بناء جديد)
cd "$(dirname "$0")/app" || exit 1
npx -y eas-cli@latest submit -p ios --latest --profile production --non-interactive
echo
echo "خلص. اضغط Enter للإغلاق"
read
