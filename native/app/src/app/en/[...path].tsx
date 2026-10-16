/** روابط الويب الإنجليزية /en/... : اللغة انضبطت من الرابط (lib/i18n.ts)، هنا نحوّل لنفس الصفحة بدون /en */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function EnRedirect() {
  const { path } = useLocalSearchParams<{ path?: string | string[] }>();
  const p = Array.isArray(path) ? path.join('/') : path || '';
  return <Redirect href={('/' + p) as never} />;
}
