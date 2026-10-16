/** القاموس الإنجليزي: المفتاح = النص العربي كما هو في الكود، القيمة = الإنجليزي (مقسوم ملفات حسب الشاشات) */
import core from './i18n-en/core';
import tabs from './i18n-en/tabs';
import community from './i18n-en/community';
import merchant from './i18n-en/merchant';
import tools from './i18n-en/tools';

export const EN: Record<string, string> = { 'دليل السعودية': 'Saudi Guide', ...core, ...tabs, ...community, ...merchant, ...tools };
