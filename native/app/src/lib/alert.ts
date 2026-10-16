/**
 * تنبيه يشتغل في الجوال والويب
 * Alert.alert في نسخة الويب ما يسوي شي، فهنا نستخدم نوافذ المتصفح (تأكيد / تنبيه) بدلها.
 * الاستخدام نفس Alert.alert: alert('العنوان', 'النص', [{ text: 'إلغاء', style: 'cancel' }, { text: 'شيله', onPress }])
 */
import { Alert, Platform, type AlertButton } from 'react-native';

export function alert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') return Alert.alert(title, message, buttons);
  const text = [title, message].filter(Boolean).join('\n\n');
  const acts = (buttons || []).filter((b) => b.style !== 'cancel');
  if (!buttons || buttons.length < 2 || !acts.length) {
    window.alert(text);
    acts[0]?.onPress?.();
    return;
  }
  // زر واحد فعلي + إلغاء: نافذة تأكيد. أكثر من زر: ناخذ آخر زر (العادة إنه الإجراء الأساسي)
  if (window.confirm(text)) acts[acts.length - 1].onPress?.();
  else buttons.find((b) => b.style === 'cancel')?.onPress?.();
}
