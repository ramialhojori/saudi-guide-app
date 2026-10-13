import { Redirect } from 'expo-router';

/** «أضف صورة» صار جزء من شاشة النشر */
export default function Screen() {
  return <Redirect href={{ pathname: '/ask', params: { kind: 'photo' } }} />;
}
