import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { AppText } from '@/components/AppText';
import { brand, font, INPUT_START } from '@/theme/tokens';

/** عنوان الحقل مع ملاحظة صغيرة على اليسار */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 16 }}>
      <View style={st.head}>
        <AppText style={{ fontFamily: font.semibold, fontSize: 14 }}>{label}</AppText>
        {hint ? <AppText variant="tiny" muted>{hint}</AppText> : null}
      </View>
      {children}
    </View>
  );
}

export function Input({ style, multiline, ...p }: TextInputProps) {
  return (
    <TextInput placeholderTextColor={brand.faint} {...p} multiline={multiline}
      style={[st.input, multiline && { height: undefined, minHeight: 100, paddingTop: 12, textAlignVertical: 'top', lineHeight: 26 }, style]} />
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable onPress={() => onChange(!on)} style={st.trow} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <AppText style={{ flex: 1, fontSize: 14 }}>{label}</AppText>
      <View style={[st.sw, { backgroundColor: on ? brand.green : brand.inactive }]}><View style={[st.knob, on ? { left: 3 } : { right: 3 }]} /></View>
    </Pressable>
  );
}

/** صف «عنوان … قيمة» داخل بطاقة بيضاء */
export function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[st.trow, !last && st.line]}>
      <AppText style={{ flex: 1, fontSize: 14 }}>{label}</AppText>
      {children}
    </View>
  );
}

export const formSt = StyleSheet.create({
  box: { backgroundColor: brand.white, borderWidth: 1.5, borderColor: brand.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 2 },
});

const st = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  input: { height: 50, borderWidth: 1.5, borderColor: brand.line, borderRadius: 14, paddingHorizontal: 14, fontFamily: font.regular, fontSize: 15, color: brand.text, backgroundColor: brand.white, textAlign: INPUT_START },
  trow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  line: { borderBottomWidth: 1, borderBottomColor: brand.chip },
  sw: { width: 44, height: 26, borderRadius: 13 },
  knob: { position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
});
