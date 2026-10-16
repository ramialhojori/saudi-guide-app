/** «ادعُ صديق»: كود الدعوة وإحصائياته، وتفعيل كود صديق (حساب جديد بس) */
import { Share } from 'react-native';
import { api } from './api';
import { session, setPlusUntil } from './auth';
import { t } from './i18n';
import { track } from './track';

export type InviteInfo = { code: string; link: string; invited: number; daysEarned: number; rewardDays: number; canRedeem: boolean; redeemed: boolean };

export const getInvite = () => api<InviteInfo>('/v1/invite', { token: session().token });

export async function redeemInvite(code: string) {
  const r = await api<{ ok: true; days: number; plusUntil: number; inviter: string }>('/v1/invite/redeem', { method: 'POST', body: { code }, token: session().token });
  if (r.plusUntil) setPlusUntil(r.plusUntil);
  track('invite_redeem');
  return r;
}

export function shareInvite(i: InviteInfo) {
  track('invite_share');
  Share.share({
    message: t('جرّب تطبيق دليل السعودية: أماكن وفعاليات وعروض كل المدن ومخطط رحلات ذكي. سجّل واكتب كود الدعوة {code} وناخذ أنا وأنت {n} أيام دليل+ هدية', { code: i.code, n: i.rewardDays }) + `\n${i.link}`,
    url: i.link,
  }).catch(() => {});
}
