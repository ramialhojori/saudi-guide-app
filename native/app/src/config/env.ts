/**
 * إعدادات البيئة — ما فيها أي مفتاح سري (المفاتيح كلها في Cloudflare).
 * EXPO_PUBLIC_API_URL: رابط سيرفر الدليل. لو فاضي، التطبيق يشتغل من النسخة المدمجة (src/data/snapshot.json)
 * — مفيد وقت التطوير قبل ما ننشر السيرفر، ويخلي التطبيق يفتح حتى بدون نت.
 */
export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://saudi-guide-api.saudi-guide2030.workers.dev',
  siteUrl: 'https://www.saudi-guide.com',
  timeZone: 'Asia/Riyadh',
} as const;
