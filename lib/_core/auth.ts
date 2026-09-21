import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { apiUrl, resolveApiBaseUrl } from "./api-url";

export type User = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "user" | "admin";
  appRole: "family" | "driver" | "admin";
  userStatus: "active" | "blocked" | "suspended_temp" | "suspended_permanent";
};
type Session = { accessToken: string; refreshToken: string; accessTokenExpiresAt: string | number; user: User };
const KEY = "wasalny.firebase.session.v1";
let session: Session | null = null;
let loaded = false;
let generation = 0;
let loading: Promise<void> | null = null;
let refreshing: Promise<string | null> | null = null;
let writes: Promise<void> = Promise.resolve();
const listeners = new Set<(user: User | null) => void>();
export function subscribeAuth(listener: (user: User | null) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function emit() { listeners.forEach(listener => listener(session?.user ?? null)); }
export function authBaseUrl() {
  return resolveApiBaseUrl();
}
export class AuthApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl(path), { ...options, credentials: "omit",
    headers: { "Content-Type": "application/json", ...options.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new AuthApiError(typeof body?.error === "string" ? body.error : `Request failed (${response.status})`, response.status);
  return body as T;
}
function persist(nextSession: Session | null = session) {
  // Browsers have no SecureStore: keep both bearer credentials in memory, never localStorage.
  // A web reload intentionally requires signing in again.
  const value = nextSession ? JSON.stringify(nextSession) : null;
  const next = writes.catch(() => {}).then(async () => {
    if (Platform.OS !== "web") {
      if (value) await SecureStore.setItemAsync(KEY, value);
      else await SecureStore.deleteItemAsync(KEY);
    }
  });
  writes = next;
  return next;
}
async function load() {
  if (loaded) return;
  if (!loading) {
    const epoch = generation;
    loading = (async () => {
      if (Platform.OS !== "web") {
        const raw = await SecureStore.getItemAsync(KEY);
        if (raw && epoch === generation) session = JSON.parse(raw);
      }
      loaded = true;
    })().finally(() => { loading = null; });
  }
  await loading;
}
export async function clearSession() {
  generation++;
  session = null;
  loaded = true;
  refreshing = null;
  emit();
  await persist();
}
export async function rejectSessionToken(token: string | null) {
  // An old request must not sign out a different user who signed in while it was running.
  if (token && session?.accessToken === token) await clearSession();
}
export class SessionPersistenceError extends Error {
  constructor() {
    super("SESSION_PERSISTENCE_FAILED: تعذر حفظ الجلسة بأمان. تم إنهاء الجلسة محلياً؛ سجّل الدخول مجدداً. قد يتعذر حذف النسخة المخزنة أو إلغاء الجلسة على الخادم.");
  }
}
async function persistenceFailed(result: Session, epoch: number): Promise<never> {
  // Rotation consumed the stored refresh token. Never continue with memory-only
  // credentials on native, or surface SecureStore errors containing credential data.
  // A failure from an older account must not clear a newer account's session.
  if (epoch === generation) await clearSession().catch(() => {});
  await authRequest("/api/auth/logout", {
    method: "POST", headers: { Authorization: `Bearer ${result.accessToken}` },
  }).catch(() => {});
  throw new SessionPersistenceError();
}
export async function exchangeFirebaseToken(idToken: string) {
  await clearSession();
  const epoch = generation;
  const result = await authRequest<Session>("/api/auth/firebase/exchange", { method: "POST", body: JSON.stringify({ idToken }) });
  if (epoch !== generation) throw new Error("Sign-in cancelled.");
  if (!result.accessToken || !result.refreshToken || !result.user?.id) throw new Error("Invalid session response.");
  try { await persist(result); } catch { await persistenceFailed(result, epoch); }
  if (epoch !== generation) throw new Error("Sign-in cancelled.");
  session = result;
  emit();
  return result.user;
}
export async function getSessionToken(): Promise<string | null> {
  await load();
  if (!session) return null;
  const expiry = typeof session.accessTokenExpiresAt === "number" ? session.accessTokenExpiresAt : Date.parse(session.accessTokenExpiresAt);
  if (expiry > Date.now() + 60_000) return session.accessToken;
  if (!refreshing) {
    const epoch = generation;
    const refreshToken = session.refreshToken;
    const task = (async () => {
      try {
        const result = await authRequest<Session>("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) });
        if (epoch !== generation) return null;
        try { await persist(result); } catch { await persistenceFailed(result, epoch); }
        if (epoch !== generation) return null;
        session = result;
        emit();
        return result.accessToken;
      } catch (error) {
        if (epoch === generation && error instanceof AuthApiError && [401, 403].includes(error.status)) await clearSession();
        throw error;
      }
    })();
    refreshing = task;
    void task.finally(() => { if (refreshing === task) refreshing = null; }).catch(() => {});
  }
  return refreshing;
}
// This is deliberately a server read, not a cached role/status lookup.
export async function getUserInfo(): Promise<User | null> {
  const epoch = generation;
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const result = await authRequest<{ user: User }>("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    if (epoch !== generation) return null;
    if (session) {
      const changed = JSON.stringify(session.user) !== JSON.stringify(result.user);
      session = { ...session, user: result.user };
      if (changed) emit();
    }
    return result.user;
  } catch (error) {
    if (epoch === generation && error instanceof AuthApiError && [401, 403].includes(error.status)) await clearSession();
    throw error;
  }
}
export async function logout(allDevices = false) {
  // Local logout always succeeds even offline; server revocation failure is reported, not hidden.
  await load();
  const token = session?.accessToken;
  await clearSession();
  if (token) {
    try {
      await authRequest(`/api/auth/${allDevices ? "logout-all" : "logout"}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new Error("تم تسجيل الخروج محلياً. تعذر إلغاء الجلسة على الخادم؛ قد تبقى الجلسات الأخرى نشطة.");
    }
  }
}
export const removeSessionToken = clearSession;
export const clearUserInfo = clearSession;