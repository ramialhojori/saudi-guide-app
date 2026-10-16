import * as WebBrowser from 'expo-web-browser';
import { Text, View } from 'react-native';
import { htmlToBlocks, isOwnSite } from '@/lib/text';
import { colors, font, space, START, type } from '@/theme/tokens';
import { isRtl } from '@/lib/i18n';

/** نص المكان/الخبر من قودبابر: فقرات + عريض + روابط — بنصوص أصلية (بدون WebView) */
export function RichText({ html, scale = 1 }: { html: string; scale?: number }) {
  const blocks = htmlToBlocks(html);
  return (
    <View style={{ gap: space.sm }}>
      {blocks.map((b, i) => (
        <Text key={i} style={[type.body, { color: colors.text, textAlign: START, writingDirection: isRtl ? 'rtl' : 'ltr' }, scale !== 1 && { fontSize: type.body.fontSize * scale, lineHeight: type.body.lineHeight * scale }]}>
          {b.parts.map((p, j) =>
            p.href && !isOwnSite(p.href) ? (
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
