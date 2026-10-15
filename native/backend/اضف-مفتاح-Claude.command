#!/bin/bash
# يضيف مفتاح Anthropic للسيرفر عشان تشتغل «المراجعة الذكية» في «اسأل أهل المدينة»
# الطريقة: انسخ المفتاح من console.anthropic.com (Cmd+C) وبعدها شغّل هذا الأمر.
# المفتاح ما ينطبع ولا ينرسل لأي مكان غير Cloudflare، وينحفظ في مفاتيح-سرية.txt (مستثنى من git)
cd "$(dirname "$0")" || exit 1
KEYS="مفاتيح-سرية.txt"
get(){ grep "^$1=" "$KEYS" | head -1 | cut -d= -f2- | tr -d ' \r\n'; }
export CLOUDFLARE_API_TOKEN="$(get CLOUDFLARE_API_TOKEN)"
[ -z "$CLOUDFLARE_API_TOKEN" ] && { echo "❌ مفتاح Cloudflare فاضي في $KEYS"; read -p "Enter للإغلاق"; exit 1; }
K="$(pbpaste | tr -d ' \r\n')"
if [[ "$K" != sk-ant-* ]]; then
  K="$(get ANTHROPIC_API_KEY)"
  if [[ "$K" != sk-ant-* ]]; then
    echo "❌ ما لقيت مفتاح Anthropic في الحافظة."
    echo "   1) افتح https://console.anthropic.com/settings/keys وسوّ مفتاح جديد باسم «دليل السعودية»"
    echo "   2) انسخه (Cmd+C) وشغّل هذا الأمر مرة ثانية"
    open "https://console.anthropic.com/settings/keys"; read -p "Enter للإغلاق"; exit 1
  fi
  echo "✓ استخدمت المفتاح المحفوظ في $KEYS"
else
  grep -v '^ANTHROPIC_API_KEY=' "$KEYS" > "$KEYS.tmp" && mv "$KEYS.tmp" "$KEYS"
  printf 'ANTHROPIC_API_KEY=%s\n' "$K" >> "$KEYS"
  printf '' | pbcopy
  echo "✓ انحفظ المفتاح في $KEYS وانمسح من الحافظة"
fi
printf '%s' "$K" | npx wrangler secret put ANTHROPIC_API_KEY >/dev/null 2>&1 && echo "✓ المراجعة الذكية صارت شغالة في السيرفر" || { echo "❌ ما قدرت أضيفه للسيرفر. صوّر الشاشة وقل لي."; }
read -p "Enter للإغلاق"
