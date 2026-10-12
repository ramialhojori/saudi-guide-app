import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home' | 'compass' | 'suitcase' | 'calendar' | 'menu' | 'search' | 'heart' | 'heartFill'
  | 'nav' | 'phone' | 'globe' | 'share' | 'back' | 'plus' | 'check' | 'x' | 'pin' | 'ticket' | 'news' | 'chat' | 'chevron';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

/** أيقونات خطية بسيطة (نفس أسلوب أيقونات صفحات الكود في قودبابر) */
export function Icon({ name, size = 22, color = '#373D63', strokeWidth = 2 }: Props) {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path {...p} d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />}
      {name === 'compass' && (<><Circle {...p} cx={12} cy={12} r={9} /><Path {...p} d="M15.5 8.5l-2 5-5 2 2-5z" /></>)}
      {name === 'suitcase' && (<><Rect {...p} x={3} y={7} width={18} height={13} rx={2} /><Path {...p} d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>)}
      {name === 'calendar' && (<><Rect {...p} x={3} y={5} width={18} height={16} rx={2} /><Path {...p} d="M16 3v4M8 3v4M3 10h18" /></>)}
      {name === 'menu' && <Path {...p} d="M4 7h16M4 12h16M4 17h16" />}
      {name === 'search' && (<><Circle {...p} cx={11} cy={11} r={7} /><Path {...p} d="M20 20l-4-4" /></>)}
      {name === 'heart' && <Path {...p} d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />}
      {name === 'heartFill' && <Path {...p} fill={color} d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />}
      {name === 'nav' && <Path {...p} d="M3 11l18-8-8 18-2-8z" />}
      {name === 'phone' && <Path {...p} d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />}
      {name === 'globe' && (<><Circle {...p} cx={12} cy={12} r={9} /><Path {...p} d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>)}
      {name === 'share' && (<><Circle {...p} cx={18} cy={5} r={3} /><Circle {...p} cx={6} cy={12} r={3} /><Circle {...p} cx={18} cy={19} r={3} /><Path {...p} d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>)}
      {name === 'back' && <Path {...p} d="M9 6l6 6-6 6" />}
      {name === 'chevron' && <Path {...p} d="M15 6l-6 6 6 6" />}
      {name === 'plus' && <Path {...p} d="M12 5v14M5 12h14" />}
      {name === 'check' && <Path {...p} d="M5 12l5 5 9-10" />}
      {name === 'x' && <Path {...p} d="M6 6l12 12M18 6L6 18" />}
      {name === 'pin' && (<><Path {...p} d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><Circle {...p} cx={12} cy={10} r={2.5} /></>)}
      {name === 'ticket' && <Path {...p} d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM14 7v10" />}
      {name === 'news' && (<><Rect {...p} x={4} y={4} width={16} height={16} rx={2} /><Path {...p} d="M8 9h8M8 13h8M8 17h5" /></>)}
      {name === 'chat' && <Path {...p} d="M4 5h16v11H9l-5 4z" />}
    </Svg>
  );
}
