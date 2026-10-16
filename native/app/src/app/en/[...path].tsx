/** روابط الويب الإنجليزية /en/... : اللغة انضبطت من الرابط (lib/i18n.ts)، هنا نحوّل لنفس الصفحة بدون /en (مع باقي الرابط ?s=...) */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function EnRedirect() {
  const { path, ...rest } = useLocalSearchParams<{ path?: string | string[] } & Record<string, string>>();
  const p = Array.isArray(path) ? path.join('/') : path || '';
  const q = new URLSearchParams(rest as Record<string, string>).toString();
  return <Redirect href={('/' + p + (q ? '?' + q : '')) as never} />;
}
