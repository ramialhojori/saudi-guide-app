/** تفضيلات المستخدم المحفوظة في الجوال: الترحيب، الاهتمامات، مدينته */
import AsyncStorage from '@react-native-async-storage/async-storage';

const K = { onboarded: 'sg_onboarded_v1', interests: 'sg_interests_v1', city: 'sg_city_v1' };
export const prefs = {
  onboarded: async () => (await AsyncStorage.getItem(K.onboarded).catch(() => null)) === '1',
  setOnboarded: () => AsyncStorage.setItem(K.onboarded, '1').catch(() => {}),
  interests: async () => JSON.parse((await AsyncStorage.getItem(K.interests).catch(() => null)) || '[]') as string[],
  setInterests: (v: string[], cities: string[]) => AsyncStorage.setItem(K.interests, JSON.stringify({ kinds: v, cities })).catch(() => {}),
};
