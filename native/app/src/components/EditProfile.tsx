import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from './AppText';
import { alert } from '@/lib/alert';
import { updateMe, useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { brand, font, INPUT_START } from '@/theme/tokens';

/** تعديل الاسم والنبذة (نافذة من «ملفي») */
export function EditProfile({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  // نعبّي الخانات بالقيم الحالية كل ما تنفتح النافذة
  useEffect(() => { if (open) { setName(user?.name ?? ''); setBio(user?.bio ?? ''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const n = name.trim();
    if (n.length < 2) return alert(t('الاسم قصير'), t('اكتب اسمك (حرفين على الأقل).'));
    setBusy(true);
    try { await updateMe({ name: n, bio: bio.trim() }); onClose(); }
    catch { alert(t('ما انحفظ'), t('تأكد من النت وجرّب مرة ثانية.')); }
    finally { setBusy(false); }
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,14,36,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={st.sheet}>
          <AppText style={{ fontFamily: font.bold, fontSize: 19 }}>{t('عدّل ملفك')}</AppText>
          <AppText variant="small" muted>{t('اسمك')}</AppText>
          <TextInput value={name} onChangeText={setName} placeholder={t('اسمك اللي يطلع للناس')} placeholderTextColor={brand.muted} maxLength={60} autoFocus style={[st.input, { textAlign: INPUT_START }]} />
          <AppText variant="small" muted>{t('نبذة عنك (اختياري)')}</AppText>
          <TextInput value={bio} onChangeText={setBio} placeholder={t('مثلاً: من أهل المدينة وأحب الرحلات')} placeholderTextColor={brand.muted} maxLength={200} multiline style={[st.input, { minHeight: 80, textAlignVertical: 'top', textAlign: INPUT_START }]} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Pressable style={[st.btn, { flex: 1 }]} onPress={save} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <AppText color="#fff" style={{ fontFamily: font.bold }}>{t('حفظ')}</AppText>}</Pressable>
            <Pressable style={[st.btn, { backgroundColor: brand.chip, paddingHorizontal: 20 }]} onPress={onClose}><AppText style={{ fontFamily: font.bold }}>{t('إلغاء')}</AppText></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  sheet: { backgroundColor: brand.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34, gap: 8 },
  input: { backgroundColor: brand.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: font.regular, fontSize: 16, color: brand.text },
  btn: { height: 48, borderRadius: 14, backgroundColor: brand.purple, alignItems: 'center', justifyContent: 'center' },
});
