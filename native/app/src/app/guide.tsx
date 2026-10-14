import { Redirect } from 'expo-router';

/** الدليل صار داخل «استكشف» */
export default function Screen() {
  return <Redirect href="/explore" />;
}
