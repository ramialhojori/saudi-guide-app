import Svg, { Path } from 'react-native-svg';
import { brand } from '@/theme/tokens';
import { isEn } from '@/lib/i18n';

/** أيقونات خطية — نفس المسارات المستخدمة في لوحة التصميم */
export const ICONS = {
  back: 'M9 6l6 6-6 6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  bag: 'M3 7h18v13H3zM9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2',
  people: 'M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z',
  star: 'M12 2l3 6.5 7 .9-5.1 4.8 1.3 7L12 17.8 5.8 21.2l1.3-7L2 9.4l7-.9z',
  ticket: 'M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3zM10 4v12',
  cal: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  cam: 'M3 7h18v13H3zM8 7l2-3h4l2 3M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  spark: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z',
  share: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13',
  wifi: 'M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18',
  up: 'M12 19V5M5 12l7-7 7 7',
  check: 'M5 12l5 5L20 7',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h2M3 12h2M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  out: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  book: 'M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z',
  food: 'M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 0-3 3-3 6s1 4 3 4v8',
  cafe: 'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3',
  nature: 'M3 20l6-11 4 7 3-4 5 8z',
  heritage: 'M4 21V8l4-3 4 3 4-3 4 3v13M4 12h16M9 21v-4h6v4',
  sights: 'M3 21h18M5 21V10l7-6 7 6v11M10 21v-5h4v5',
  mosque: 'M12 3c-3 2-5 4-5 7h10c0-3-2-5-5-7zM5 21V12h14v9M9 21v-4a3 3 0 0 1 6 0v4M3 21h18',
  fun: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  shop: 'M5 7h14l-1 13H6zM9 7a3 3 0 0 1 6 0',
  family: 'M8 5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM17 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM3 20a5 5 0 0 1 10 0M13.5 20a3.5 3.5 0 0 1 7 0',
  money: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 10v4M18 10v4',
  apple: 'M16 3c-1 .2-2.2.9-2.8 1.9-.6.8-1 2-.8 3 1.1 0 2.2-.7 2.9-1.6.6-.9 1-2 .7-3.3zM12.5 8.3c-1 0-2-.6-3-.6-2 0-3.9 1.6-3.9 4.6 0 3.5 2.6 8.7 4.6 8.7.9 0 1.3-.6 2.4-.6s1.4.6 2.4.6c1.8 0 3.3-3.4 3.6-4.6-2-1-2.3-4.4 0-5.5-.9-1.4-2.3-1.8-3.2-1.8-1.1 0-2 .8-2.9.8z',
  phone: 'M7 2h10v20H7zM11 18h2',
  plus: 'M12 5v14M5 12h14',
  down: 'M12 4v12M6 11l6 6 6-6M4 20h16',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  chevron: 'M15 6l-6 6 6 6',
  x: 'M6 6l12 12M18 6L6 18',
  nav: 'M3 11l18-8-8 18-2-8z',
  news: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h4M18 9v6a4 4 0 0 1-4 4h-4',
  ticket2: 'M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3zM10 4v12',
} as const;
export type IconName = keyof typeof ICONS | 'heartFill';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number; fill?: string };

export function Icon({ name, size = 22, color = brand.text, strokeWidth = 2, fill }: Props) {
  // أسهم الاتجاه (رجوع / التالي) مرسومة للعربي؛ بالإنجليزي تنعكس
  const d = isEn && name === 'back' ? ICONS.chevron : isEn && name === 'chevron' ? ICONS.back : ICONS[name === 'heartFill' ? 'heart' : name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color} strokeWidth={strokeWidth} fill={name === 'heartFill' ? color : fill ?? 'none'} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
