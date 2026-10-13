import { Text, type TextProps } from 'react-native';
import { colors, START, type } from '@/theme/tokens';

type Props = TextProps & { variant?: keyof typeof type; muted?: boolean; color?: string; center?: boolean };

/** كل نصوص التطبيق تمر من هنا: خط IBM Plex Sans Arabic + محاذاة من اليمين */
export function AppText({ variant = 'body', muted, color, center, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        type[variant],
        { color: color ?? (muted ? colors.textMuted : colors.text), textAlign: center ? 'center' : START, writingDirection: 'rtl' },
        style,
      ]}
    />
  );
}
