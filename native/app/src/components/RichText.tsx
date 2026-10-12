import * as WebBrowser from 'expo-web-browser';
import { Text, View } from 'react-native';
import { htmlToBlocks } from '@/lib/text';
import { colors, font, space, type } from '@/theme/tokens';

/** نص المكان/الخبر من قودبابر: فقرات + عريض + روابط — بنصوص أصلية (بدون WebView) */
export function RichText({ html }: { html: string }) {
  const blocks = htmlToBlocks(html);
  return (
    <View style={{ gap: space.sm }}>
      {blocks.map((b, i) => (
        <Text key={i} style={[type.body, { color: colors.text, textAlign: 'right', writingDirection: 'rtl' }]}>
          {b.parts.map((p, j) =>
            p.href ? (
              <Text key={j} style={{ color: colors.primary, textDecorationLine: 'underline' }} onPress={() => WebBrowser.openBrowserAsync(p.href!)}>{p.text}</Text>
            ) : (
              <Text key={j} style={p.bold ? { fontFamily: font.bold } : undefined}>{p.text}</Text>
            ),
          )}
        </Text>
      ))}
    </View>
  );
}
