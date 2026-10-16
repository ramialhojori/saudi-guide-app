import { useLocalSearchParams } from 'expo-router';
import { InviteScreen } from '@/components/InviteScreen';
/** رابط دعوة من صديق (/invite/الكود): الكود يكون جاهز في الخانة */
export default function InviteCode() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <InviteScreen code={String(code || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12)} />;
}
