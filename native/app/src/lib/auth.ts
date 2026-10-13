/**
 * الحساب: الدخول بآبل (وقوقل لاحقاً)، ورمز الجلسة محفوظ في SecureStore.
 * بعد الدخول نجمع «رحلتي» من الجوال مع الحساب، وأي تغيير بعدها يتزامن مع السيرفر.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { api } from './api';
import { trip } from './trip';

export type User = { id: string; name: string; handle: string; email: string; city: string; bio: string; avatar: string; role: string; points: number; since: number };
type State = { token: string | null; user: User | null; ready: boolean };

const KEY = 'sg_session_v1';
let state: State = { token: null, user: null, ready: false };
const subs = new Set<() => void>();
const set = (s: Partial<State>) => { state = { ...state, ...s }; subs.forEach((f) => f()); };

const store = {
  get: async () => (Platform.OS === 'web' ? (() => { try { return localStorage.getItem(KEY); } catch { return null; } })() : SecureStore.getItemAsync(KEY)),
  set: async (v: string) => (Platform.OS === 'web' ? (() => { try { localStorage.setItem(KEY, v); } catch {} })() : SecureStore.setItemAsync(KEY, v)),
  del: async () => (Platform.OS === 'web' ? (() => { try { localStorage.removeItem(KEY); } catch {} })() : SecureStore.deleteItemAsync(KEY)),
};

(async () => {
  try {
    const raw = await store.get();
    if (raw) {
      const s = JSON.parse(raw) as { token: string; user: User };
      set({ token: s.token, user: s.user });
      api<{ user: User }>('/v1/me', { token: s.token })
        .then((r) => { set({ user: r.user }); store.set(JSON.stringify({ token: s.token, user: r.user })); })
        .catch((e) => { if (e?.status === 401) signOut(); });
    }
  } finally {
    set({ ready: true });
  }
})();

/* أي تغيير في رحلتي يوصل للحساب (بعد ثانية من آخر تغيير) */
let timer: ReturnType<typeof setTimeout> | undefined;
trip.onChange((ids) => {
  if (!state.token) return;
  clearTimeout(timer);
  timer = setTimeout(() => { api('/v1/me/trip', { method: 'PUT', body: { ids }, token: state.token }).catch(() => {}); }, 1000);
});

async function afterLogin(token: string, user: User) {
  set({ token, user });
  await store.set(JSON.stringify({ token, user }));
  // دمج: اللي في الحساب + اللي في الجوال
  const remote = await api<{ ids: number[] }>('/v1/me/trip', { token }).then((r) => r.ids).catch(() => [] as number[]);
  const merged = [...new Set([...remote, ...trip.all()])];
  trip.replace(merged);
  if (merged.length !== remote.length) api('/v1/me/trip', { method: 'PUT', body: { ids: merged }, token }).catch(() => {});
}

export const appleAvailable = () => (Platform.OS === 'ios' ? AppleAuthentication.isAvailableAsync().catch(() => false) : Promise.resolve(false));

export async function signInWithApple(): Promise<'ok' | 'cancel'> {
  try {
    const c = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    const name = [c.fullName?.givenName, c.fullName?.familyName].filter(Boolean).join(' ');
    const r = await api<{ token: string; user: User }>('/v1/auth/apple', { method: 'POST', body: { idToken: c.identityToken, name } });
    await afterLogin(r.token, r.user);
    return 'ok';
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return 'cancel';
    throw e;
  }
}

export async function updateMe(patch: Partial<Pick<User, 'name' | 'city' | 'bio'>>) {
  if (!state.token) return;
  const r = await api<{ user: User }>('/v1/me', { method: 'PATCH', body: patch, token: state.token });
  set({ user: r.user });
  await store.set(JSON.stringify({ token: state.token, user: r.user }));
}

export async function signOut() {
  set({ token: null, user: null });
  await store.del();
}

/** حذف الحساب نهائياً (شرط آبل) */
export async function deleteAccount() {
  if (state.token) await api('/v1/me', { method: 'DELETE', token: state.token });
  await signOut();
  trip.clear();
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useAuth = () => useSyncExternalStore(subscribe, () => state);
