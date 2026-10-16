/**
 * «التنقل بين العناصر»: القائمة اللي فتح منها المستخدم مكان/فعالية/خبر تنحفظ هنا،
 * فصفحة التفاصيل تقدر تنقله للي بعده أو قبله بالسحب يمين ويسار (بدون ما يرجع للقائمة)
 * الاستخدام في القوائم: openFrom('place', ids, id) بدل router.push(`/place/${id}`)
 */
import { router } from 'expo-router';

export type BrowseKind = 'place' | 'event' | 'article';
const lists: Record<BrowseKind, number[]> = { place: [], event: [], article: [] };

/** يحفظ القائمة ويفتح العنصر */
export function openFrom(kind: BrowseKind, ids: number[], id: number) {
  lists[kind] = ids.filter(Boolean).slice(0, 300);
  router.push(`/${kind}/${id}` as never);
}

/** اللي بعده (dir=1) أو قبله (dir=-1) في نفس القائمة، أو null */
export function sibling(kind: BrowseKind, id: number, dir: 1 | -1): number | null {
  const l = lists[kind];
  const i = l.indexOf(id);
  if (i < 0) return null;
  return l[i + dir] ?? null;
}
/** مكانه في القائمة: «3 من 40» */
export function position(kind: BrowseKind, id: number): { i: number; n: number } | null {
  const i = lists[kind].indexOf(id);
  return i < 0 ? null : { i: i + 1, n: lists[kind].length };
}

/** القوائم تسجّل عناصرها الظاهرة (بدون ما تغيّر طريقة الفتح): آخر قائمة انعرضت هي اللي يتنقل فيها */
export function setList(kind: BrowseKind, ids: number[]) {
  lists[kind] = ids.filter(Boolean).slice(0, 300);
}
