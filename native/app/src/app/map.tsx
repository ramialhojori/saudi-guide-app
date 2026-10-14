import { Redirect } from 'expo-router';

/** الخريطة صارت داخل «استكشف» */
export default function Screen() {
  return <Redirect href={{ pathname: '/explore', params: { mode: 'map' } }} />;
}
