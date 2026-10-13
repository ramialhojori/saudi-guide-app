/** إشعارات داخل التطبيق: عدد غير المقروء يتحدّث لما ترجع لأي شاشة فيها جرس */
import { useCallback, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from './api';
import { session } from './auth';

export type Note = { id: number; type: 'answer' | 'thanks' | 'best' | 'system'; postId: number | null; actor: string; text: string; post: string; read: boolean; created: number };

let unread = 0;
const subs = new Set<() => void>();
const setUnread = (n: number) => { unread = n; subs.forEach((f) => f()); };

export async function fetchNotes(): Promise<{ unread: number; items: Note[] }> {
  const tok = session().token;
  if (!tok) return { unread: 0, items: [] };
  const r = await api<{ unread: number; items: Note[] }>('/v1/me/notifications', { token: tok });
  setUnread(r.unread);
  return r;
}
export async function markAllRead() {
  const tok = session().token;
  if (!tok) return;
  setUnread(0);
  await api('/v1/me/notifications', { method: 'POST', body: {}, token: tok }).catch(() => {});
}

/** للجرس: يرجع عدد غير المقروء ويحدّثه كل ما تفتح الشاشة */
export function useUnread() {
  const n = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => unread);
  useFocusEffect(useCallback(() => { fetchNotes().catch(() => {}); }, []));
  return n;
}
